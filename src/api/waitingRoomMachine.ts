import { startHoldClock, type ClockReading, type HoldClock } from './holdClock';
import { MovieApiError, isRateLimitedError, isServerOverloadedError, retryAfterMs } from './movies';
import { isAdmitted, isWaiting, queuePollDelayMs, type QueueState } from './waitingRoom';

/**
 * The waiting room for one showing, with no React in it so it is unit-tested with `node --test` (there is no React
 * Native renderer in this repo, ADR 0005). It is `holdMachine.ts`'s sibling: the screen reads its state through a thin
 * hook (`useWaitingRoom`) and calls its methods; the network, the clocks, the timers and the random draw are all passed in.
 *
 *   idle ──start──▶ joining ──waiting──▶ waiting ──admitted──▶ admitted
 *                      │  └──admitted───────────────────────────▲
 *                      ├── overloaded ──▶ busy ──(Retry-After)──▶ joining / waiting
 *                      └── a dead end ──▶ failed ──retry──▶ joining
 *
 * What it does, in the order the rules were written (ADR 0017):
 *  - JOIN on `start()`. The server lets you straight in when there is room, so most people never see the line.
 *  - POLL while waiting: ask again after the server's `pollAfterMs`, bounded and jittered (waitingRoom.ts), so a long
 *    line asks less often and a crowd does not ask in step.
 *  - PAUSE when the app is in the background or the screen is covered (`setActive(false)`), and refresh at once on return.
 *    A place survives 90 s of silence on the server, so a short pause costs nothing.
 *  - TOLERATE two failures. A poll that fails once or twice keeps the last place on screen (marked out of date) and asks
 *    again shortly; the third in a row is shown (like the seat map's `POLL_FAILURES_BEFORE_ERROR`, seatsPolling.ts).
 *    An overloaded server answering a JOIN is shown at once: nothing is lost by showing it, there is no place to keep.
 *  - REJOIN quietly when the pass or the place is gone (`rejoin()` after a 403 from the seat map or a hold, or a poll that
 *    answers `not_queued`). The person sees nothing unless the line is no longer empty.
 *  - LEAVE on `detach()` (the screen going away) or `leave()` ("Leave the queue"): give the place or the pass back, so a
 *    person who walks away does not make the people behind them wait.
 *
 * Once ADMITTED the machine stops asking: the seat-map polls are the pass's heartbeat (the server renews it on each one).
 *
 * There is no estimated wait here or in the contract. `ahead` is all the person is told (D4).
 */

export type WaitingRoomPhase = 'idle' | 'joining' | 'waiting' | 'admitted' | 'busy' | 'failed';

/** Why the room cannot be used right now. `not_found` is a showing that does not exist; everything else is `error`. */
export interface WaitingRoomFailure {
  kind: 'not_found' | 'error';
  message: string;
}

export interface WaitingRoomState {
  phase: WaitingRoomPhase;
  /** People in front of you while `waiting` (0 = you are next). Kept while a refresh is failing. */
  ahead: number | null;
  /** `waiting` only: the last refresh failed, so `ahead` may be out of date. Clears on the next good answer. */
  stale: boolean;
  /** A place is being re-established in the background (a 403, or a lost place). The screen shows nothing for it. */
  rejoining: boolean;
  /** `busy` only: the running countdown to the next try, seeded from the server's `Retry-After`. */
  retry: HoldClock | null;
  /** `busy` only: the next try is being made right now. */
  retrying: boolean;
  /**
   * The latest admission, or null. `id` rises with each, so a screen that renders the same state twice can tell "already
   * handled" from "new". `waited` is true when the person stood in the line first (the "Your turn" moment), false when the
   * room had space and they were let straight in (nothing to celebrate).
   */
  admission: { id: number; waited: boolean } | null;
  /** `failed` only: what to tell the person. */
  failure: WaitingRoomFailure | null;
}

export interface WaitingRoomDeps {
  /** `POST /queue`. Throws a `MovieApiError` on any refusal or failure. */
  join(): Promise<QueueState>;
  /** `GET /queue`. */
  poll(): Promise<QueueState>;
  /** `DELETE /queue`. Its result and its failures are not needed: leaving is best effort. */
  leave(): Promise<unknown>;
  now(): ClockReading;
  /** Runs `callback` after `delayMs`; returns a function that cancels it. */
  schedule(callback: () => void, delayMs: number): () => void;
  /** A number from 0 up to (not including) 1, e.g. `Math.random()`. */
  random(): number;
}

export interface WaitingRoomController {
  getState(): WaitingRoomState;
  subscribe(listener: () => void): () => void;
  /** Join the line. Ignored unless `idle`. */
  start(): void;
  /** "Leave the queue": give the place back and return to `idle`. The screen then goes back. */
  leave(): void;
  /** The pass or the place is gone (403 from the seat map or a hold). Quietly join again. Ignored unless `admitted`. */
  rejoin(): void;
  /** "Try again now" while `busy`, or "Try again" after a dead end. */
  retry(): void;
  /** False while the app is in the background or the screen is covered: no asking. True again: refresh at once. */
  setActive(active: boolean): void;
  /** The screen is going away: give back whatever the server may be keeping. Reversible with `attach`. */
  detach(): void;
  attach(): void;
}

/** Failures in a row that are kept quiet (the last good place stays on screen). The next one is shown. */
export const TOLERATED_FAILURES = 2;
/** How long to wait before trying again after a failure that came with no `Retry-After`. Jittered like a poll. */
export const FAILURE_RETRY_MS = 2_000;

const IDLE: WaitingRoomState = {
  phase: 'idle',
  ahead: null,
  stale: false,
  rejoining: false,
  retry: null,
  retrying: false,
  admission: null,
  failure: null,
};

type Operation = 'join' | 'poll';

/** An attempt that is waiting for its time (or for the app to come back to the foreground). */
interface PendingAttempt {
  op: Operation;
  /** On the monotonic clock. */
  dueMono: number;
  /** `busy`: the server asked for this wait, so coming back early does not skip it. Everything else refreshes at once. */
  honourDue: boolean;
}

/** "Too many requests" and "the server is busy" are the same thing to a person: wait, and we try again for them. */
function isBusy(error: MovieApiError): boolean {
  return isServerOverloadedError(error) || isRateLimitedError(error);
}

export function createWaitingRoomController(deps: WaitingRoomDeps): WaitingRoomController {
  let state: WaitingRoomState = IDLE;
  let attached = true;
  /** "Leave the queue" was pressed: a request still in flight gives its place straight back when it lands. */
  let left = false;
  let active = true;
  let admissionSeq = 0;
  /** Failures in a row, reset by any good answer. */
  let failures = 0;
  /** What to ask next: `join` until we have a place, `poll` while we hold one. */
  let nextOp: Operation = 'join';
  /** The person stood in the line (was shown `waiting`) since the last admission. */
  let hasWaited = false;
  /** A join has been sent and the server may be keeping a place or a pass for us. */
  let mayHoldPlace = false;
  let requestInFlight = false;
  let pending: PendingAttempt | null = null;
  let cancelTimer: (() => void) | null = null;
  const listeners = new Set<() => void>();

  function setState(next: WaitingRoomState): void {
    state = next;
    for (const listener of [...listeners]) listener();
  }

  function patch(changes: Partial<WaitingRoomState>): void {
    setState({ ...state, ...changes });
  }

  function clearTimer(): void {
    cancelTimer?.();
    cancelTimer = null;
  }

  /** Best effort and silent: a failed leave is covered by the server's own timeouts (a place lapses after 90 s of silence). */
  function leaveQuietly(): void {
    if (!mayHoldPlace) return;
    mayHoldPlace = false;
    try {
      deps.leave().catch(() => {});
    } catch {
      // deps.leave threw before returning a promise: nothing more can be done.
    }
  }

  /** Ask again after `delayMs`, or when the app returns if it is in the background right now. */
  function scheduleAttempt(op: Operation, delayMs: number, honourDue = false): void {
    clearTimer();
    pending = { op, dueMono: deps.now().mono + delayMs, honourDue };
    if (!active) return;
    cancelTimer = deps.schedule(runPending, delayMs);
  }

  function runPending(): void {
    cancelTimer = null;
    const due = pending;
    pending = null;
    if (!due || !attached) return;
    void attempt(due.op);
  }

  function admit(): void {
    const waited = hasWaited;
    hasWaited = false;
    failures = 0;
    pending = null;
    clearTimer();
    nextOp = 'poll';
    setState({
      ...IDLE,
      phase: 'admitted',
      admission: { id: ++admissionSeq, waited },
    });
  }

  function apply(answer: QueueState, op: Operation): void {
    // A JOIN never answers not_queued. Count it as a failed attempt (so it is not reset below) rather than trusting it.
    if (op === 'join' && !isAdmitted(answer) && !isWaiting(answer)) {
      handleFailure(new MovieApiError('The waiting room gave an unexpected answer.', { status: 200, kind: 'invalid_response', retryable: true }), op);
      return;
    }
    failures = 0;
    if (isAdmitted(answer)) {
      admit();
      return;
    }
    if (isWaiting(answer)) {
      hasWaited = true;
      nextOp = 'poll';
      setState({ ...IDLE, phase: 'waiting', ahead: answer.ahead, admission: state.admission });
      scheduleAttempt('poll', queuePollDelayMs(answer.pollAfterMs, deps.random()));
      return;
    }
    // not_queued, to a poll: we lost the place (silent for longer than the server keeps it, or it was cleared). Join
    // again, quietly: the screen keeps what it shows until the join answers.
    nextOp = 'join';
    patch({ rejoining: true });
    void attempt('join');
  }

  function showFailure(error: MovieApiError): void {
    clearTimer();
    pending = null;
    setState({
      ...IDLE,
      phase: 'failed',
      admission: state.admission,
      failure: { kind: error.kind === 'not_found' ? 'not_found' : 'error', message: error.message },
    });
  }

  function showBusy(error: MovieApiError, op: Operation): void {
    const waitMs = retryAfterMs(error, FAILURE_RETRY_MS);
    nextOp = op;
    setState({
      ...IDLE,
      phase: 'busy',
      // The place we last showed, if any, is no longer vouched for; the countdown replaces it.
      retry: startHoldClock(waitMs, deps.now()),
      admission: state.admission,
    });
    scheduleAttempt(op, waitMs, true);
  }

  function handleFailure(error: unknown, op: Operation): void {
    // Not even an API error (a TypeError thrown before the request): unknown, so treat it like no answer.
    const failure =
      error instanceof MovieApiError
        ? error
        : new MovieApiError('Could not reach the Matinee server.', { status: 0, kind: 'network_error', retryable: true });
    failures += 1;

    const busy = isBusy(failure);
    // A refusal the server made on purpose that trying again cannot change (a showing that does not exist, a bad id, an
    // answer the app cannot read): show it now. Anything that can pass (no answer, a 5xx, "busy") is waited out.
    if (!busy && !failure.retryable && failure.status < 500) {
      showFailure(failure);
      return;
    }

    // Something is on screen that a quiet retry keeps: a place in the line, or a map under a rejoin in progress.
    const somethingToKeep = state.phase === 'waiting' || state.phase === 'admitted';
    if (failures <= TOLERATED_FAILURES && (somethingToKeep || !busy)) {
      // Kept quiet: the last place stays (marked out of date) and we ask again shortly.
      if (state.phase === 'waiting') patch({ stale: true });
      scheduleAttempt(op, busy ? retryAfterMs(failure, FAILURE_RETRY_MS) : queuePollDelayMs(FAILURE_RETRY_MS, deps.random()));
      return;
    }

    if (busy) showBusy(failure, op);
    else showFailure(failure);
  }

  async function attempt(op: Operation): Promise<void> {
    if (!attached || requestInFlight) return;
    requestInFlight = true;
    if (op === 'join') mayHoldPlace = true;
    if (state.phase === 'busy') patch({ retrying: true });

    let answer: QueueState;
    try {
      answer = await (op === 'join' ? deps.join() : deps.poll());
    } catch (error) {
      requestInFlight = false;
      if (!attached || left) {
        // The screen left while this was in flight and the server may have taken us in: give it back.
        leaveQuietly();
        return;
      }
      handleFailure(error, op);
      return;
    }

    requestInFlight = false;
    if (!attached || left) {
      leaveQuietly();
      return;
    }
    apply(answer, op);
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    start() {
      if (!attached || state.phase !== 'idle') return;
      left = false;
      failures = 0;
      nextOp = 'join';
      hasWaited = false;
      setState({ ...IDLE, phase: 'joining' });
      void attempt('join');
    },

    leave() {
      if (!attached) return;
      left = true;
      clearTimer();
      pending = null;
      // A request in flight cleans up after itself when it lands (see `attempt`): a leave sent now could reach the
      // server BEFORE the join and give back nothing.
      if (requestInFlight) mayHoldPlace = true;
      else leaveQuietly();
      setState({ ...IDLE, admission: state.admission });
    },

    rejoin() {
      if (!attached || state.phase !== 'admitted' || state.rejoining || requestInFlight) return;
      failures = 0;
      nextOp = 'join';
      patch({ rejoining: true });
      void attempt('join');
    },

    retry() {
      if (!attached || requestInFlight) return;
      if (state.phase === 'busy') {
        clearTimer();
        pending = null;
        void attempt(nextOp);
      } else if (state.phase === 'failed') {
        failures = 0;
        nextOp = 'join';
        hasWaited = false;
        setState({ ...IDLE, phase: 'joining', admission: state.admission });
        void attempt('join');
      }
    },

    setActive(next) {
      if (active === next) return;
      active = next;
      if (!next) {
        clearTimer();
        return;
      }
      if (!attached || requestInFlight || !pending) return;
      // Back in the foreground. The server keeps a place through short silences, but the answer may have changed (we may
      // have been let in), so ask now. A `busy` wait is the server's own request, so only its remainder is skipped if
      // it has already passed.
      const due = pending;
      const waitMs = due.honourDue ? Math.max(0, due.dueMono - deps.now().mono) : 0;
      if (waitMs > 0) {
        scheduleAttempt(due.op, waitMs, true);
        return;
      }
      pending = null;
      void attempt(due.op);
    },

    detach() {
      if (!attached) return;
      attached = false;
      clearTimer();
      pending = null;
      // A request still in flight cleans up after itself when it lands (see `attempt`).
      if (!requestInFlight) leaveQuietly();
      state = IDLE;
    },

    attach() {
      attached = true;
    },
  };
}
