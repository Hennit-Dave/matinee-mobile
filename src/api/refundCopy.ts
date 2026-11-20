/**
 * The refund-reason → screen copy map. Pure, so it is unit-tested with `node --test`. The server sends the
 * reason on `GET /orders/:reference`; the app never decides the outcome itself, only how to phrase it and where
 * the primary action goes.
 *
 * `destination` is the one thing the screen cannot infer from the copy alone: a cancelled showing has NO seat
 * map to return to, so its action goes home, not "back to seats".
 */

export type RefundDestination = 'seats' | 'home';

export interface RefundCopy {
  headline: string;
  body: string;
  /** Where the primary action takes the user: back to the seats (the showing is still live) or home (it is gone). */
  destination: RefundDestination;
}

export function refundReasonCopy(reason: string | null | undefined): RefundCopy {
  switch (reason) {
    case 'showtime_cancelled_refund':
      return {
        headline: 'This showing was cancelled',
        body: 'Your payment has been refunded. Browse other showings to try again.',
        destination: 'home',
      };
    case 'hold_expired_refund':
    case 'hold_lapsed_refund':
      return {
        headline: 'Your seats were released',
        body: 'Your payment has been refunded because the hold ran out. Pick different seats to try again.',
        destination: 'seats',
      };
    default:
      // Unknown or missing reason: a safe generic, never a blank. Home (not "back to seats") is the safe default,
      // because a dead seat map is the worst surprise when we cannot tell why the money came back.
      return {
        headline: 'Your payment was refunded',
        body: 'Your payment has been refunded.',
        destination: 'home',
      };
  }
}
