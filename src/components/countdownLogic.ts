/**
 * The seat-hold Countdown's decisions, free of React Native so they can be unit-tested. The component
 * is presentational: it is given the seconds left and draws them. Nothing here ticks a clock; the live
 * hold and its timer belong to the traffic slice.
 */

/** Calm until 2:00, then Urgent for the last two minutes (Figma Countdown, 37:819). */
export const URGENT_BELOW_SECONDS = 120;

export type CountdownTone = 'calm' | 'urgent';

function wholeSeconds(seconds: number): number {
  return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
}

/** "9:58". Minutes are not padded, seconds are; never negative. */
export function formatCountdown(seconds: number): string {
  const total = wholeSeconds(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** Urgent only once the time is under 2:00, so 2:00 itself is still calm and 1:59 is urgent. */
export function countdownTone(seconds: number): CountdownTone {
  return wholeSeconds(seconds) < URGENT_BELOW_SECONDS ? 'urgent' : 'calm';
}

/** "9 minutes 58 seconds left", for screen readers. */
export function spokenCountdown(seconds: number): string {
  const total = wholeSeconds(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  if (rest > 0 || minutes === 0) parts.push(`${rest} ${rest === 1 ? 'second' : 'seconds'}`);
  return `${parts.join(' ')} left`;
}
