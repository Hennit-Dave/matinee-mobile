/**
 * Formatting for the ticket screen, pure so it is unit-tested. The ticket shows the server's own `time`
 * (UTC HH:MM) and a date derived from `startsAt`; the seats are already `{ row, number }`, so only the
 * presentation is computed here — the app never computes money.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** `"Mon 1 Dec 2026"` from the server's UTC ISO datetime; the input as-is when it cannot be parsed. */
export function formatTicketDate(startsAt: string): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return startsAt;
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `"A1, A2"` from the ticket's seats (already sorted by the server). */
export function formatTicketSeats(seats: readonly { row: string; number: number }[]): string {
  return seats.map((seat) => `${seat.row}${seat.number}`).join(', ');
}

/**
 * A short, display-only reference ("MTN-XXXX"): 4 uppercase alphanumeric chars derived from the UUID. The QR and
 * every lookup keep the FULL reference; this is for the screen's copy only.
 */
export function displayReference(reference: string): string {
  const compact = reference.replaceAll('-', '').toUpperCase();
  return `MTN-${compact.slice(0, 4)}`;
}
