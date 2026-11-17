import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remainingMs } from './holdClock';
import { createHoldController, type HoldDeps, type HoldState } from './holdMachine';
import type { HoldResponse } from './holds';
import { MovieApiError } from './movies';

const SHOWTIME = '3f2c1b7e-6a1d-4c8e-9a52-0b1d2e3f4a5b';
const A = 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const B = 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const C = 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

function hold(seatIds: string[] = [A, B], expiresInMs = 600_000): HoldResponse {
  // expiresAt is deliberately nonsense (a year ago): the countdown must come from expiresInMs alone.
  return { showtimeId: SHOWTIME, seatIds, expiresAt: '2025-01-01T00:00:00.000Z', expiresInMs };
}

const taken = (...seatIds: string[]) => new MovieApiError('taken', { status: 409, kind: 'seat_taken', seatIds });
const unavailable = (retryAfterSeconds?: number) =>
  new MovieApiError('down', { status: 503, kind: 'holds_unavailable', retryAfterSeconds });
const offline = () => new MovieApiError('offline', { status: 0, kind: 'network_error' });
const refused = () => new MovieApiError('bad request', { status: 400, kind: 'validation_failed' });

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

/** A controller on a fake network, fake clocks and fake timers, so every sequence is exact and instant. */
function harness() {
  let mono = 1_000;
  let wall = 1_763_328_000_000;
  const timers: { at: number; run: () => void; cancelled: boolean }[] = [];
  const acquires: Deferred<HoldResponse>[] = [];
  const calls = { acquire: [] as string[][], release: [] as string[][] };
  const behaviour = { releaseFails: false };

  const deps: HoldDeps = {
    acquire: (seatIds) => {
      calls.acquire.push([...seatIds]);
      const next = deferred<HoldResponse>();
      acquires.push(next);
      return next.promise;
    },
    release: (seatIds) => {
      calls.release.push([...seatIds]);
      return behaviour.releaseFails ? Promise.reject(new Error('release failed')) : Promise.resolve({ released: seatIds });
    },
    now: () => ({ mono, wall }),
    schedule: (callback, delayMs) => {
      const timer = { at: mono + delayMs, run: callback, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  };
  const controller = createHoldController(deps);

  const states: HoldState[] = [];
  controller.subscribe(() => states.push(controller.getState()));

  /** Moves time on, firing any timer that falls due, in order. `wallMs` lets the two clocks disagree. */
  function advance(ms: number, wallMs: number = ms): void {
    const target = mono + ms;
    const wallTarget = wall + wallMs;
    for (;;) {
      const due = timers
        .filter((t) => !t.cancelled && t.at <= target)
        .sort((x, y) => x.at - y.at)[0];
      if (!due) break;
      mono = due.at;
      wall = wallTarget - (target - due.at) * (wallMs / (ms || 1));
      due.cancelled = true;
      due.run();
    }
    mono = target;
    wall = wallTarget;
  }

  const pendingTimers = () => timers.filter((t) => !t.cancelled).length;
  return { controller, calls, acquires, behaviour, advance, pendingTimers, states };
}

/** Takes a hold the quick way: ask, let the server answer, settle. */
async function holdSeats(h: ReturnType<typeof harness>, seatIds: string[] = [A, B]): Promise<void> {
  h.controller.acquire(seatIds);
  h.acquires.at(-1)!.resolve(hold(seatIds));
  await flush();
}

// ---- Taking a hold --------------------------------------------------------------------------------

test('Continue takes a hold: idle, then acquiring, then held, with the countdown seeded from expiresInMs', async () => {
  const h = harness();
  assert.equal(h.controller.getState().phase, 'idle');

  h.controller.acquire([A, B]);
  assert.equal(h.controller.getState().phase, 'acquiring');
  assert.deepEqual(h.controller.getState().seatIds, [A, B]);
  assert.deepEqual(h.calls.acquire, [[A, B]]);

  h.acquires[0]!.resolve(hold([A, B], 599_940));
  await flush();

  const state = h.controller.getState();
  assert.equal(state.phase, 'held');
  assert.deepEqual(state.seatIds, [A, B]);
  assert.ok(state.clock);
  assert.equal(remainingMs(state.clock, { mono: 1_000, wall: 1_763_328_000_000 }), 599_940, 'seeded from expiresInMs, not expiresAt');
  assert.deepEqual(h.states.map((s) => s.phase), ['acquiring', 'held']);
});

test('a second Continue while the first is in flight does nothing: exactly one request', async () => {
  const h = harness();
  h.controller.acquire([A]);
  h.controller.acquire([A]);
  h.controller.acquire([A, B]);
  assert.equal(h.calls.acquire.length, 1);
});

test('asking again while held changes nothing, and an empty pick is never sent', async () => {
  const h = harness();
  h.controller.acquire([]);
  assert.equal(h.calls.acquire.length, 0);
  assert.equal(h.controller.getState().phase, 'idle');

  await holdSeats(h);
  h.controller.acquire([C]);
  assert.equal(h.calls.acquire.length, 1);
  assert.deepEqual(h.controller.getState().seatIds, [A, B]);
});

// ---- Refusals -------------------------------------------------------------------------------------

test('409 seat_taken: back to idle with the seats named, and nothing is held so leaving sends no release', async () => {
  const h = harness();
  h.controller.acquire([A, B]);
  h.acquires[0]!.reject(taken(B));
  await flush();

  const state = h.controller.getState();
  assert.equal(state.phase, 'idle');
  assert.deepEqual(state.outcome, { id: 1, kind: 'taken', seatIds: [B] });

  h.controller.detach();
  assert.deepEqual(h.calls.release, [], 'a refusal means the server holds nothing of ours');
});

test('400 refused on purpose: an outcome with the message, nothing to release', async () => {
  const h = harness();
  h.controller.acquire([A]);
  h.acquires[0]!.reject(refused());
  await flush();
  assert.deepEqual(h.controller.getState().outcome, { id: 1, kind: 'rejected', message: 'bad request' });
  h.controller.detach();
  assert.deepEqual(h.calls.release, []);
});

test('503 holds_unavailable: idle with an outcome, and the NEXT attempt waits out Retry-After before it is sent', async () => {
  const h = harness();
  h.controller.acquire([A, B]);
  h.acquires[0]!.reject(unavailable(2));
  await flush();
  assert.equal(h.controller.getState().phase, 'idle');
  assert.equal(h.controller.getState().outcome?.kind, 'unavailable');

  h.controller.acquire([A, B]);
  assert.equal(h.controller.getState().phase, 'acquiring', 'the button shows it is working');
  assert.equal(h.calls.acquire.length, 1, 'but nothing is sent yet');

  h.advance(1_999);
  assert.equal(h.calls.acquire.length, 1, 'still inside the 2 s the server asked for');
  h.advance(2);
  assert.equal(h.calls.acquire.length, 2, 'sent once Retry-After has passed');

  h.acquires[1]!.resolve(hold([A, B]));
  await flush();
  assert.equal(h.controller.getState().phase, 'held');
});

test('503 without a Retry-After falls back to 2 s', async () => {
  const h = harness();
  h.controller.acquire([A]);
  h.acquires[0]!.reject(unavailable());
  await flush();
  h.controller.acquire([A]);
  h.advance(1_900);
  assert.equal(h.calls.acquire.length, 1);
  h.advance(200);
  assert.equal(h.calls.acquire.length, 2);
});

test('leaving while waiting out Retry-After cancels the wait and releases what the 503 may have left', async () => {
  const h = harness();
  h.controller.acquire([A, B]);
  h.acquires[0]!.reject(unavailable(2));
  await flush();
  h.controller.acquire([A, B]); // waiting
  h.controller.detach();
  h.advance(5_000);
  assert.equal(h.calls.acquire.length, 1, 'the delayed request is never sent');
  assert.deepEqual(h.calls.release, [[A, B]], 'a command sent just before the outage may still land: give it back');
});

test('no usable answer (offline): an "uncertain" outcome, retrying is allowed at once, and leaving releases', async () => {
  const h = harness();
  h.controller.acquire([A, B]);
  h.acquires[0]!.reject(offline());
  await flush();
  assert.deepEqual(h.controller.getState().outcome, { id: 1, kind: 'uncertain' });
  assert.equal(h.controller.getState().phase, 'idle');

  h.controller.detach();
  assert.deepEqual(h.calls.release, [[A, B]], 'the request may have been processed: release is idempotent and safe');
});

test('retrying after an uncertain failure that succeeds: held, and leaving then releases the seats once', async () => {
  const h = harness();
  h.controller.acquire([A, B]);
  h.acquires[0]!.reject(offline());
  await flush();

  h.controller.acquire([A, B]);
  assert.equal(h.calls.acquire.length, 2, 'no wait: only a 503 earns one');
  h.acquires[1]!.resolve(hold([A, B]));
  await flush();
  assert.equal(h.controller.getState().phase, 'held');

  h.controller.detach();
  assert.deepEqual(h.calls.release, [[A, B]], 'one release, not one per attempt');
});

test('outcome ids rise, so a screen can tell a new outcome from one it already showed', async () => {
  const h = harness();
  h.controller.acquire([A]);
  h.acquires[0]!.reject(taken(A));
  await flush();
  h.controller.acquire([B]);
  h.acquires[1]!.reject(taken(B));
  await flush();
  assert.equal(h.controller.getState().outcome?.id, 2);
});

// ---- Expiry ---------------------------------------------------------------------------------------

test('the hold ends when its time is up: held until the last millisecond, then expired, with one release', async () => {
  const h = harness();
  await holdSeats(h);

  h.advance(599_990);
  assert.equal(h.controller.getState().phase, 'held');
  h.advance(20);
  assert.equal(h.controller.getState().phase, 'expired');
  assert.deepEqual(h.controller.getState().seatIds, [A, B], 'the sheet still has the seats to show');
  assert.equal(h.controller.getState().clock, null);
  assert.deepEqual(h.calls.release, [[A, B]], 'covers the gap between the two clocks');
});

test('"Choose seats again" returns to idle, and leaving after expiry does not release a second time', async () => {
  const h = harness();
  await holdSeats(h);
  h.advance(601_000);
  h.controller.chooseAgain();
  assert.equal(h.controller.getState().phase, 'idle');
  assert.deepEqual(h.controller.getState().seatIds, []);

  h.controller.detach();
  assert.equal(h.calls.release.length, 1);
});

test('chooseAgain only applies after an expiry', async () => {
  const h = harness();
  await holdSeats(h);
  h.controller.chooseAgain();
  assert.equal(h.controller.getState().phase, 'held');
});

test('a timer that fires early just looks again, and the hold still ends on time', async () => {
  const h = harness();
  await holdSeats(h, [A]);
  h.advance(300_000);
  h.controller.checkExpiry(); // e.g. the app came back to the foreground
  assert.equal(h.controller.getState().phase, 'held');
  assert.ok(h.pendingTimers() >= 1, 'the expiry timer is still armed');
  h.advance(300_100);
  assert.equal(h.controller.getState().phase, 'expired');
});

test('a phone that slept (wall clock ran, monotonic did not) expires on return, via checkExpiry', async () => {
  const h = harness();
  await holdSeats(h, [A]);
  h.advance(1_000, 700_000); // 1 s on the monotonic clock, 700 s on the wall clock
  h.controller.checkExpiry();
  assert.equal(h.controller.getState().phase, 'expired');
});

test('a wall clock set back does not give time back', async () => {
  const h = harness();
  await holdSeats(h, [A]);
  h.advance(599_000, -3_600_000);
  h.advance(1_100, -1_100);
  assert.equal(h.controller.getState().phase, 'expired');
});

test('a hold that arrives with no time left expires at once', async () => {
  const h = harness();
  h.controller.acquire([A]);
  h.acquires[0]!.resolve(hold([A], 0));
  await flush();
  h.advance(5);
  assert.equal(h.controller.getState().phase, 'expired');
});

// ---- Change seats and leaving ---------------------------------------------------------------------

test('"Change seats" gives the hold back at once, returns to idle and stops the countdown timer', async () => {
  const h = harness();
  await holdSeats(h);
  h.controller.release();

  assert.equal(h.controller.getState().phase, 'idle');
  assert.deepEqual(h.calls.release, [[A, B]]);

  h.advance(700_000);
  assert.equal(h.controller.getState().phase, 'idle', 'the old timer must not turn this into an expiry');
  assert.equal(h.calls.release.length, 1);
});

test('release does nothing unless a hold is held', async () => {
  const h = harness();
  h.controller.release();
  assert.deepEqual(h.calls.release, []);
});

test('leaving while held releases the seats, once, and leaving twice is harmless', async () => {
  const h = harness();
  await holdSeats(h);
  h.controller.detach();
  h.controller.detach();
  assert.deepEqual(h.calls.release, [[A, B]]);
  h.advance(700_000);
  assert.equal(h.calls.release.length, 1, 'the expiry timer was cancelled with the screen');
});

test('leaving while idle sends nothing', async () => {
  const h = harness();
  h.controller.detach();
  assert.deepEqual(h.calls.release, []);
});

test('leaving while the request is in flight: no early release, then the seats are given back the moment it succeeds', async () => {
  const h = harness();
  h.controller.acquire([A, B]);
  h.controller.detach();
  assert.deepEqual(h.calls.release, [], 'a release now could reach the server before the hold exists');

  h.acquires[0]!.resolve(hold([A, B]));
  await flush();
  assert.deepEqual(h.calls.release, [[A, B]]);
  assert.notEqual(h.controller.getState().phase, 'held', 'a screen that is gone is not shown a hold');
  h.advance(700_000);
  assert.equal(h.calls.release.length, 1, 'and no countdown was started for it');
});

test('leaving while the request is in flight, and it then fails without an answer: release in case it landed', async () => {
  const h = harness();
  h.controller.acquire([A]);
  h.controller.detach();
  h.acquires[0]!.reject(offline());
  await flush();
  assert.deepEqual(h.calls.release, [[A]]);
});

test('leaving while the request is in flight, and it is refused (409): nothing to release', async () => {
  const h = harness();
  h.controller.acquire([A]);
  h.controller.detach();
  h.acquires[0]!.reject(taken(A));
  await flush();
  assert.deepEqual(h.calls.release, []);
});

test('a failing release never throws or leaves an unhandled rejection (the hold simply expires on its own)', async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    const h = harness();
    h.behaviour.releaseFails = true;
    await holdSeats(h);
    h.controller.release();
    await holdSeats(h, [C]);
    h.controller.detach();
    h.advance(700_000);
    await flush();
    await flush();
    assert.equal(h.calls.release.length, 2, 'both releases were attempted');
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('detach then attach (React re-running an effect) leaves a working controller', async () => {
  const h = harness();
  h.controller.detach();
  h.controller.attach();
  await holdSeats(h);
  assert.equal(h.controller.getState().phase, 'held');
});

test('a screen that has unsubscribed is not told about later changes', async () => {
  const h = harness();
  let calls = 0;
  const unsubscribe = h.controller.subscribe(() => {
    calls += 1;
  });
  h.controller.acquire([A]);
  assert.equal(calls, 1);
  unsubscribe();
  h.acquires[0]!.resolve(hold([A]));
  await flush();
  assert.equal(calls, 1);
});
