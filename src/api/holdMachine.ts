import { remainingMs, startHoldClock, type ClockReading, type HoldClock } from './holdClock';
import { classifyHoldError, type HoldResponse } from './holds';
import type { HoldLimit } from './movies';

/**
 * The seat-hold flow for one showing, with no React in it so it is unit-tested with `node --test` (there is no
 * React Native renderer in this repo, ADR 0005). The screen reads its state through a thin hook
 * (`useSeatHold`) and calls its methods; the network, the clocks and the timers are all passed in.
 *
 *   idle ──acquire──▶ acquiring ──ok──▶ held ──countdown reaches 0──▶ expired ──chooseAgain──▶ idle
 *     ▲                  │  └─ refused or unclear ──▶ idle (with an `outcome` for the screen to explain)
 *     └──── release ("Change seats") ◀──── held
 *
 * What is NOT here: the seat picks (the screen owns them), the toasts, and the countdown pill. The controller
 * only knows which seats the server may be holding for this install, and makes sure they are given back.
 *
 * THE RULE THIS FILE EXISTS TO KEEP: if the server might be holding seats for us, leaving the screen asks it to
 * let them go (a hold is 10 minutes, so a forgotten one blocks other people). `maybeHeld` is that set:
 *   - a request in flight (it may land after we stop watching),
 *   - a request with no usable answer (network error, timeout), or a 503 from a Redis outage (a command sent just
 *     before the outage can still run later, ADR 0015),
 * and it is emptied by a confirmed hold (then `held` tracks the seats) or by a refusal the server made on purpose.
 * A 429 is such a refusal: the rate limiter answers before the hold script runs (ADR 0016), so nothing was held.
 * (A 503 is NOT: a command may already have been sent. The two look alike to the user and differ here.)
 * Releasing is idempotent and safe: the server only releases seats that are really ours.
 */

export type HoldPhase = 'idle' | 'acquiring' | 'held' | 'expired';

/**
 * Something the screen should explain once. `id` rises with each new outcome, so a screen that renders the same
 * state twice (React does) can tell "already shown" from "new".
 */
export type HoldOutcome =
  | { id: number; kind: 'taken'; seatIds: string[] }
  | { id: number; kind: 'unavailable' }
  | { id: number; kind: 'rateLimited' }
  | { id: number; kind: 'busy' }
  | { id: number; kind: 'needsPass' }
  | { id: number; kind: 'limitReached'; holdLimit: HoldLimit | null }
  | { id: number; kind: 'uncertain' }
  | { id: number; kind: 'rejected'; message: string };

export interface HoldState {
  phase: HoldPhase;
  /** The seats this hold concerns: being requested (`acquiring`), held, or just lost (`expired`). */
  seatIds: readonly string[];
  /** Only while `held`: the running countdown. */
  clock: HoldClock | null;
  /** The latest result the screen should explain, if any. */
  outcome: HoldOutcome | null;
}

export interface HoldDeps {
  /** `POST /holds`. Throws a `MovieApiError` on any refusal or failure. */
  acquire(seatIds: readonly string[]): Promise<HoldResponse>;
  /** `DELETE /holds`. Its result and its failures are not needed: releasing is best effort. */
  release(seatIds: readonly string[]): Promise<unknown>;
  now(): ClockReading;
  /** Runs `callback` after `delayMs`; returns a function that cancels it. */
  schedule(callback: () => void, delayMs: number): () => void;
}

export interface HoldController {
  getState(): HoldState;
  subscribe(listener: () => void): () => void;
  /**
   * Take a hold on these seats (all or nothing). Ignored unless `idle`, so a second tap while one is in flight
   * does nothing. After a `holds_unavailable` or `server_busy` (503) or a `rate_limited` (429) it waits out the
   * server's `Retry-After` before sending.
   */
  acquire(seatIds: readonly string[]): void;
  /** "Change seats": give the hold back at once and return to `idle`. Only meaningful while `held`. */
  release(): void;
  /** After the expiry sheet: back to `idle`. */
  chooseAgain(): void;
  /** Ends the hold if its time is up. Called by a timer and when the app returns to the foreground. */
  checkExpiry(): void;
  /** The screen is going away: give back anything the server may be holding. Reversible with `attach`. */
  detach(): void;
  attach(): void;
}

const IDLE: HoldState = { phase: 'idle', seatIds: [], clock: null, outcome: null };

/** `Omit` that keeps each member of a union separate, so `taken` keeps its `seatIds`. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function createHoldController(deps: HoldDeps): HoldController {
  let state: HoldState = IDLE;
  let attached = true;
  let outcomeSeq = 0;
  /** Do not send another hold before this moment on the monotonic clock (the server's `Retry-After`). */
  let gateUntilMono = 0;
  const maybeHeld = new Set<string>();
  /** A `POST /holds` has been sent and has not answered yet. */
  let requestInFlight = false;
  const listeners = new Set<() => void>();
  let cancelExpiryTimer: (() => void) | null = null;
  let cancelGateWait: (() => void) | null = null;

  function setState(next: HoldState): void {
    state = next;
    for (const listener of [...listeners]) listener();
  }

  function clearTimers(): void {
    cancelExpiryTimer?.();
    cancelExpiryTimer = null;
    cancelGateWait?.();
    cancelGateWait = null;
  }

  /** Best effort and silent: a failed release is covered by the hold's own expiry. */
  function releaseQuietly(seatIds: Iterable<string>): void {
    const ids = [...new Set(seatIds)];
    if (ids.length === 0) return;
    try {
      deps.release(ids).catch(() => {});
    } catch {
      // deps.release threw before returning a promise: nothing more can be done.
    }
  }

  function scheduleExpiryCheck(clock: HoldClock): void {
    cancelExpiryTimer?.();
    cancelExpiryTimer = deps.schedule(checkExpiry, remainingMs(clock, deps.now()) + 1);
  }

  function checkExpiry(): void {
    if (!attached || state.phase !== 'held' || !state.clock) return;
    if (remainingMs(state.clock, deps.now()) > 0) {
      scheduleExpiryCheck(state.clock); // a timer can fire early; look again
      return;
    }
    cancelExpiryTimer = null;
    const toRelease = [...state.seatIds, ...maybeHeld];
    maybeHeld.clear();
    setState({ phase: 'expired', seatIds: state.seatIds, clock: null, outcome: state.outcome });
    // The server's timer has very likely ended already; this covers the moment between the two clocks.
    releaseQuietly(toRelease);
  }

  function refuse(outcome: DistributiveOmit<HoldOutcome, 'id'>): void {
    setState({ phase: 'idle', seatIds: [], clock: null, outcome: { ...outcome, id: ++outcomeSeq } as HoldOutcome });
  }

  async function run(seatIds: string[]): Promise<void> {
    const added = seatIds.filter((id) => !maybeHeld.has(id));
    for (const id of added) maybeHeld.add(id);

    let response: HoldResponse;
    requestInFlight = true;
    try {
      response = await deps.acquire(seatIds);
    } catch (error) {
      requestInFlight = false;
      const failure = classifyHoldError(error);
      if (!failure.maybeHeld) for (const id of added) maybeHeld.delete(id);

      if (!attached) {
        releaseQuietly(maybeHeld);
        maybeHeld.clear();
        return;
      }
      if (failure.kind === 'taken') refuse({ kind: 'taken', seatIds: failure.seatIds });
      else if (failure.kind === 'rejected') refuse({ kind: 'rejected', message: failure.message });
      else if (failure.kind === 'needsPass') {
        // No pass for this showing (ADR 0017): the room refused before any hold was attempted. Nothing to wait for
        // here, so no gate: the screen joins the line again and asks for the hold once it is admitted.
        refuse({ kind: 'needsPass' });
      } else if (failure.kind === 'limitReached') {
        refuse({ kind: 'limitReached', holdLimit: failure.holdLimit });
      } else if (failure.kind === 'unavailable' || failure.kind === 'rateLimited' || failure.kind === 'busy') {
        // All three are "come back after Retry-After". They differ only in `maybeHeld` (handled above): a 503 or a
        // shed `server_busy` may have left a hold behind, a 429 cannot have.
        gateUntilMono = deps.now().mono + failure.retryAfterMs;
        refuse({ kind: failure.kind });
      } else refuse({ kind: 'uncertain' });
      return;
    }

    requestInFlight = false;
    if (!attached) {
      // The user left while the request was in flight and it succeeded: give the seats straight back.
      releaseQuietly([...response.seatIds, ...maybeHeld]);
      maybeHeld.clear();
      return;
    }

    maybeHeld.clear();
    const clock = startHoldClock(response.expiresInMs, deps.now());
    setState({ phase: 'held', seatIds: response.seatIds, clock, outcome: state.outcome });
    scheduleExpiryCheck(clock);
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    acquire(seatIds) {
      if (!attached || state.phase !== 'idle' || seatIds.length === 0) return;
      const ids = [...seatIds];
      setState({ phase: 'acquiring', seatIds: ids, clock: null, outcome: state.outcome });

      const wait = Math.max(0, gateUntilMono - deps.now().mono);
      if (wait > 0) {
        cancelGateWait = deps.schedule(() => {
          cancelGateWait = null;
          void run(ids);
        }, wait);
      } else {
        void run(ids);
      }
    },

    release() {
      if (!attached || state.phase !== 'held') return;
      const toRelease = [...state.seatIds, ...maybeHeld];
      maybeHeld.clear();
      clearTimers();
      setState({ phase: 'idle', seatIds: [], clock: null, outcome: state.outcome });
      releaseQuietly(toRelease);
    },

    chooseAgain() {
      if (state.phase !== 'expired') return;
      setState({ phase: 'idle', seatIds: [], clock: null, outcome: state.outcome });
    },

    checkExpiry,

    detach() {
      if (!attached) return;
      attached = false;
      clearTimers();
      // A request still in flight cleans up after itself when it lands (see `run`): a release sent now could
      // reach the server BEFORE the hold exists and release nothing.
      if (requestInFlight) return;
      const toRelease = [...(state.phase === 'held' ? state.seatIds : []), ...maybeHeld];
      maybeHeld.clear();
      releaseQuietly(toRelease);
      state = { ...IDLE, outcome: state.outcome };
    },

    attach() {
      attached = true;
    },
  };
}
