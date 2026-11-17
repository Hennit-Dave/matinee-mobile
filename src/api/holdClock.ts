import { spokenCountdown } from '../components/countdownLogic';

/**
 * How long a seat hold has left, free of React Native so it is unit-tested with `node --test`.
 *
 * The server owns the hold's real expiry (a Redis TTL). The app only DISPLAYS a countdown and reacts when it
 * reaches zero, so the one rule that matters is: the countdown must never outlive the hold. Three choices
 * follow from it.
 *
 * 1. SEEDED FROM THE SERVER'S `expiresInMs`, not from `expiresAt`. `expiresAt` is a point on the server's clock;
 *    comparing it to the phone's clock would bake the phone's clock error into the countdown. `expiresInMs` is a
 *    DURATION ("this much is left, right now"), which needs no shared clock. The seed is taken when the response
 *    arrives, so the network trip makes the countdown at most a request longer than the hold, never shorter.
 *
 * 2. ELAPSED TIME IS THE LARGER OF TWO READINGS. A monotonic clock cannot be set back by the user but, on
 *    Android, stops while the phone is in deep sleep. The wall clock keeps running through sleep but can be
 *    moved. The larger elapsed time of the two is used, so neither a clock change nor a long sleep can make
 *    the countdown show more time than the hold has. (A wall clock moved FORWARD shortens the countdown, which
 *    errs in the safe direction: the app says the hold ended, and the seats can simply be chosen again.)
 *
 * 3. TIME LEFT IS ROUNDED UP to whole seconds for display, so "0:00" appears exactly when the hold ends rather
 *    than a second before.
 */

/** One reading of both clocks, in milliseconds. */
export interface ClockReading {
  /** Monotonic: `performance.now()`. */
  mono: number;
  /** Wall: `Date.now()`. */
  wall: number;
}

/** A running hold: how long it had left, and when (on both clocks) that was measured. */
export interface HoldClock {
  seedMs: number;
  start: ClockReading;
}

export function readClock(): ClockReading {
  return { mono: performance.now(), wall: Date.now() };
}

export function startHoldClock(expiresInMs: number, now: ClockReading): HoldClock {
  return { seedMs: Number.isFinite(expiresInMs) ? Math.max(0, expiresInMs) : 0, start: now };
}

/** Milliseconds left, never below 0 and never more than the seed. */
export function remainingMs(clock: HoldClock, now: ClockReading): number {
  const monoElapsed = now.mono - clock.start.mono;
  const wallElapsed = now.wall - clock.start.wall;
  const elapsed = Math.max(monoElapsed, wallElapsed, 0);
  return Math.max(0, clock.seedMs - elapsed);
}

/** Whole seconds to show: rounded up, so the display reaches 0 only when the hold has ended. */
export function secondsToShow(remaining: number): number {
  return remaining <= 0 ? 0 : Math.ceil(remaining / 1000);
}

/** A touch of slack so the timer fires just after the displayed second changes, not just before. */
const TICK_SLACK_MS = 2;

/** Milliseconds until the displayed second next changes (0 when there is nothing left to wait for). */
export function nextTickDelayMs(remaining: number): number {
  if (remaining <= 0) return 0;
  const shown = Math.ceil(remaining / 1000);
  return Math.max(remaining - (shown - 1) * 1000, 0) + TICK_SLACK_MS;
}

/**
 * Seconds left at which a screen reader is told the time. COMPONENTS.md: "Announce time left to screen readers
 * at sensible intervals, not every second."
 */
export const ANNOUNCE_AT_SECONDS: readonly number[] = [300, 120, 60, 30];

export const HOLD_ENDED_ANNOUNCEMENT = 'Your seat hold has ended.';

/**
 * What to say when the displayed time goes from `previous` to `next` seconds, or `null` for nothing. Each threshold
 * is announced once, as it is crossed (a long sleep that crosses several announces the time actually left, once),
 * and the end of the hold is announced.
 */
export function announcementFor(previous: number, next: number): string | null {
  if (next >= previous) return null;
  if (next <= 0) return previous > 0 ? HOLD_ENDED_ANNOUNCEMENT : null;
  const crossed = ANNOUNCE_AT_SECONDS.some((threshold) => previous > threshold && next <= threshold);
  return crossed ? spokenCountdown(next) : null;
}
