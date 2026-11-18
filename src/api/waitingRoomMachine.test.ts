import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remainingMs } from './holdClock';
import { MovieApiError } from './movies';
import {
  FAILURE_RETRY_MS,
  TOLERATED_FAILURES,
  createWaitingRoomController,
  type WaitingRoomDeps,
  type WaitingRoomState,
} from './waitingRoomMachine';
import type { QueueState } from './waitingRoom';

const admitted: QueueState = { status: 'admitted', passExpiresInMs: 30_000 };
const waiting = (ahead: number, pollAfterMs = 3_000): QueueState => ({ status: 'waiting', ahead, pollAfterMs });
const notQueued: QueueState = { status: 'not_queued' };

const offline = () => new MovieApiError('offline', { status: 0, kind: 'network_error' });
const busy = (retryAfterSeconds?: number) => new MovieApiError('busy', { status: 503, kind: 'server_busy', retryAfterSeconds });
const roomFull = (retryAfterSeconds?: number) =>
  new MovieApiError('full', { status: 503, kind: 'waiting_room_full', retryAfterSeconds });
const limited = (retryAfterSeconds?: number) => new MovieApiError('slow down', { status: 429, kind: 'rate_limited', retryAfterSeconds });
const missing = () => new MovieApiError('no such showing', { status: 404, kind: 'not_found' });
const broken = () => new MovieApiError('oops', { status: 500, kind: 'internal_error' });
const unreadable = () => new MovieApiError('unreadable', { status: 200, kind: 'invalid_response', retryable: false });

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

/** A controller on a fake network, fake clocks, fake timers and a scripted random source, so every sequence is exact and instant. */
function harness() {
  let mono = 1_000;
  let wall = 1_763_328_000_000;
  const timers: { at: number; delay: number; run: () => void; cancelled: boolean }[] = [];
  const requests: { op: 'join' | 'poll'; reply: Deferred<QueueState> }[] = [];
  const calls = { join: 0, poll: 0, leave: 0 };
  const behaviour = { leaveFails: false, random: 0.5 };

  const deps: WaitingRoomDeps = {
    join: () => {
      calls.join += 1;
      const reply = deferred<QueueState>();
      requests.push({ op: 'join', reply });
      return reply.promise;
    },
    poll: () => {
      calls.poll += 1;
      const reply = deferred<QueueState>();
      requests.push({ op: 'poll', reply });
      return reply.promise;
    },
    leave: () => {
      calls.leave += 1;
      return behaviour.leaveFails ? Promise.reject(new Error('leave failed')) : Promise.resolve({ status: 'not_queued' });
    },
    now: () => ({ mono, wall }),
    schedule: (callback, delayMs) => {
      const timer = { at: mono + delayMs, delay: delayMs, run: callback, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    random: () => behaviour.random,
  };
  const controller = createWaitingRoomController(deps);

  const states: WaitingRoomState[] = [];
  controller.subscribe(() => states.push(controller.getState()));

  /** Moves time on, firing any timer that falls due, in order. */
  function advance(ms: number): void {
    const target = mono + ms;
    for (;;) {
      const due = timers.filter((t) => !t.cancelled && t.at <= target).sort((x, y) => x.at - y.at)[0];
      if (!due) break;
      mono = due.at;
      wall = 1_763_328_000_000 + (mono - 1_000);
      due.cancelled = true;
      due.run();
    }
    mono = target;
    wall = 1_763_328_000_000 + (mono - 1_000);
  }

  const live = () => timers.filter((t) => !t.cancelled);
  /** The delay the most recent live timer was scheduled with. */
  const scheduledDelay = () => live().at(-1)?.delay;

  /** Answers the newest unanswered request of this kind. */
  async function answer(op: 'join' | 'poll', value: QueueState): Promise<void> {
    const request = [...requests].reverse().find((r) => r.op === op);
    assert.ok(request, `no ${op} request has been sent`);
    request.reply.resolve(value);
    await flush();
  }
  async function fail(op: 'join' | 'poll', error: unknown): Promise<void> {
    const request = [...requests].reverse().find((r) => r.op === op);
    assert.ok(request, `no ${op} request has been sent`);
    request.reply.reject(error);
    await flush();
  }

  return { controller, calls, behaviour, advance, live, scheduledDelay, answer, fail, states, now: () => ({ mono, wall }) };
}

type Harness = ReturnType<typeof harness>;

/** Joins, is told to wait, and settles there. */
async function waitInLine(h: Harness, ahead = 12, pollAfterMs = 3_000): Promise<void> {
  h.controller.start();
  await h.answer('join', waiting(ahead, pollAfterMs));
}

// ---- Joining and being let in ---------------------------------------------------------------------

test('starting: idle, then joining, then admitted straight away when the room has space, with nothing to celebrate', async () => {
  const h = harness();
  assert.equal(h.controller.getState().phase, 'idle');

  h.controller.start();
  assert.equal(h.controller.getState().phase, 'joining');
  assert.deepEqual(h.calls, { join: 1, poll: 0, leave: 0 });

  await h.answer('join', admitted);
  const state = h.controller.getState();
  assert.equal(state.phase, 'admitted');
  assert.deepEqual(state.admission, { id: 1, waited: false });
  assert.equal(state.ahead, null);
  assert.equal(h.live().length, 0, 'admitted: no timer. The seat-map polls are the pass heartbeat now');
});

test('a second start while one is running does nothing: exactly one join', async () => {
  const h = harness();
  h.controller.start();
  h.controller.start();
  assert.equal(h.calls.join, 1);
  await h.answer('join', waiting(3));
  h.controller.start();
  assert.equal(h.calls.join, 1);
});

test('told to wait: waiting with the number of people ahead and nothing else about time', async () => {
  const h = harness();
  await waitInLine(h, 12);
  const state = h.controller.getState();
  assert.equal(state.phase, 'waiting');
  assert.equal(state.ahead, 12);
  assert.equal(state.stale, false);
  assert.equal(state.rejoining, false);
  // The state has no field that could hold an estimated wait (D4): it is position only.
  assert.deepEqual(Object.keys(state).sort(), ['admission', 'ahead', 'failure', 'phase', 'rejoining', 'retry', 'retrying', 'stale']);
});

test('the line moves: each poll updates the place, then being let in says it was a turn after waiting', async () => {
  const h = harness();
  await waitInLine(h, 12);

  h.advance(3_000);
  assert.equal(h.calls.poll, 1);
  await h.answer('poll', waiting(7));
  assert.equal(h.controller.getState().ahead, 7);

  h.advance(3_000);
  await h.answer('poll', waiting(0));
  assert.equal(h.controller.getState().ahead, 0, '0 ahead is "you are next", still waiting');
  assert.equal(h.controller.getState().phase, 'waiting');

  h.advance(3_000);
  await h.answer('poll', admitted);
  const state = h.controller.getState();
  assert.equal(state.phase, 'admitted');
  assert.deepEqual(state.admission, { id: 1, waited: true }, 'they waited, so the screen says "Your turn"');
  assert.equal(h.live().length, 0, 'no more asking once admitted');
});

// ---- When to ask again ----------------------------------------------------------------------------

test('each poll waits the server number of that answer, so a long line asks less often', async () => {
  const h = harness();
  await waitInLine(h, 400, 15_000);
  assert.equal(h.scheduledDelay(), 15_000);

  h.advance(15_000);
  await h.answer('poll', waiting(150, 9_000));
  assert.equal(h.scheduledDelay(), 9_000);

  h.advance(9_000);
  await h.answer('poll', waiting(5, 3_000));
  assert.equal(h.scheduledDelay(), 3_000);
});

test('the wait is jittered by the random draw, inside plus or minus 20 percent', async () => {
  for (const [draw, expected] of [
    [0, 2_400],
    [0.5, 3_000],
    [0.999999, 3_600],
  ] as const) {
    const h = harness();
    h.behaviour.random = draw;
    await waitInLine(h, 12, 3_000);
    assert.equal(h.scheduledDelay(), expected, `draw ${draw}`);
  }
});

test('a poll delay from the server that is absurdly small is raised, so the phone cannot hammer the server', async () => {
  const h = harness();
  h.behaviour.random = 0;
  await waitInLine(h, 12, 1);
  assert.equal(h.scheduledDelay(), 800, '1 s floor, minus the 20 percent jitter at most');
  h.advance(799);
  assert.equal(h.calls.poll, 0);
  h.advance(2);
  assert.equal(h.calls.poll, 1);
});

test('only one poll is in flight at a time: a slow answer is not asked again', async () => {
  const h = harness();
  await waitInLine(h, 12);
  h.advance(3_000);
  assert.equal(h.calls.poll, 1);
  h.advance(60_000);
  assert.equal(h.calls.poll, 1, 'no timer runs while the answer is outstanding');
  await h.answer('poll', waiting(11));
  assert.equal(h.live().length, 1, 'and the next poll is scheduled from the answer');
});

// ---- Background and foreground --------------------------------------------------------------------

test('in the background it asks for nothing, and on return it asks at once', async () => {
  const h = harness();
  await waitInLine(h, 12);

  h.advance(1_000);
  h.controller.setActive(false);
  assert.equal(h.live().length, 0, 'the poll timer is cancelled');
  h.advance(10 * 60_000);
  assert.equal(h.calls.poll, 0, 'nothing is sent while paused');
  assert.equal(h.controller.getState().phase, 'waiting', 'the place on screen is untouched');

  h.controller.setActive(true);
  assert.equal(h.calls.poll, 1, 'refreshed the moment the app came back');
  await h.answer('poll', waiting(2));
  assert.equal(h.controller.getState().ahead, 2);
  assert.equal(h.live().length, 1, 'and the cadence carries on');
});

test('coming back twice, or while a poll is already running, sends one request', async () => {
  const h = harness();
  await waitInLine(h, 12);
  h.controller.setActive(false);
  h.controller.setActive(true);
  h.controller.setActive(true);
  assert.equal(h.calls.poll, 1);
  h.controller.setActive(false);
  h.controller.setActive(true);
  assert.equal(h.calls.poll, 1, 'the first is still outstanding');
});

test('an answer that lands while paused is applied, but the next poll waits for the app to return', async () => {
  const h = harness();
  await waitInLine(h, 12);
  h.advance(3_000);
  assert.equal(h.calls.poll, 1);
  h.controller.setActive(false);
  await h.answer('poll', waiting(9));
  assert.equal(h.controller.getState().ahead, 9);
  assert.equal(h.live().length, 0, 'no timer while paused');
  h.advance(60_000);
  assert.equal(h.calls.poll, 1);
  h.controller.setActive(true);
  assert.equal(h.calls.poll, 2);
});

test('admitted while the app was in the background is shown on return', async () => {
  const h = harness();
  await waitInLine(h, 1);
  h.controller.setActive(false);
  h.advance(30_000);
  h.controller.setActive(true);
  await h.answer('poll', admitted);
  assert.deepEqual(h.controller.getState().admission, { id: 1, waited: true });
});

test('pausing and resuming with nothing to ask changes nothing (idle, admitted)', async () => {
  const idle = harness();
  idle.controller.setActive(false);
  idle.controller.setActive(true);
  assert.deepEqual(idle.calls, { join: 0, poll: 0, leave: 0 });

  const done = harness();
  done.controller.start();
  await done.answer('join', admitted);
  done.controller.setActive(false);
  done.controller.setActive(true);
  assert.deepEqual(done.calls, { join: 1, poll: 0, leave: 0 });
});

// ---- Tolerating failures --------------------------------------------------------------------------

test('two failed polls keep the place on screen, marked out of date; the third is shown', async () => {
  assert.equal(TOLERATED_FAILURES, 2);
  const h = harness();
  await waitInLine(h, 12);

  h.advance(3_000);
  await h.fail('poll', offline());
  let state = h.controller.getState();
  assert.equal(state.phase, 'waiting', 'first failure: nothing changes but a quiet "out of date" mark');
  assert.equal(state.ahead, 12);
  assert.equal(state.stale, true);
  assert.equal(h.scheduledDelay(), FAILURE_RETRY_MS, 'and it asks again shortly');

  h.advance(FAILURE_RETRY_MS);
  await h.fail('poll', offline());
  state = h.controller.getState();
  assert.equal(state.phase, 'waiting', 'second failure: still kept');
  assert.equal(state.ahead, 12);

  h.advance(FAILURE_RETRY_MS);
  await h.fail('poll', offline());
  state = h.controller.getState();
  assert.equal(state.phase, 'failed', 'third in a row: shown');
  assert.equal(state.failure?.kind, 'error');
  assert.equal(h.live().length, 0, 'and it stops asking until the person presses Try again');
});

test('a good answer in between resets the count, so failures that are not in a row never add up', async () => {
  const h = harness();
  await waitInLine(h, 12);
  for (let round = 0; round < 3; round += 1) {
    h.advance(3_000);
    await h.fail('poll', offline());
    h.advance(FAILURE_RETRY_MS);
    await h.fail('poll', offline());
    h.advance(FAILURE_RETRY_MS);
    await h.answer('poll', waiting(11 - round)); // good again
    assert.equal(h.controller.getState().phase, 'waiting');
    assert.equal(h.controller.getState().stale, false, 'the "out of date" mark clears on a good answer');
    h.advance(3_000);
  }
  assert.equal(h.controller.getState().phase, 'waiting');
});

test('the retry after a failure is jittered like a poll and never faster than the floor', async () => {
  const h = harness();
  await waitInLine(h, 12);
  h.behaviour.random = 0;
  h.advance(3_000);
  await h.fail('poll', offline());
  assert.equal(h.scheduledDelay(), 1_600, '2 s minus 20 percent');
});

test('a 500 is waited out like a missing answer, not shown at once', async () => {
  const h = harness();
  await waitInLine(h, 12);
  h.advance(3_000);
  await h.fail('poll', broken());
  assert.equal(h.controller.getState().phase, 'waiting');
  assert.equal(h.controller.getState().stale, true);
});

test('a first join that fails without an answer is retried quietly twice, and the third is shown with Try again', async () => {
  const h = harness();
  h.controller.start();
  await h.fail('join', offline());
  assert.equal(h.controller.getState().phase, 'joining', 'still the skeleton');
  h.advance(FAILURE_RETRY_MS);
  assert.equal(h.calls.join, 2);
  await h.fail('join', offline());
  assert.equal(h.controller.getState().phase, 'joining');
  h.advance(FAILURE_RETRY_MS);
  assert.equal(h.calls.join, 3);
  await h.fail('join', offline());
  assert.equal(h.controller.getState().phase, 'failed');
  assert.equal(h.live().length, 0);

  h.controller.retry();
  assert.equal(h.controller.getState().phase, 'joining', 'Try again goes back to the skeleton');
  assert.equal(h.calls.join, 4);
  await h.answer('join', waiting(5));
  assert.equal(h.controller.getState().phase, 'waiting');
});

test('a failure that is not an API error at all is treated as no answer', async () => {
  const h = harness();
  await waitInLine(h, 12);
  h.advance(3_000);
  await h.fail('poll', new TypeError('boom'));
  assert.equal(h.controller.getState().stale, true);
  assert.equal(h.controller.getState().phase, 'waiting');
});

// ---- Things the server refuses on purpose ---------------------------------------------------------

test('a showing that does not exist is shown at once, with no retry scheduled', async () => {
  const h = harness();
  h.controller.start();
  await h.fail('join', missing());
  const state = h.controller.getState();
  assert.equal(state.phase, 'failed');
  assert.deepEqual(state.failure, { kind: 'not_found', message: 'no such showing' });
  assert.equal(h.live().length, 0);
});

test('an answer the app cannot read is shown at once and is not retried by itself', async () => {
  const h = harness();
  h.controller.start();
  await h.fail('join', unreadable());
  assert.equal(h.controller.getState().phase, 'failed');
  assert.equal(h.controller.getState().failure?.kind, 'error');
  assert.equal(h.live().length, 0);
});

// ---- Overload -------------------------------------------------------------------------------------

test('a busy server answering the JOIN is shown at once, with a countdown seeded from Retry-After', async () => {
  const h = harness();
  h.controller.start();
  await h.fail('join', busy(14));
  const state = h.controller.getState();
  assert.equal(state.phase, 'busy');
  assert.ok(state.retry);
  assert.equal(remainingMs(state.retry, h.now()), 14_000);
  assert.equal(state.retrying, false);
  assert.equal(h.scheduledDelay(), 14_000, 'it tries again for the person when the time is up');

  h.advance(5_000);
  assert.equal(remainingMs(h.controller.getState().retry!, h.now()), 9_000, 'the countdown runs down');
});

test('when the countdown ends it tries again by itself, and a good answer leaves the busy screen', async () => {
  const h = harness();
  h.controller.start();
  await h.fail('join', busy(14));
  h.advance(13_999);
  assert.equal(h.calls.join, 1);
  h.advance(2);
  assert.equal(h.calls.join, 2, 'the join is repeated');
  assert.equal(h.controller.getState().retrying, true);
  assert.equal(h.controller.getState().phase, 'busy');

  await h.answer('join', waiting(6));
  const state = h.controller.getState();
  assert.equal(state.phase, 'waiting');
  assert.equal(state.ahead, 6);
  assert.equal(state.retry, null);
  assert.equal(state.retrying, false);
});

test('"Try again now" does not wait for the countdown, and a busy answer again starts a fresh countdown', async () => {
  const h = harness();
  h.controller.start();
  await h.fail('join', busy(14));
  h.advance(2_000);

  h.controller.retry();
  assert.equal(h.calls.join, 2);
  assert.equal(h.controller.getState().retrying, true);
  assert.equal(h.live().length, 0, 'the old countdown timer is gone');

  await h.fail('join', busy(9));
  const state = h.controller.getState();
  assert.equal(state.phase, 'busy');
  assert.equal(state.retrying, false);
  assert.equal(remainingMs(state.retry!, h.now()), 9_000);
  assert.equal(h.scheduledDelay(), 9_000);
});

test('pressing "Try again now" twice sends one request', async () => {
  const h = harness();
  h.controller.start();
  await h.fail('join', busy(14));
  h.controller.retry();
  h.controller.retry();
  assert.equal(h.calls.join, 2);
});

test('a full waiting room is shown the same way', async () => {
  const h = harness();
  h.controller.start();
  await h.fail('join', roomFull(10));
  assert.equal(h.controller.getState().phase, 'busy');
  assert.equal(remainingMs(h.controller.getState().retry!, h.now()), 10_000);
});

test('too many requests (429) is shown the same way: wait, and try again for them', async () => {
  const h = harness();
  h.controller.start();
  await h.fail('join', limited(7));
  assert.equal(h.controller.getState().phase, 'busy');
  assert.equal(remainingMs(h.controller.getState().retry!, h.now()), 7_000);
});

test('no Retry-After on a busy answer falls back to 2 s rather than asking at once', async () => {
  const h = harness();
  h.controller.start();
  await h.fail('join', busy());
  assert.equal(remainingMs(h.controller.getState().retry!, h.now()), FAILURE_RETRY_MS);
});

test('a busy answer to a POLL in a line is kept quiet twice, waiting out Retry-After each time, and shown the third time', async () => {
  const h = harness();
  await waitInLine(h, 12);

  h.advance(3_000);
  await h.fail('poll', busy(11));
  assert.equal(h.controller.getState().phase, 'waiting', 'the place stays on screen');
  assert.equal(h.controller.getState().ahead, 12);
  assert.equal(h.scheduledDelay(), 11_000, 'and the server was asked to be left alone for 11 s');

  h.advance(11_000);
  await h.fail('poll', busy(11));
  assert.equal(h.controller.getState().phase, 'waiting');

  h.advance(11_000);
  await h.fail('poll', busy(12));
  const state = h.controller.getState();
  assert.equal(state.phase, 'busy', 'the third in a row is the "very busy" screen');
  assert.equal(remainingMs(state.retry!, h.now()), 12_000);

  h.advance(12_000);
  assert.equal(h.calls.poll, 4, 'it goes back to POLLING (the place is still ours), not to a join');
  assert.equal(h.calls.join, 1);
  await h.answer('poll', waiting(4));
  assert.equal(h.controller.getState().phase, 'waiting');
  assert.equal(h.controller.getState().ahead, 4);
});

test('a busy screen keeps its countdown through a spell in the background: only what is left is waited', async () => {
  const h = harness();
  h.controller.start();
  await h.fail('join', busy(14));
  h.advance(3_000);
  h.controller.setActive(false);
  assert.equal(h.live().length, 0);
  h.advance(5_000);
  assert.equal(h.calls.join, 1, 'nothing is sent while paused');

  h.controller.setActive(true);
  assert.equal(h.calls.join, 1, 'the server asked for 14 s and only 8 have passed: it is not skipped');
  assert.equal(h.scheduledDelay(), 6_000);
  h.advance(6_000);
  assert.equal(h.calls.join, 2);
});

test('a busy screen whose time ran out in the background tries at once on return', async () => {
  const h = harness();
  h.controller.start();
  await h.fail('join', busy(10));
  h.controller.setActive(false);
  h.advance(60_000);
  h.controller.setActive(true);
  assert.equal(h.calls.join, 2);
});

test('after the busy screen, a dead end from the retry is shown as such', async () => {
  const h = harness();
  h.controller.start();
  await h.fail('join', busy(5));
  h.advance(5_000);
  await h.fail('join', missing());
  assert.equal(h.controller.getState().phase, 'failed');
  assert.equal(h.controller.getState().failure?.kind, 'not_found');
});

// ---- Quiet re-joining -----------------------------------------------------------------------------

test('a 403 from the seat map or a hold: rejoin() joins again WITHOUT changing the screen, and it is not a turn', async () => {
  const h = harness();
  h.controller.start();
  await h.answer('join', admitted);

  h.controller.rejoin();
  let state = h.controller.getState();
  assert.equal(state.phase, 'admitted', 'the seat map stays on screen');
  assert.equal(state.rejoining, true);
  assert.equal(h.calls.join, 2);

  await h.answer('join', admitted);
  state = h.controller.getState();
  assert.equal(state.phase, 'admitted');
  assert.equal(state.rejoining, false);
  assert.deepEqual(state.admission, { id: 2, waited: false }, 'a new admission (so a held hold can resume) but nothing to celebrate');
});

test('rejoin() twice while the first is in flight sends one join', async () => {
  const h = harness();
  h.controller.start();
  await h.answer('join', admitted);
  h.controller.rejoin();
  h.controller.rejoin();
  assert.equal(h.calls.join, 2);
});

test('rejoin() does nothing unless the person is admitted: a stale 403 cannot disturb a line', async () => {
  const idle = harness();
  idle.controller.rejoin();
  assert.equal(idle.calls.join, 0);

  const queued = harness();
  await waitInLine(queued, 5);
  queued.controller.rejoin();
  assert.equal(queued.calls.join, 1);
  assert.equal(queued.controller.getState().rejoining, false);

  const joining = harness();
  joining.controller.start();
  joining.controller.rejoin();
  assert.equal(joining.calls.join, 1);
});

test('the line is no longer empty when we rejoin: the screen then moves to the waiting view, and being let in is a turn', async () => {
  const h = harness();
  h.controller.start();
  await h.answer('join', admitted);
  h.controller.rejoin();
  await h.answer('join', waiting(8));
  let state = h.controller.getState();
  assert.equal(state.phase, 'waiting');
  assert.equal(state.ahead, 8);
  assert.equal(state.rejoining, false);

  h.advance(3_000);
  await h.answer('poll', admitted);
  state = h.controller.getState();
  assert.equal(state.phase, 'admitted');
  assert.deepEqual(state.admission, { id: 2, waited: true });
});

test('a rejoin that fails is kept quiet twice (the seat map stays), then shown', async () => {
  const h = harness();
  h.controller.start();
  await h.answer('join', admitted);
  h.controller.rejoin();

  await h.fail('join', offline());
  assert.equal(h.controller.getState().phase, 'admitted');
  assert.equal(h.controller.getState().rejoining, true);
  h.advance(FAILURE_RETRY_MS);
  assert.equal(h.calls.join, 3);
  await h.fail('join', offline());
  assert.equal(h.controller.getState().phase, 'admitted');
  h.advance(FAILURE_RETRY_MS);
  await h.fail('join', offline());
  assert.equal(h.controller.getState().phase, 'failed');
});

test('a rejoin that finds the server busy waits out Retry-After while the map stays, then shows the busy screen', async () => {
  const h = harness();
  h.controller.start();
  await h.answer('join', admitted);
  h.controller.rejoin();
  await h.fail('join', busy(10));
  assert.equal(h.controller.getState().phase, 'admitted');
  assert.equal(h.scheduledDelay(), 10_000);
  h.advance(10_000);
  await h.fail('join', busy(10));
  h.advance(10_000);
  await h.fail('join', busy(10));
  assert.equal(h.controller.getState().phase, 'busy');
});

test('a poll that says not_queued (the place was lost) rejoins quietly: the old place stays on screen until the join answers', async () => {
  const h = harness();
  await waitInLine(h, 12);
  h.advance(3_000);
  await h.answer('poll', notQueued);

  let state = h.controller.getState();
  assert.equal(state.phase, 'waiting', 'nothing flashes');
  assert.equal(state.rejoining, true);
  assert.equal(h.calls.join, 2, 'a fresh join, not another poll');

  await h.answer('join', waiting(30));
  state = h.controller.getState();
  assert.equal(state.ahead, 30, 'the new place is shown');
  assert.equal(state.rejoining, false);
  assert.equal(h.live().length, 1, 'and polling carries on');
});

test('a poll that says not_queued and then a free room admits them, and they did wait', async () => {
  const h = harness();
  await waitInLine(h, 3);
  h.advance(3_000);
  await h.answer('poll', notQueued);
  await h.answer('join', admitted);
  assert.deepEqual(h.controller.getState().admission, { id: 1, waited: true });
});

test('a JOIN that answers not_queued cannot be right: it is counted as a failed try, not trusted', async () => {
  const h = harness();
  h.controller.start();
  await h.answer('join', notQueued);
  assert.equal(h.controller.getState().phase, 'joining');
  assert.equal(h.live().length, 1, 'and it tries again');
  h.advance(FAILURE_RETRY_MS);
  await h.answer('join', notQueued);
  h.advance(FAILURE_RETRY_MS);
  await h.answer('join', notQueued);
  assert.equal(h.controller.getState().phase, 'failed');
});

// ---- Leaving --------------------------------------------------------------------------------------

test('"Leave the queue" gives the place back once, stops asking, and returns to idle', async () => {
  const h = harness();
  await waitInLine(h, 12);
  h.controller.leave();
  assert.deepEqual(h.calls, { join: 1, poll: 0, leave: 1 });
  assert.equal(h.controller.getState().phase, 'idle');
  assert.equal(h.live().length, 0);
  h.advance(60_000);
  assert.equal(h.calls.poll, 0);

  h.controller.leave();
  h.controller.detach();
  assert.equal(h.calls.leave, 1, 'leaving twice, or leaving then unmounting, gives it back once');
});

test('leaving while the join is in flight waits for the answer, then gives back whatever it took', async () => {
  const h = harness();
  h.controller.start();
  h.controller.leave();
  assert.equal(h.calls.leave, 0, 'a leave sent now could reach the server BEFORE the join and release nothing');
  assert.equal(h.controller.getState().phase, 'idle');

  await h.answer('join', waiting(4));
  assert.equal(h.calls.leave, 1);
  assert.equal(h.controller.getState().phase, 'idle', 'the late answer does not bring the line back');
  assert.equal(h.live().length, 0);
});

test('leaving while the join is in flight, and it then fails without an answer: give back in case it landed', async () => {
  const h = harness();
  h.controller.start();
  h.controller.leave();
  await h.fail('join', offline());
  assert.equal(h.calls.leave, 1);
  assert.equal(h.live().length, 0, 'and it does not retry');
});

test('leaving while paused and while busy cancels the pending ask', async () => {
  const paused = harness();
  await waitInLine(paused, 12);
  paused.controller.setActive(false);
  paused.controller.leave();
  paused.controller.setActive(true);
  assert.equal(paused.calls.poll, 0);

  const overloaded = harness();
  overloaded.controller.start();
  await overloaded.fail('join', busy(5));
  overloaded.controller.leave();
  overloaded.advance(60_000);
  assert.equal(overloaded.calls.join, 1);
});

test('leaving gives back an admitted pass too, so the next person is not kept waiting for it to lapse', async () => {
  const h = harness();
  h.controller.start();
  await h.answer('join', admitted);
  h.controller.detach();
  assert.equal(h.calls.leave, 1);
});

test('the screen going away (detach) leaves once, stops everything, and leaving while idle sends nothing', async () => {
  const quiet = harness();
  quiet.controller.detach();
  assert.equal(quiet.calls.leave, 0, 'nothing was ever joined');

  const h = harness();
  await waitInLine(h, 12);
  h.controller.detach();
  h.controller.detach();
  assert.equal(h.calls.leave, 1);
  h.advance(60_000);
  assert.equal(h.calls.poll, 0);
});

test('a join that lands AFTER the screen has gone is given straight back, and the state does not move', async () => {
  const h = harness();
  h.controller.start();
  h.controller.detach();
  assert.equal(h.calls.leave, 0, 'not yet: the join has not answered');
  await h.answer('join', waiting(3));
  assert.equal(h.calls.leave, 1);
  assert.equal(h.controller.getState().phase, 'idle');
  assert.equal(h.live().length, 0);
});

test('detach then attach (React re-running an effect) leaves a working controller: the join in flight is kept', async () => {
  const h = harness();
  h.controller.attach();
  h.controller.start();
  h.controller.detach(); // the effect cleanup
  h.controller.attach(); // the effect runs again
  h.controller.start();
  assert.equal(h.calls.join, 1, 'no second join while the first is in flight');

  await h.answer('join', waiting(5));
  assert.equal(h.controller.getState().phase, 'waiting');
  assert.equal(h.calls.leave, 0, 'and nothing was given back, because the screen came straight back');
});

test('detach then attach after the line is settled starts again from idle with a leave and a fresh join', async () => {
  const h = harness();
  await waitInLine(h, 5);
  h.controller.detach();
  h.controller.attach();
  h.controller.start();
  assert.equal(h.calls.leave, 1);
  assert.equal(h.calls.join, 2);
});

test('a failing leave never throws or leaves an unhandled rejection', async () => {
  const h = harness();
  h.behaviour.leaveFails = true;
  await waitInLine(h, 12);
  h.controller.leave();
  await flush();
  assert.equal(h.calls.leave, 1);
  assert.equal(h.controller.getState().phase, 'idle');
});

test('a leave that throws before it returns a promise is swallowed too', async () => {
  const h = harness();
  const deps: WaitingRoomDeps = {
    join: () => Promise.resolve(waiting(2)),
    poll: () => Promise.resolve(waiting(2)),
    leave: () => {
      throw new Error('sync failure');
    },
    now: () => h.now(),
    schedule: () => () => {},
    random: () => 0.5,
  };
  const controller = createWaitingRoomController(deps);
  controller.start();
  await flush();
  assert.doesNotThrow(() => controller.leave());
});

test('a screen that has unsubscribed is not told about later changes', async () => {
  const h = harness();
  let notified = 0;
  const unsubscribe = h.controller.subscribe(() => {
    notified += 1;
  });
  h.controller.start();
  unsubscribe();
  const before = notified;
  await h.answer('join', waiting(2));
  assert.equal(notified, before);
});

// ---- Ids ------------------------------------------------------------------------------------------

test('admission ids rise, so a screen can tell a new admission from one it already handled', async () => {
  const h = harness();
  h.controller.start();
  await h.answer('join', admitted);
  assert.equal(h.controller.getState().admission?.id, 1);
  h.controller.rejoin();
  await h.answer('join', admitted);
  assert.equal(h.controller.getState().admission?.id, 2);
  h.controller.rejoin();
  await h.answer('join', admitted);
  assert.equal(h.controller.getState().admission?.id, 3);
});

test('the last admission survives a trip through the waiting view, so an effect does not replay it', async () => {
  const h = harness();
  h.controller.start();
  await h.answer('join', admitted);
  h.controller.rejoin();
  await h.answer('join', waiting(2));
  assert.equal(h.controller.getState().admission?.id, 1, 'unchanged while waiting: the old one, not a new one');
});
