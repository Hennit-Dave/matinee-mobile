/**
 * When and how often the seat map refreshes while a screen is showing it (traffic slice 5b). Pure, so the
 * rules are unit-tested; `useShowtimeSeats` and `usePollActive` only wire them to TanStack Query and to the
 * app's focus and foreground state.
 *
 * Why short polling at all (RULES D5.5): seat availability has to feel live, and short polling needs nothing
 * the server does not already have, holds no socket open on a phone that keeps losing signal, and costs a phone
 * almost nothing while the screen is the only thing running. The cadence is the trade-off:
 */

/** Seconds between refreshes, on average. Fast enough that a taken seat usually shows before a second tap. */
export const SEATS_POLL_INTERVAL_MS = 5_000;

/**
 * Each wait is the interval plus or minus this share, chosen fresh every time. Clients that opened the screen
 * together (a queue for one showing) then drift apart instead of asking in step.
 */
export const SEATS_POLL_JITTER = 0.2;

/**
 * After this many refreshes in a row fail, the map is no longer drawn: the screen shows the error state.
 * One or two failures only mark the map as out of date (a dropped packet should not wipe a seat choice).
 * See `resolveSeatsViewStatus` in seats.ts.
 */
export const POLL_FAILURES_BEFORE_ERROR = 3;

/** `random` is a number from 0 up to (not including) 1, e.g. `Math.random()`. */
export function pollIntervalMs(random: number): number {
  const clamped = Math.min(Math.max(random, 0), 1);
  const spread = SEATS_POLL_INTERVAL_MS * SEATS_POLL_JITTER;
  return Math.round(SEATS_POLL_INTERVAL_MS - spread + clamped * 2 * spread);
}

/** The screen is on top AND the app is in the foreground. Anything else (another screen, background) pauses. */
export function isPollingActive(state: { focused: boolean; appState: string }): boolean {
  return state.focused && state.appState === 'active';
}

/**
 * How long to wait before the next refresh, or `false` for none.
 * No polling while paused, and none once the map has failed `POLL_FAILURES_BEFORE_ERROR` times in a row: the
 * error screen has a Try again button, and a phone with no signal should not keep retrying behind it.
 */
export function nextPollDelay(input: { active: boolean; consecutiveFailures: number; random: number }): number | false {
  if (!input.active) return false;
  if (input.consecutiveFailures >= POLL_FAILURES_BEFORE_ERROR) return false;
  return pollIntervalMs(input.random);
}

/** Coming back (to the screen or to the foreground) refreshes at once instead of waiting out the interval. */
export function shouldRefreshOnResume(wasActive: boolean, isActive: boolean): boolean {
  return !wasActive && isActive;
}
