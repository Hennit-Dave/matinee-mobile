import { clientIdHeaders } from './clientId';
import { readApiBaseUrl } from './config';
import { MovieApiError, fetchApiJson } from './movies';
import { isShowtimeId } from './seats';

/**
 * Mirrors matinee-server/src/waitingroom/queue.ts (`POST`, `GET` and `DELETE /showtimes/:id/queue`, ADR 0017). Any
 * contract change lands in a matinee-server PR first. Hand-written on purpose, like the seats and holds contracts:
 * an interface plus a type guard, not a schema library.
 *
 * How the room works, from the app's side:
 *  - Choosing seats needs a PASS for the showing. The seat map and `POST /holds` answer `403 waiting_room_required`
 *    without one (see `isWaitingRoomRequiredError` in movies.ts).
 *  - `POST /queue` joins the line, or hands out a pass straight away when there is room. Joining again keeps the place.
 *  - `GET /queue` says where you stand and is the heartbeat that keeps a place. It never joins.
 *  - Once admitted, the seat-map polls are the pass's heartbeat, so the app does not call `GET /queue` again.
 *  - `DELETE /queue` gives up a place or a pass. Idempotent.
 *
 * There is NO estimated wait anywhere in this contract, on purpose (RULES D5.3, ADR 0017): the fixed admission rate
 * only gives a lower bound, so the app shows how many people are ahead and nothing else.
 */

/** You may choose seats. `passExpiresInMs` is how long the pass lasts if you stay quiet; seat-map polls renew it. */
export interface QueueAdmitted {
  status: 'admitted';
  passExpiresInMs: number;
}

/** You are in the line. `ahead` people are in front of you (0 = you are next); ask again after `pollAfterMs`. */
export interface QueueWaiting {
  status: 'waiting';
  ahead: number;
  pollAfterMs: number;
}

/** Neither admitted nor waiting: never joined, left, lost your place, or your pass lapsed. Join again. */
export interface QueueNotQueued {
  status: 'not_queued';
}

export type QueueState = QueueAdmitted | QueueWaiting | QueueNotQueued;

export function buildQueueUrl(baseUrl: string, showtimeId: string): string {
  if (!isShowtimeId(showtimeId)) {
    throw new MovieApiError('Invalid showtime id.', {
      status: 400,
      kind: 'validation_failed',
      retryable: false,
    });
  }
  return `${baseUrl}/showtimes/${showtimeId}/queue`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * An answer the app can act on. `ahead` is a whole number from 0 up, `pollAfterMs` a positive number and
 * `passExpiresInMs` a number from 0 up: anything else (a negative place, a poll delay of NaN) is rejected as an
 * invalid response rather than drawn or used as a timer. Extra fields are ignored, so the server can add some.
 */
export function isQueueState(value: unknown): value is QueueState {
  if (!isRecord(value)) return false;
  switch (value.status) {
    case 'admitted':
      return typeof value.passExpiresInMs === 'number' && Number.isFinite(value.passExpiresInMs) && value.passExpiresInMs >= 0;
    case 'waiting':
      return (
        typeof value.ahead === 'number' &&
        Number.isInteger(value.ahead) &&
        value.ahead >= 0 &&
        typeof value.pollAfterMs === 'number' &&
        Number.isFinite(value.pollAfterMs) &&
        value.pollAfterMs > 0
      );
    case 'not_queued':
      return true;
    default:
      return false;
  }
}

export function isAdmitted(state: QueueState): state is QueueAdmitted {
  return state.status === 'admitted';
}

export function isWaiting(state: QueueState): state is QueueWaiting {
  return state.status === 'waiting';
}

export function isNotQueued(state: QueueState): state is QueueNotQueued {
  return state.status === 'not_queued';
}

/** `POST /queue`: join the line, or be let straight in. Throws a `MovieApiError` (404 for a showing that does not exist). */
export async function joinQueue(
  showtimeId: string,
  clientId: string,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<QueueState> {
  const { data } = await fetchApiJson(buildQueueUrl(baseUrl, showtimeId), isQueueState, signal, {
    method: 'POST',
    headers: clientIdHeaders(clientId),
  });
  return data;
}

/** `GET /queue`: where you stand now. Also what keeps a place from lapsing. Never joins. */
export async function pollQueue(
  showtimeId: string,
  clientId: string,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<QueueState> {
  const { data } = await fetchApiJson(buildQueueUrl(baseUrl, showtimeId), isQueueState, signal, {
    headers: clientIdHeaders(clientId),
  });
  return data;
}

/** `DELETE /queue`: give up the place or the pass. Always answers `not_queued`. */
export async function leaveQueue(
  showtimeId: string,
  clientId: string,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<QueueState> {
  const { data } = await fetchApiJson(buildQueueUrl(baseUrl, showtimeId), isQueueState, signal, {
    method: 'DELETE',
    headers: clientIdHeaders(clientId),
  });
  return data;
}

// ---- How often to ask ---------------------------------------------------------------------------------

/**
 * The server says when to ask again (`pollAfterMs`: 3 s for the front of the line, longer behind, 15 s at most). That
 * number is input from the network, so it is bounded: never faster than this, so a bad answer cannot make a phone
 * hammer the server, and never slower than the longest the server can ask for plus room, so a bad answer cannot make
 * a person miss their turn (a place lapses after 90 s of silence, a pass after 30 s).
 */
export const MIN_POLL_AFTER_MS = 1_000;
export const MAX_POLL_AFTER_MS = 30_000;
/** What the server asks of the front of the line, used when the number it sent is not a number at all. */
export const DEFAULT_POLL_AFTER_MS = 3_000;

/**
 * Each wait is the server's number plus or minus this share, chosen fresh every time, so people who joined together
 * do not all ask in the same moment (ADR 0017 relies on the client doing this).
 */
export const QUEUE_POLL_JITTER = 0.2;

/** `random` is a number from 0 up to (not including) 1, e.g. `Math.random()`. */
export function queuePollDelayMs(pollAfterMs: number, random: number): number {
  const wanted = Number.isFinite(pollAfterMs) ? pollAfterMs : DEFAULT_POLL_AFTER_MS;
  const base = Math.min(Math.max(wanted, MIN_POLL_AFTER_MS), MAX_POLL_AFTER_MS);
  // A draw that is not a number would make the timer NaN (which fires at once): use the middle of the band instead.
  const clamped = Number.isFinite(random) ? Math.min(Math.max(random, 0), 1) : 0.5;
  const spread = base * QUEUE_POLL_JITTER;
  return Math.round(base - spread + clamped * 2 * spread);
}
