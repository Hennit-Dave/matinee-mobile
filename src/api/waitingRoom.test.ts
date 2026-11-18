import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT_ID_HEADER } from './clientId';
import {
  MAX_RETRY_AFTER_SECONDS,
  MovieApiError,
  isServerOverloadedError,
  isWaitingRoomRequiredError,
  readHoldLimit,
} from './movies';
import {
  DEFAULT_POLL_AFTER_MS,
  MAX_POLL_AFTER_MS,
  MIN_POLL_AFTER_MS,
  QUEUE_POLL_JITTER,
  buildQueueUrl,
  isAdmitted,
  isNotQueued,
  isQueueState,
  isWaiting,
  joinQueue,
  leaveQueue,
  pollQueue,
  queuePollDelayMs,
  QUEUE_REQUEST_TIMEOUT_MS,
  withRequestTimeout,
} from './waitingRoom';

const BASE = 'https://api.example.test';
const SHOWTIME = '3f2c1b7e-6a1d-4c8e-9a52-0b1d2e3f4a5b';
const CLIENT = '0a11ce00-0000-4000-8000-000000000001';

interface Sent {
  url: string;
  init: RequestInit | undefined;
}

/** Runs `body` with `fetch` replaced by `handler`, and gives back what was sent. Always puts fetch back. */
async function withFetch(
  handler: (url: string, init: RequestInit | undefined) => Response | Promise<Response>,
  body: (sent: Sent[]) => Promise<void>
): Promise<void> {
  const original = globalThis.fetch;
  const sent: Sent[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    sent.push({ url: String(input), init });
    return handler(String(input), init);
  }) as typeof fetch;
  try {
    await body(sent);
  } finally {
    globalThis.fetch = original;
  }
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function errorBody(code: string, extra: Record<string, unknown> = {}) {
  return { error: { code, message: `message for ${code}`, requestId: 'req-1', ...extra } };
}

async function failureOf(run: () => Promise<unknown>): Promise<MovieApiError> {
  const error = await run().then(
    () => null,
    (e: unknown) => e
  );
  assert.ok(error instanceof MovieApiError, 'expected a MovieApiError');
  return error;
}

// ---- The answers ----------------------------------------------------------------------------------

test('isQueueState accepts the three server answers', () => {
  assert.equal(isQueueState({ status: 'admitted', passExpiresInMs: 30_000 }), true);
  assert.equal(isQueueState({ status: 'admitted', passExpiresInMs: 0 }), true, 'a pass about to lapse is still a pass');
  assert.equal(isQueueState({ status: 'waiting', ahead: 12, pollAfterMs: 3_000 }), true);
  assert.equal(isQueueState({ status: 'waiting', ahead: 0, pollAfterMs: 3_000 }), true, '0 ahead means you are next');
  assert.equal(isQueueState({ status: 'not_queued' }), true);
});

test('isQueueState ignores fields it does not know, so the server can add some', () => {
  assert.equal(isQueueState({ status: 'waiting', ahead: 3, pollAfterMs: 3_000, joinedAt: 'yesterday' }), true);
  assert.equal(isQueueState({ status: 'not_queued', hint: 'join again' }), true);
});

test('isQueueState rejects every field being wrong, so nothing nonsensical is drawn or used as a timer', () => {
  const bad: [string, unknown][] = [
    ['null', null],
    ['a string', 'waiting'],
    ['an array', [{ status: 'waiting' }]],
    ['no status', { ahead: 1, pollAfterMs: 3_000 }],
    ['an unknown status', { status: 'full' }],
    ['a status that is not a string', { status: 1 }],
    ['admitted with no pass time', { status: 'admitted' }],
    ['admitted, pass time a string', { status: 'admitted', passExpiresInMs: '30000' }],
    ['admitted, pass time negative', { status: 'admitted', passExpiresInMs: -1 }],
    ['admitted, pass time NaN', { status: 'admitted', passExpiresInMs: Number.NaN }],
    ['admitted, pass time Infinity', { status: 'admitted', passExpiresInMs: Number.POSITIVE_INFINITY }],
    ['waiting with no place', { status: 'waiting', pollAfterMs: 3_000 }],
    ['waiting, place a string', { status: 'waiting', ahead: '4', pollAfterMs: 3_000 }],
    ['waiting, place negative', { status: 'waiting', ahead: -1, pollAfterMs: 3_000 }],
    ['waiting, place fractional', { status: 'waiting', ahead: 1.5, pollAfterMs: 3_000 }],
    ['waiting, place NaN', { status: 'waiting', ahead: Number.NaN, pollAfterMs: 3_000 }],
    ['waiting with no poll delay', { status: 'waiting', ahead: 4 }],
    ['waiting, poll delay zero', { status: 'waiting', ahead: 4, pollAfterMs: 0 }],
    ['waiting, poll delay negative', { status: 'waiting', ahead: 4, pollAfterMs: -3_000 }],
    ['waiting, poll delay NaN', { status: 'waiting', ahead: 4, pollAfterMs: Number.NaN }],
    ['waiting, poll delay Infinity', { status: 'waiting', ahead: 4, pollAfterMs: Number.POSITIVE_INFINITY }],
  ];
  for (const [label, value] of bad) assert.equal(isQueueState(value), false, label);
});

test('the three narrowing guards each pick out exactly one answer', () => {
  const admitted = { status: 'admitted', passExpiresInMs: 1 } as const;
  const waiting = { status: 'waiting', ahead: 1, pollAfterMs: 3_000 } as const;
  const notQueued = { status: 'not_queued' } as const;
  assert.deepEqual([isAdmitted(admitted), isAdmitted(waiting), isAdmitted(notQueued)], [true, false, false]);
  assert.deepEqual([isWaiting(admitted), isWaiting(waiting), isWaiting(notQueued)], [false, true, false]);
  assert.deepEqual([isNotQueued(admitted), isNotQueued(waiting), isNotQueued(notQueued)], [false, false, true]);
});

// ---- URL ------------------------------------------------------------------------------------------

test('buildQueueUrl builds the queue URL and rejects an id that is not a UUID', () => {
  assert.equal(buildQueueUrl(BASE, SHOWTIME), `${BASE}/showtimes/${SHOWTIME}/queue`);
  for (const bad of ['', 'nope', `${SHOWTIME}/extra`, '../movies']) {
    assert.throws(
      () => buildQueueUrl(BASE, bad),
      (err: unknown) => err instanceof MovieApiError && err.kind === 'validation_failed',
      `should reject "${bad}"`
    );
  }
});

// ---- The three calls ------------------------------------------------------------------------------

test('joinQueue sends a POST with the install id and no body', async () => {
  await withFetch(
    () => json(200, { status: 'waiting', ahead: 4, pollAfterMs: 3_000 }),
    async (sent) => {
      const state = await joinQueue(SHOWTIME, CLIENT, undefined, BASE);
      assert.deepEqual(state, { status: 'waiting', ahead: 4, pollAfterMs: 3_000 });
      assert.equal(sent.length, 1);
      assert.equal(sent[0]!.url, `${BASE}/showtimes/${SHOWTIME}/queue`);
      assert.equal(sent[0]!.init?.method, 'POST');
      assert.equal(sent[0]!.init?.body, undefined);
      const headers = sent[0]!.init?.headers as Record<string, string>;
      assert.equal(headers[CLIENT_ID_HEADER], CLIENT);
      assert.equal(headers['Content-Type'], undefined, 'there is no body, so no content type');
    }
  );
});

test('pollQueue is a plain GET with the install id: it asks, it never joins', async () => {
  await withFetch(
    () => json(200, { status: 'admitted', passExpiresInMs: 30_000 }),
    async (sent) => {
      const state = await pollQueue(SHOWTIME, CLIENT, undefined, BASE);
      assert.deepEqual(state, { status: 'admitted', passExpiresInMs: 30_000 });
      assert.equal(sent[0]!.url, `${BASE}/showtimes/${SHOWTIME}/queue`);
      assert.equal(sent[0]!.init?.method, undefined, 'a GET');
      assert.equal((sent[0]!.init?.headers as Record<string, string>)[CLIENT_ID_HEADER], CLIENT);
    }
  );
});

test('leaveQueue sends a DELETE with the install id and reads not_queued', async () => {
  await withFetch(
    () => json(200, { status: 'not_queued' }),
    async (sent) => {
      assert.deepEqual(await leaveQueue(SHOWTIME, CLIENT, undefined, BASE), { status: 'not_queued' });
      assert.equal(sent[0]!.init?.method, 'DELETE');
      assert.equal((sent[0]!.init?.headers as Record<string, string>)[CLIENT_ID_HEADER], CLIENT);
    }
  );
});

test('a 200 whose body is not a queue answer is an invalid response, not a place in the line', async () => {
  await withFetch(
    () => json(200, { status: 'waiting', ahead: 'many', pollAfterMs: 3_000 }),
    async () => {
      const error = await failureOf(() => joinQueue(SHOWTIME, CLIENT, undefined, BASE));
      assert.equal(error.kind, 'invalid_response');
      assert.equal(error.retryable, false);
    }
  );
});

test('a bad showing id is refused before any request is sent', async () => {
  await withFetch(
    () => json(200, { status: 'not_queued' }),
    async (sent) => {
      await failureOf(() => joinQueue('nope', CLIENT, undefined, BASE));
      await failureOf(() => pollQueue('nope', CLIENT, undefined, BASE));
      await failureOf(() => leaveQueue('nope', CLIENT, undefined, BASE));
      assert.equal(sent.length, 0);
    }
  );
});

// ---- Errors the server sends ----------------------------------------------------------------------

test('404 on join: a showing that does not exist is a not_found, not retryable', async () => {
  await withFetch(
    () => json(404, errorBody('not_found')),
    async () => {
      const error = await failureOf(() => joinQueue(SHOWTIME, CLIENT, undefined, BASE));
      assert.equal(error.kind, 'not_found');
      assert.equal(error.status, 404);
      assert.equal(error.retryable, false);
    }
  );
});

test('503 server_busy: the code, the jittered Retry-After and the retryable flag come through, and it counts as overload', async () => {
  await withFetch(
    () => json(503, errorBody('server_busy'), { 'Retry-After': '11' }),
    async () => {
      const error = await failureOf(() => joinQueue(SHOWTIME, CLIENT, undefined, BASE));
      assert.equal(error.kind, 'server_busy');
      assert.equal(error.status, 503);
      assert.equal(error.retryAfterSeconds, 11);
      assert.equal(error.retryable, true);
      assert.equal(isServerOverloadedError(error), true);
      assert.equal(isWaitingRoomRequiredError(error), false);
    }
  );
});

test('503 waiting_room_full: the line itself is full, with Retry-After, and it counts as overload', async () => {
  await withFetch(
    () => json(503, errorBody('waiting_room_full'), { 'Retry-After': '9' }),
    async () => {
      const error = await failureOf(() => joinQueue(SHOWTIME, CLIENT, undefined, BASE));
      assert.equal(error.kind, 'waiting_room_full');
      assert.equal(error.retryAfterSeconds, 9);
      assert.equal(error.retryable, true);
      assert.equal(isServerOverloadedError(error), true);
    }
  );
});

test('a Retry-After on a shed request is bounded like any other', async () => {
  await withFetch(
    () => json(503, errorBody('server_busy'), { 'Retry-After': '99999' }),
    async () => {
      const error = await failureOf(() => pollQueue(SHOWTIME, CLIENT, undefined, BASE));
      assert.equal(error.retryAfterSeconds, MAX_RETRY_AFTER_SECONDS);
    }
  );
});

test('403 waiting_room_required is recognised, is not retryable by itself, and is not "overloaded"', async () => {
  await withFetch(
    () => json(403, errorBody('waiting_room_required')),
    async () => {
      const error = await failureOf(() => pollQueue(SHOWTIME, CLIENT, undefined, BASE));
      assert.equal(error.kind, 'waiting_room_required');
      assert.equal(error.status, 403);
      assert.equal(error.retryable, false);
      assert.equal(isWaitingRoomRequiredError(error), true);
      assert.equal(isServerOverloadedError(error), false);
    }
  );
});

test('isWaitingRoomRequiredError is true for that code only', () => {
  const kinds = ['not_found', 'validation_failed', 'internal_error', 'seat_taken', 'rate_limited', 'hold_limit_reached', 'server_busy'] as const;
  for (const kind of kinds) assert.equal(isWaitingRoomRequiredError(new MovieApiError('x', { status: 400, kind })), false, kind);
  assert.equal(isWaitingRoomRequiredError(new MovieApiError('x', { status: 403, kind: 'waiting_room_required' })), true);
  for (const other of [new Error('403'), null, undefined, 'waiting_room_required', { kind: 'waiting_room_required' }]) {
    assert.equal(isWaitingRoomRequiredError(other), false);
  }
});

test('409 hold_limit_reached: the server puts scope, limit and held beside the code, and the app reads them', async () => {
  await withFetch(
    () => json(409, errorBody('hold_limit_reached', { scope: 'owner', limit: 8, held: 8 })),
    async () => {
      const error = await failureOf(() => joinQueue(SHOWTIME, CLIENT, undefined, BASE));
      assert.equal(error.kind, 'hold_limit_reached');
      assert.equal(error.status, 409);
      assert.deepEqual(error.holdLimit, { scope: 'owner', limit: 8, held: 8 });
      assert.equal(error.retryAfterSeconds, undefined, 'waiting does not help, so the server sends no Retry-After');
      assert.equal(error.retryable, false);
    }
  );
});

test('readHoldLimit takes only a complete, sensible hold_limit_reached body and drops the rest', () => {
  const body = (extra: Record<string, unknown>, code = 'hold_limit_reached') =>
    ({ code, message: 'm', requestId: 'r', ...extra }) as Parameters<typeof readHoldLimit>[0];

  assert.deepEqual(readHoldLimit(body({ scope: 'address', limit: 16, held: 16 })), { scope: 'address', limit: 16, held: 16 });
  assert.deepEqual(readHoldLimit(body({ scope: 'owner', limit: 8, held: 0 })), { scope: 'owner', limit: 8, held: 0 });

  const bad: [string, Record<string, unknown>][] = [
    ['nothing', {}],
    ['an unknown scope', { scope: 'planet', limit: 8, held: 8 }],
    ['no scope', { limit: 8, held: 8 }],
    ['limit a string', { scope: 'owner', limit: '8', held: 8 }],
    ['limit zero', { scope: 'owner', limit: 0, held: 0 }],
    ['limit fractional', { scope: 'owner', limit: 7.5, held: 8 }],
    ['limit NaN', { scope: 'owner', limit: Number.NaN, held: 8 }],
    ['held negative', { scope: 'owner', limit: 8, held: -1 }],
    ['held missing', { scope: 'owner', limit: 8 }],
  ];
  for (const [label, extra] of bad) assert.equal(readHoldLimit(body(extra)), undefined, label);

  // Other errors never carry a hold limit, even if a body had the fields.
  assert.equal(readHoldLimit(body({ scope: 'owner', limit: 8, held: 8 }, 'seat_taken')), undefined);
});

// ---- When to ask again ----------------------------------------------------------------------------

test('the poll delay is the server number plus or minus 20 percent, from a random draw', () => {
  assert.equal(QUEUE_POLL_JITTER, 0.2);
  assert.equal(queuePollDelayMs(3_000, 0), 2_400);
  assert.equal(queuePollDelayMs(3_000, 0.5), 3_000);
  assert.equal(queuePollDelayMs(3_000, 0.999999), 3_600);
  assert.equal(queuePollDelayMs(10_000, 0.25), 9_000);
});

test('a draw outside 0..1 is clamped, so a bad random source cannot move the delay outside the jitter band', () => {
  assert.equal(queuePollDelayMs(3_000, -5), 2_400);
  assert.equal(queuePollDelayMs(3_000, 5), 3_600);
  assert.equal(queuePollDelayMs(3_000, Number.NaN), 3_000, 'not a number: the middle of the band, never a NaN timer');
});

test('every delay across the whole random range stays inside the band for its base', () => {
  for (const base of [1_000, 3_000, 7_500, 15_000]) {
    for (let step = 0; step <= 100; step += 1) {
      const delay = queuePollDelayMs(base, step / 100);
      assert.ok(delay >= base * 0.8 - 1 && delay <= base * 1.2 + 1, `${base} ms at ${step / 100} gave ${delay}`);
    }
  }
});

test('the server number is bounded before the jitter: never faster than 1 s, never slower than 30 s', () => {
  assert.equal(MIN_POLL_AFTER_MS, 1_000);
  assert.equal(MAX_POLL_AFTER_MS, 30_000);
  assert.equal(queuePollDelayMs(1, 0.5), 1_000, 'a poll delay of 1 ms cannot make the phone hammer the server');
  assert.equal(queuePollDelayMs(50, 0.5), 1_000);
  assert.equal(queuePollDelayMs(900_000, 0.5), 30_000, 'a huge one cannot make a person miss their turn');
  assert.equal(queuePollDelayMs(30_001, 0.5), 30_000);
  assert.equal(queuePollDelayMs(1_000, 0.5), 1_000);
  // Not a number at all (the guard never lets one through, this is the last line): the server's own front-of-line value.
  assert.equal(DEFAULT_POLL_AFTER_MS, 3_000);
  assert.equal(queuePollDelayMs(Number.NaN, 0.5), DEFAULT_POLL_AFTER_MS);
  assert.equal(queuePollDelayMs(Number.POSITIVE_INFINITY, 0.5), DEFAULT_POLL_AFTER_MS);
});

test('two people with the same server number do not ask at the same moment', () => {
  const delays = new Set([0.05, 0.3, 0.55, 0.8, 0.95].map((draw) => queuePollDelayMs(3_000, draw)));
  assert.equal(delays.size, 5);
});

// ---- A request that never answers -----------------------------------------------------------------

/** A `fetch` that never answers unless it is aborted, like a socket that died with no notice. */
function hangingFetch(): typeof fetch {
  return ((_input: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })) as typeof fetch;
}

test('a poll that is never answered fails once its time is up, instead of hanging for ever', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = hangingFetch();
  try {
    const startedAt = Date.now();
    // Raced against a deadline, so a timeout that never fires fails this test loudly instead of hanging the whole run.
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const stillHanging = new Promise<never>((_resolve, reject) => {
      deadline = setTimeout(() => reject(new Error('still hanging: the timeout never aborted the request')), 2_000);
    });
    try {
      await assert.rejects(
        () => Promise.race([withRequestTimeout((signal) => pollQueue(SHOWTIME, CLIENT, signal, BASE), 30), stillHanging]),
        (err: unknown) => err instanceof Error && err.name === 'AbortError'
      );
    } finally {
      clearTimeout(deadline);
    }
    assert.ok(Date.now() - startedAt < 2_000, 'it gave up on its own');
  } finally {
    globalThis.fetch = original;
  }
});

test('an answer that arrives in time is returned, and the timer does not fire afterwards', async () => {
  const original = globalThis.fetch;
  let aborted = false;
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    init?.signal?.addEventListener('abort', () => {
      aborted = true;
    });
    return json(200, { status: 'waiting', ahead: 3, pollAfterMs: 3_000 });
  }) as typeof fetch;
  try {
    const state = await withRequestTimeout((signal) => pollQueue(SHOWTIME, CLIENT, signal, BASE), 20);
    assert.deepEqual(state, { status: 'waiting', ahead: 3, pollAfterMs: 3_000 });
    // Wait for the moment the timeout WOULD have fired, by waiting on a timer longer than it.
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(aborted, false, 'the timer was cleared with the request');
  } finally {
    globalThis.fetch = original;
  }
});

test('the timeout is generous enough for the slowest honest answer and short enough that three failures fit inside the 90 s a place is kept', () => {
  assert.equal(QUEUE_REQUEST_TIMEOUT_MS, 10_000);
  // Three timeouts and the two quiet waits between them: 3 x 10 s + 2 x ~2.4 s = under 35 s, well inside 90 s.
  assert.ok(3 * QUEUE_REQUEST_TIMEOUT_MS + 2 * 2_400 < 90_000);
});

test('a join, a poll and a leave all pass the signal on to fetch', async () => {
  const original = globalThis.fetch;
  const signals: (AbortSignal | undefined)[] = [];
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    signals.push(init?.signal ?? undefined);
    return json(200, { status: 'not_queued' });
  }) as typeof fetch;
  try {
    const controller = new AbortController();
    await joinQueue(SHOWTIME, CLIENT, controller.signal, BASE);
    await pollQueue(SHOWTIME, CLIENT, controller.signal, BASE);
    await leaveQueue(SHOWTIME, CLIENT, controller.signal, BASE);
    assert.equal(signals.length, 3);
    for (const signal of signals) assert.equal(signal, controller.signal);
  } finally {
    globalThis.fetch = original;
  }
});
