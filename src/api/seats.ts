import { clientIdHeaders } from './clientId';
import { readApiBaseUrl } from './config';
import { MovieApiError, fetchApiJson, isServerOverloadedError, type CacheStatus } from './movies';
import { POLL_FAILURES_BEFORE_ERROR } from './seatsPolling';

/**
 * Mirrors matinee-server/src/showtimes/seat.ts (`GET /showtimes/:id/seats`, ADR 0014).
 * Any contract change lands in a matinee-server PR first. Hand-written on purpose, like the app's
 * other contracts: an interface plus a type guard, not a schema library.
 */

/** A physical seat's kind. Wheelchair spaces are drawn with their own glyph. */
export type SeatKind = 'standard' | 'wheelchair';

/**
 * Per-showtime availability, all three live since traffic slice 5a (ADR 0015): `sold` comes from bookings,
 * `held` from Redis (so it is real-time, never cached), and sold wins when a seat is both. "Yours" (selected) is
 * client-only and never here. The server does not say WHO holds a `held` seat: the caller's own held seats come
 * back as `held` like anyone else's, so the screen draws its own (see `withOwnHold` in seatMapLogic.ts).
 */
export type SeatStatus = 'available' | 'held' | 'sold';

export interface ShowtimeSeat {
  id: string;
  /** Row letter, "A".."Z". */
  row: string;
  /** 1-based, left to right as seen from the seats. The centre aisle is not in the data (see seatMapLogic). */
  number: number;
  kind: SeatKind;
  status: SeatStatus;
}

export interface ShowtimeSeatRow {
  row: string;
  seats: ShowtimeSeat[];
}

export interface ShowtimeSeatsResponse {
  showtimeId: string;
  movieId: number;
  startsAt: string;
  /** UTC HH:MM (24-hour), same as `ShowtimeSlot.time`. */
  time: string;
  screen: {
    id: string;
    name: string;
    format: string;
    totalSeats: number;
  };
  priceCents: number;
  /** Server-formatted per-seat price (e.g. "£15.50") so the app never computes or formats money. */
  priceFormatted: string;
  rows: ShowtimeSeatRow[];
}

export interface SeatsFetchResult {
  data: ShowtimeSeatsResponse;
  cache: CacheStatus | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isShowtimeId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function buildShowtimeSeatsUrl(baseUrl: string, showtimeId: string): string {
  if (!isShowtimeId(showtimeId)) {
    throw new MovieApiError('Invalid showtime id.', {
      status: 400,
      kind: 'validation_failed',
      retryable: false,
    });
  }
  return `${baseUrl}/showtimes/${showtimeId}/seats`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const SEAT_KINDS: readonly string[] = ['standard', 'wheelchair'];
const SEAT_STATUSES: readonly string[] = ['available', 'held', 'sold'];

function isShowtimeSeat(value: unknown): value is ShowtimeSeat {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.row === 'string' &&
    typeof value.number === 'number' &&
    typeof value.kind === 'string' &&
    SEAT_KINDS.includes(value.kind) &&
    typeof value.status === 'string' &&
    SEAT_STATUSES.includes(value.status)
  );
}

function isShowtimeSeatRow(value: unknown): value is ShowtimeSeatRow {
  if (!isRecord(value)) return false;
  return typeof value.row === 'string' && Array.isArray(value.seats) && value.seats.every(isShowtimeSeat);
}

/**
 * Checks the whole response, not just the envelope: an unknown seat `kind` or `status` would be drawn
 * wrongly (a wheelchair space is not a standard seat), so such a response is rejected as invalid rather
 * than guessed at. An empty `rows` array passes this guard on purpose; it is handled as an error by
 * `resolveSeatsViewStatus`, so the two cases stay distinct.
 */
export function isShowtimeSeatsResponse(value: unknown): value is ShowtimeSeatsResponse {
  if (!isRecord(value)) return false;
  const { screen } = value;
  return (
    typeof value.showtimeId === 'string' &&
    typeof value.movieId === 'number' &&
    typeof value.startsAt === 'string' &&
    typeof value.time === 'string' &&
    isRecord(screen) &&
    typeof screen.id === 'string' &&
    typeof screen.name === 'string' &&
    typeof screen.format === 'string' &&
    typeof screen.totalSeats === 'number' &&
    typeof value.priceCents === 'number' &&
    typeof value.priceFormatted === 'string' &&
    Array.isArray(value.rows) &&
    value.rows.every(isShowtimeSeatRow)
  );
}

/**
 * `clientId` is optional on this route. Sent, it lets the server show a user their own booking at once even if
 * the read replica has not heard of it yet (read-your-own-writes, ADR 0015). Omitted, the map is the same map.
 */
export async function fetchShowtimeSeats(
  showtimeId: string,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl(),
  clientId?: string
): Promise<SeatsFetchResult> {
  return fetchApiJson(
    buildShowtimeSeatsUrl(baseUrl, showtimeId),
    isShowtimeSeatsResponse,
    signal,
    clientId ? { headers: clientIdHeaders(clientId) } : undefined
  );
}

export function countSeats(rows: readonly ShowtimeSeatRow[]): number {
  return rows.reduce((total, row) => total + row.seats.length, 0);
}

/**
 * Sold out means the server sent a full grid in which every seat is `sold`. It is read from seat
 * statuses only, never from an empty array (an empty grid is an error, not a sold-out room), and a seat
 * that is merely `held` can still come back, so a room with held seats is not sold out.
 */
export function isSoldOut(rows: readonly ShowtimeSeatRow[]): boolean {
  let any = false;
  for (const row of rows) {
    for (const seat of row.seats) {
      any = true;
      if (seat.status !== 'sold') return false;
    }
  }
  return any;
}

/** Shown when the server answers 200 with no seats at all, which only happens when something is wrong. */
export const NO_SEATS_MESSAGE = 'No seats came back for this showing.';

export type SeatsViewStatus = 'loading' | 'ready' | 'sold_out' | 'server_overloaded' | 'not_found' | 'error';

/** A refresh failed, but the map from the last good one is still on screen. Used by the screen to say so. */
export function isStaleRefresh(params: {
  isError: boolean;
  error: unknown;
  result: SeatsFetchResult | undefined;
  consecutiveFailures?: number;
}): boolean {
  return (
    params.isError &&
    params.result !== undefined &&
    params.consecutiveFailures !== undefined &&
    params.consecutiveFailures < POLL_FAILURES_BEFORE_ERROR &&
    !isShowingGone(params.error)
  );
}

function isShowingGone(error: unknown): boolean {
  return error instanceof MovieApiError && (error.status === 404 || error.kind === 'not_found');
}

/**
 * Decides which screen state to draw. Two rules matter most:
 *
 * 1. An empty `rows` array is an ERROR (retryable), never "sold out". The server returns `rows: []`
 *    only when something is wrong (for example the seats were never seeded). A genuinely sold-out
 *    room arrives as a full grid with every seat `sold`.
 *
 * 2. Stale seat availability is never presented as live. This rule has two parts, and the second REFINES the
 *    first version of it (seat-map slice), on purpose, because the map now refreshes itself every ~5 s:
 *
 *    - A failed refresh is an error when there is nothing to show, and when `consecutiveFailures` is not passed
 *      (a one-off fetch): the old rule, unchanged.
 *    - While the map polls, ONE or TWO failed refreshes in a row keep the last good map on screen (the caller
 *      gets `stale` from `isStaleRefresh` and says so with a Toast), and the THIRD in a row (see
 *      `POLL_FAILURES_BEFORE_ERROR`) is an error, as before.
 *
 *    Why: the old rule was written for a screen that fetched once. With polling, one dropped packet on a phone in
 *    a lift would wipe a half-made seat choice and replace the room with an error. The reason for the rule
 *    (never let someone believe a seat is free when it may not be) still holds under the refinement, because
 *    nothing is lost by keeping the map: Continue is safe on any map (the server decides every hold and
 *    refuses a taken seat), the failure is announced, and a third failure stops the pretence. A showing that
 *    has gone (404) is never tolerated.
 *
 * Everything else about the order of checks is unchanged.
 */
export function resolveSeatsViewStatus(params: {
  enabled: boolean;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  result: SeatsFetchResult | undefined;
  /** Refreshes that failed in a row since the last good one. Leave out for a one-off fetch (no tolerance). */
  consecutiveFailures?: number;
}): SeatsViewStatus {
  if (!params.enabled) return 'error';

  if (params.isError && !isStaleRefresh(params)) {
    if (isShowingGone(params.error)) return 'not_found';
    return isServerOverloadedError(params.error) ? 'server_overloaded' : 'error';
  }

  if (params.isPending && !params.result) return 'loading';
  if (!params.result) return 'error';

  const { rows } = params.result.data;
  if (countSeats(rows) === 0) return 'error';
  return isSoldOut(rows) ? 'sold_out' : 'ready';
}
