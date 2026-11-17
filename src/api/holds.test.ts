import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT_ID_HEADER } from './clientId';
import {
  DEFAULT_RETRY_AFTER_MS,
  acquireHold,
  buildHoldsUrl,
  classifyHoldError,
  isHoldResponse,
  isReleaseResponse,
  releaseHold,
} from './holds';
import { MAX_RETRY_AFTER_SECONDS, MovieApiError, fetchApiJson, isServerOverloadedError, parseRetryAfter } from './movies';

const BASE = 'https://api.example.test';
const SHOWTIME = '3f2c1b7e-6a1d-4c8e-9a52-0b1d2e3f4a5b';
const CLIENT = '0a11ce00-0000-4000-8000-000000000001';
const SEAT_A = 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const SEAT_B = 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

const HOLD = { showtimeId: SHOWTIME, seatIds: [SEAT_A, SEAT_B], expiresAt: '2026-11-16T20:10:00.000Z', expiresInMs: 599_940 };

// ---- A stand-in for fetch -------------------------------------------------------------------------

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

// ---- URL and guards -------------------------------------------------------------------------------

test('buildHoldsUrl builds the holds URL and rejects an id that is not a UUID', () => {
  assert.equal(buildHoldsUrl(BASE, SHOWTIME), `${BASE}/showtimes/${SHOWTIME}/holds`);
  for (const bad of ['', 'nope', `${SHOWTIME}/extra`, '../movies']) {
    assert.throws(
      () => buildHoldsUrl(BASE, bad),
      (err: unknown) => err instanceof MovieApiError && err.kind === 'validation_failed',
      `should reject "${bad}"`
    );
  }
});

test('isHoldResponse accepts the server shape and rejects every field being wrong', () => {
  assert.equal(isHoldResponse(HOLD), true);
  assert.equal(isHoldResponse({ ...HOLD, expiresInMs: 0 }), true, 'a hold with no time left is a (finished) hold');

  const bad: [string, unknown][] = [
    ['null', null],
    ['a string', 'hold'],
    ['no showtimeId', { ...HOLD, showtimeId: undefined }],
    ['seatIds not an array', { ...HOLD, seatIds: SEAT_A }],
    ['seatIds with a number in it', { ...HOLD, seatIds: [SEAT_A, 7] }],
    ['no seats at all', { ...HOLD, seatIds: [] }],
    ['expiresAt a number', { ...HOLD, expiresAt: 1763328600000 }],
    ['expiresInMs a string', { ...HOLD, expiresInMs: '599940' }],
    ['expiresInMs negative', { ...HOLD, expiresInMs: -1 }],
    ['expiresInMs NaN', { ...HOLD, expiresInMs: Number.NaN }],
    ['expiresInMs Infinity', { ...HOLD, expiresInMs: Number.POSITIVE_INFINITY }],
  ];
  for (const [label, value] of bad) assert.equal(isHoldResponse(value), false, label);
});

test('isReleaseResponse accepts a list of seat ids, including an empty one', () => {
  assert.equal(isReleaseResponse({ released: [SEAT_A] }), true);
  assert.equal(isReleaseResponse({ released: [] }), true, 'nothing of ours was held: a valid answer');
  for (const bad of [null, {}, { released: SEAT_A }, { released: [1] }, [SEAT_A]]) {
    assert.equal(isReleaseResponse(bad), false, JSON.stringify(bad));
  }
});

// ---- The two calls --------------------------------------------------------------------------------

test('acquireHold sends a POST with the seats as JSON and the caller id in X-Client-Id', async () => {
  await withFetch(
    () => json(201, HOLD),
    async (sent) => {
      const hold = await acquireHold(SHOWTIME, [SEAT_A, SEAT_B], CLIENT, undefined, BASE);
      assert.deepEqual(hold, HOLD);
      assert.equal(sent.length, 1);
      assert.equal(sent[0]!.url, `${BASE}/showtimes/${SHOWTIME}/holds`);
      assert.equal(sent[0]!.init?.method, 'POST');
      assert.deepEqual(JSON.parse(String(sent[0]!.init?.body)), { seatIds: [SEAT_A, SEAT_B] });
      const headers = sent[0]!.init?.headers as Record<string, string>;
      assert.equal(headers[CLIENT_ID_HEADER], CLIENT);
      assert.equal(headers['Content-Type'], 'application/json');
    }
  );
});

test('releaseHold sends a DELETE with the same body and header', async () => {
  await withFetch(
    () => json(200, { released: [SEAT_A] }),
    async (sent) => {
      const result = await releaseHold(SHOWTIME, [SEAT_A], CLIENT, undefined, BASE);
      assert.deepEqual(result, { released: [SEAT_A] });
      assert.equal(sent[0]!.init?.method, 'DELETE');
      assert.deepEqual(JSON.parse(String(sent[0]!.init?.body)), { seatIds: [SEAT_A] });
      assert.equal((sent[0]!.init?.headers as Record<string, string>)[CLIENT_ID_HEADER], CLIENT);
    }
  );
});

test('a 201 with a body that is not a hold is an invalid response, not a countdown', async () => {
  await withFetch(
    () => json(201, { ...HOLD, expiresInMs: 'soon' }),
    async () => {
      await assert.rejects(
        () => acquireHold(SHOWTIME, [SEAT_A], CLIENT, undefined, BASE),
        (err: unknown) => err instanceof MovieApiError && err.kind === 'invalid_response'
      );
    }
  );
});

test('a plain GET is unchanged: no method, headers or body unless asked for', async () => {
  await withFetch(
    () => json(200, { ok: true }),
    async (sent) => {
      await fetchApiJson(`${BASE}/anything`, (v): v is { ok: boolean } => typeof v === 'object');
      assert.deepEqual(Object.keys(sent[0]!.init ?? {}).sort(), ['signal']);
    }
  );
});

// ---- Errors the server sends ----------------------------------------------------------------------

test('409 seat_taken carries the seats it names', async () => {
  await withFetch(
    () => json(409, errorBody('seat_taken', { seatIds: [SEAT_B] })),
    async () => {
      const error = await acquireHold(SHOWTIME, [SEAT_A, SEAT_B], CLIENT, undefined, BASE).then(
        () => null,
        (e: unknown) => e
      );
      assert.ok(error instanceof MovieApiError);
      assert.equal(error.kind, 'seat_taken');
      assert.equal(error.status, 409);
      assert.deepEqual(error.seatIds, [SEAT_B]);
      assert.deepEqual(classifyHoldError(error), { kind: 'taken', seatIds: [SEAT_B], maybeHeld: false });
    }
  );
});

test('a seatIds that is not a list of strings is dropped, not guessed at', async () => {
  for (const seatIds of ['A1', [1, 2], { a: 1 }, null]) {
    await withFetch(
      () => json(409, errorBody('seat_taken', { seatIds })),
      async () => {
        const error = await acquireHold(SHOWTIME, [SEAT_A], CLIENT, undefined, BASE).then(
          () => null,
          (e: unknown) => e
        );
        assert.ok(error instanceof MovieApiError);
        assert.equal(error.seatIds, undefined, JSON.stringify(seatIds));
        // Still a "taken": the server refused. The screen just cannot name the seats.
        assert.deepEqual(classifyHoldError(error), { kind: 'taken', seatIds: [], maybeHeld: false });
      }
    );
  }
});

test('503 holds_unavailable carries Retry-After and means the seats MAY be held', async () => {
  await withFetch(
    () => json(503, errorBody('holds_unavailable'), { 'Retry-After': '2' }),
    async () => {
      const error = await acquireHold(SHOWTIME, [SEAT_A], CLIENT, undefined, BASE).then(
        () => null,
        (e: unknown) => e
      );
      assert.ok(error instanceof MovieApiError);
      assert.equal(error.kind, 'holds_unavailable');
      assert.equal(error.retryAfterSeconds, 2);
      assert.equal(error.retryable, true);
      assert.deepEqual(classifyHoldError(error), { kind: 'unavailable', retryAfterMs: 2000, maybeHeld: true });
    }
  );
});

test('Retry-After: absent, an HTTP date, junk or huge falls back or is capped', () => {
  assert.equal(parseRetryAfter(null), undefined);
  assert.equal(parseRetryAfter(''), undefined);
  assert.equal(parseRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT'), undefined);
  assert.equal(parseRetryAfter('-5'), undefined);
  assert.equal(parseRetryAfter('1.5'), undefined);
  assert.equal(parseRetryAfter('2'), 2);
  assert.equal(parseRetryAfter(' 7 '), 7);
  assert.equal(parseRetryAfter('99999'), MAX_RETRY_AFTER_SECONDS, 'a header is network input: it is bounded');

  const noHeader = new MovieApiError('x', { status: 503, kind: 'holds_unavailable' });
  assert.deepEqual(classifyHoldError(noHeader), {
    kind: 'unavailable',
    retryAfterMs: DEFAULT_RETRY_AFTER_MS,
    maybeHeld: true,
  });
});

test('classifyHoldError: refused on purpose means nothing is held; no usable answer means maybe', () => {
  const rejected = (kind: ConstructorParameters<typeof MovieApiError>[1]['kind'], status: number) =>
    classifyHoldError(new MovieApiError('nope', { status, kind }));

  // The server answered and said no: nothing is held.
  assert.deepEqual(rejected('validation_failed', 400), { kind: 'rejected', message: 'nope', maybeHeld: false });
  assert.deepEqual(rejected('not_found', 404), { kind: 'rejected', message: 'nope', maybeHeld: false });
  assert.deepEqual(rejected('payload_too_large', 413), { kind: 'rejected', message: 'nope', maybeHeld: false });

  // No answer, or an answer that cannot be trusted: asking again is safe, leaving must release.
  assert.deepEqual(rejected('network_error', 0), { kind: 'uncertain', maybeHeld: true });
  assert.deepEqual(rejected('invalid_response', 201), { kind: 'uncertain', maybeHeld: true });
  assert.deepEqual(rejected('internal_error', 500), { kind: 'uncertain', maybeHeld: true });
  assert.deepEqual(rejected('service_unavailable', 503), { kind: 'uncertain', maybeHeld: true });
  assert.deepEqual(rejected('upstream_unavailable', 502), { kind: 'uncertain', maybeHeld: true });

  // Not even an API error (for example a TypeError thrown before the request): unknown, so cautious.
  assert.deepEqual(classifyHoldError(new TypeError('boom')), { kind: 'uncertain', maybeHeld: true });
  assert.deepEqual(classifyHoldError('weird'), { kind: 'uncertain', maybeHeld: true });
});

test('a network failure surfaces as network_error, and an abort is not swallowed', async () => {
  await withFetch(
    () => {
      throw new TypeError('Network request failed');
    },
    async () => {
      await assert.rejects(
        () => acquireHold(SHOWTIME, [SEAT_A], CLIENT, undefined, BASE),
        (err: unknown) => err instanceof MovieApiError && err.kind === 'network_error'
      );
    }
  );
  await withFetch(
    () => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    },
    async () => {
      await assert.rejects(
        () => acquireHold(SHOWTIME, [SEAT_A], CLIENT, undefined, BASE),
        (err: unknown) => err instanceof Error && err.name === 'AbortError'
      );
    }
  );
});

test('the seat map keeps its meaning of "overloaded": any 503 still counts, a 404 does not', () => {
  assert.equal(isServerOverloadedError(new MovieApiError('x', { status: 503, kind: 'service_unavailable' })), true);
  assert.equal(isServerOverloadedError(new MovieApiError('x', { status: 503, kind: 'holds_unavailable' })), true);
  assert.equal(isServerOverloadedError(new MovieApiError('x', { status: 404, kind: 'not_found' })), false);
});
