import { clientIdHeaders } from './clientId';
import { readApiBaseUrl } from './config';
import { MovieApiError, fetchApiJson } from './movies';
import { isShowtimeId } from './seats';

/**
 * Mirrors matinee-server/src/bookings/booking.ts (`POST` and `DELETE /showtimes/:id/holds`, ADR 0015) and the
 * hold-related error codes in matinee-server/src/http/errors.ts. Any contract change lands in a matinee-server
 * PR first. Hand-written on purpose, like the seats contract: an interface plus a type guard, not a schema
 * library.
 *
 * This slice only takes and gives back holds. `POST /showtimes/:id/bookings` exists on the server (a temporary
 * direct commit with no payment step) but the app does not call it: booking belongs to the payments chapter.
 */

/** The server's answer to a successful hold. Every seat in the request is held, or none is. */
export interface HoldResponse {
  showtimeId: string;
  seatIds: string[];
  /** The server's absolute expiry. The app does not count down from it (device clocks lie): see holdClock.ts. */
  expiresAt: string;
  /** How long this hold has left, in milliseconds, at the moment the server answered. The countdown's seed. */
  expiresInMs: number;
}

/** The seats that really were released. A seat that was not the caller's own is simply absent. */
export interface ReleaseResponse {
  released: string[];
}

export function buildHoldsUrl(baseUrl: string, showtimeId: string): string {
  if (!isShowtimeId(showtimeId)) {
    throw new MovieApiError('Invalid showtime id.', {
      status: 400,
      kind: 'validation_failed',
      retryable: false,
    });
  }
  return `${baseUrl}/showtimes/${showtimeId}/holds`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * A hold with no seats, or a negative or non-finite time left, is not a hold the app can count down from,
 * so it is rejected as an invalid response rather than drawn.
 */
export function isHoldResponse(value: unknown): value is HoldResponse {
  if (!isRecord(value)) return false;
  return (
    typeof value.showtimeId === 'string' &&
    isStringArray(value.seatIds) &&
    value.seatIds.length > 0 &&
    typeof value.expiresAt === 'string' &&
    typeof value.expiresInMs === 'number' &&
    Number.isFinite(value.expiresInMs) &&
    value.expiresInMs >= 0
  );
}

export function isReleaseResponse(value: unknown): value is ReleaseResponse {
  return isRecord(value) && isStringArray(value.released);
}

export async function acquireHold(
  showtimeId: string,
  seatIds: readonly string[],
  clientId: string,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<HoldResponse> {
  const { data } = await fetchApiJson(buildHoldsUrl(baseUrl, showtimeId), isHoldResponse, signal, {
    method: 'POST',
    headers: clientIdHeaders(clientId),
    body: { seatIds },
  });
  return data;
}

export async function releaseHold(
  showtimeId: string,
  seatIds: readonly string[],
  clientId: string,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<ReleaseResponse> {
  const { data } = await fetchApiJson(buildHoldsUrl(baseUrl, showtimeId), isReleaseResponse, signal, {
    method: 'DELETE',
    headers: clientIdHeaders(clientId),
    body: { seatIds },
  });
  return data;
}

// ---- What a failed hold means ---------------------------------------------------------------------

/** How long to wait before retrying when the server gave no `Retry-After` (it sends 2 s, ADR 0015). */
export const DEFAULT_RETRY_AFTER_MS = 2_000;

/**
 * What a failed `POST /holds` means for the screen. Two questions matter: what to tell the user, and
 * whether the server might nevertheless be holding the seats (`maybeHeld`), because then leaving the screen
 * has to ask it to let them go.
 *
 * - `taken`: 409 `seat_taken`. The server refused the whole request and named the seats that are gone. Nothing
 *   is held (a hold is all or nothing).
 * - `unavailable`: 503 `holds_unavailable`. Redis is down or did not answer, so the server refuses new holds
 *   (fail closed). A command sent just before the outage can still run later, so the seats MAY be held.
 * - `rejected`: any other answer the server gave on purpose (400 validation, 404 not found, ...). Nothing is held.
 * - `uncertain`: no usable answer (network error, timeout, an unreadable or unexpected response). The request may
 *   or may not have been processed. Asking again is safe: a repeated hold from the same owner returns the
 *   existing hold and does not extend it.
 */
export type HoldFailure =
  | { kind: 'taken'; seatIds: string[]; maybeHeld: false }
  | { kind: 'unavailable'; retryAfterMs: number; maybeHeld: true }
  | { kind: 'rejected'; message: string; maybeHeld: false }
  | { kind: 'uncertain'; maybeHeld: true };

export function classifyHoldError(error: unknown): HoldFailure {
  if (!(error instanceof MovieApiError)) return { kind: 'uncertain', maybeHeld: true };

  if (error.kind === 'seat_taken') {
    return { kind: 'taken', seatIds: error.seatIds ?? [], maybeHeld: false };
  }
  if (error.kind === 'holds_unavailable') {
    const seconds = error.retryAfterSeconds;
    return {
      kind: 'unavailable',
      retryAfterMs: seconds === undefined ? DEFAULT_RETRY_AFTER_MS : seconds * 1000,
      maybeHeld: true,
    };
  }
  // No answer, an unreadable answer, or a failure inside the server: whether the hold happened is unknown.
  if (
    error.kind === 'network_error' ||
    error.kind === 'invalid_response' ||
    error.kind === 'internal_error' ||
    error.kind === 'service_unavailable' ||
    error.kind === 'upstream_unavailable' ||
    error.status >= 500
  ) {
    return { kind: 'uncertain', maybeHeld: true };
  }
  return { kind: 'rejected', message: error.message, maybeHeld: false };
}
