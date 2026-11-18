import { formatCountdown } from './countdownLogic';

/**
 * The words of the waiting room and of the "we're very busy" state, as plain data and pure functions so the wording
 * is unit-tested. The components only draw what these return.
 *
 * Copy follows Figma `Booking / Waiting room` (56:6607) and `System / Server overloaded` (107:15558), with ONE
 * deliberate deviation. Figma's note says "You can lock your phone; we'll tell you when it's your turn". That promises
 * a push notification, which the app does not send (it needs a new native module and a server job: a later
 * enhancement, ADR 0017). Promising it would be a lie, so the note asks the person to keep Matinee open instead.
 *
 * There is NO estimated wait, in any of the words (D4, ADR 0017): the line's speed is not known well enough to promise
 * a time, so the app says how many people are ahead and nothing more.
 */

export const QUEUE_HEADING = "You're in the queue";
export const LEAVE_LABEL = 'Leave the queue';
/** The deliberate deviation from Figma (see above). */
export const WAITING_NOTE = "Your place is held. Keep Matinee open and we'll move you the moment it's your turn.";
/** Not in Figma: the frame only draws the line with someone in front of you. Built from the same type tokens. */
export const NEXT_IN_LINE = "You're next";

/** The label under the big number: "people ahead of you", or "person ahead of you" for exactly one. */
export function aheadCaption(ahead: number): string {
  return ahead === 1 ? 'person ahead of you' : 'people ahead of you';
}

/** The number drawn large. Plain digits: the figure itself is the point. */
export function aheadNumeral(ahead: number): string {
  return String(Math.max(0, Math.trunc(Number.isFinite(ahead) ? ahead : 0)));
}

/** The one sentence a screen reader hears for the place in the line. */
export function aheadSpoken(ahead: number): string {
  if (ahead <= 0) return NEXT_IN_LINE;
  return `${aheadNumeral(ahead)} ${aheadCaption(ahead)}`;
}

/**
 * The freshness line (Figma: "Updated just now"). It is only said when the last refresh worked: while a refresh is
 * failing the place on screen may be out of date, and the line says so instead.
 */
export function freshnessLabel(stale: boolean): string {
  return stale ? 'Trying to update…' : 'Updated just now';
}

export const OVERLOADED_HEADLINE = "We're very busy right now";
export const OVERLOADED_BODY = "Lots of people are booking at once. You haven't been charged. We'll try again for you.";
export const OVERLOADED_RETRY_LABEL = 'Try again now';

/**
 * "Trying again in 0:14" (Figma). At zero, and while the request is in flight, it says "Trying again…" instead of
 * a countdown that has nothing left to count.
 */
export function retryFootnote(seconds: number, retrying: boolean): string {
  if (retrying || seconds <= 0) return 'Trying again…';
  return `Trying again in ${formatCountdown(seconds)}`;
}
