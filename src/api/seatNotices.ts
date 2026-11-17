import { selectedSeatNames, takenSeatsMessage } from '../components/seatMapLogic';
import type { HoldOutcome } from './holdMachine';
import type { ShowtimeSeatRow } from './seats';

/**
 * What the seat screen tells the user when something happens to their seats, as plain data: the words, the tone
 * (Toast), whether to buzz, whether to offer Try again, and whether to refresh the map. Kept apart from the screen
 * so the wording and the rules are unit-tested; the screen only shows the notice (Toast, haptic, refetch).
 *
 * The 409 "seat taken" wording follows Figma 57:7594 ("That seat was just taken. Pick another."), naming the seat
 * as the brief asks. The hold-unavailable, slow-down (429) and could-not-confirm Toasts have no Figma frame: they
 * reuse the Toast with its optional action.
 */
export interface SeatNoticeDraft {
  message: string;
  tone: 'info' | 'error';
  /** A warning buzz: used when seats the user wanted were lost, like the seat-cap refusal. */
  haptic: boolean;
  /** Offer a "Try again" action that asks for the hold again. */
  retry: boolean;
  /** Refresh the map straight away (a refusal means the map on screen is out of date). */
  refetch: boolean;
}

export interface SeatNotice extends SeatNoticeDraft {
  /** Rises with each notice, so a screen that renders the same state twice shows it once. */
  id: number;
}

/** A refresh showed that seats picked earlier are now held or sold by someone else (Figma 57:7594). */
export function lostPicksNotice(rows: readonly ShowtimeSeatRow[], lostIds: readonly string[]): SeatNoticeDraft {
  return {
    message: takenSeatsMessage(selectedSeatNames(rows, lostIds)),
    tone: 'error',
    haptic: true,
    retry: false,
    refetch: false,
  };
}

/** What the hold flow refused or could not finish. `rows` is the map on screen, used to turn seat ids into names. */
export function holdOutcomeNotice(outcome: HoldOutcome, rows: readonly ShowtimeSeatRow[] | undefined): SeatNoticeDraft {
  switch (outcome.kind) {
    case 'taken':
      return {
        message: takenSeatsMessage(rows ? selectedSeatNames(rows, outcome.seatIds) : []),
        tone: 'error',
        haptic: true,
        retry: false,
        refetch: true,
      };
    case 'unavailable':
      return {
        message: 'Seats are temporarily unavailable. Try again in a moment.',
        tone: 'error',
        haptic: false,
        retry: true,
        refetch: false,
      };
    case 'rateLimited':
      // 429. Not an error in the app's eyes, so the calm `info` tone and no buzz. The picks are kept and Try again
      // goes through the hold flow, which waits out Retry-After before it sends (holdMachine.ts), so a tap does not
      // simply get refused again. Nothing is held, so there is nothing to refresh either.
      return {
        message: RATE_LIMITED_MESSAGE,
        tone: 'info',
        haptic: false,
        retry: true,
        refetch: false,
      };
    case 'uncertain':
      return {
        message: "Couldn't confirm your hold. Try again.",
        tone: 'error',
        haptic: false,
        retry: true,
        refetch: false,
      };
    case 'rejected':
      return {
        message: outcome.message || "Couldn't hold those seats.",
        tone: 'error',
        haptic: false,
        retry: false,
        refetch: false,
      };
  }
}

/** Too many holds in a minute (429). No Figma frame: the existing `Toast` with its Try again action. */
export const RATE_LIMITED_MESSAGE = 'Slow down a moment, then try again.';
export const STALE_MAP_MESSAGE = "Can't refresh seats. Trying again…";
export const HELD_LOCKED_MESSAGE = 'Your seats are held. Use Change seats to pick different ones.';
/** Continue with seats held: the next chapter owns payment, so the app says so (Checkout is Figma 60:12130). */
export const PAYMENT_DEFERRED_MESSAGE = "Payment isn't built yet. Your seats stay held until the timer runs out.";
