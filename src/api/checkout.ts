import { clientIdHeaders } from './clientId';
import { readApiBaseUrl } from './config';
import { fetchApiJson, MovieApiError } from './movies';

/**
 * Mirrors matinee-server/src/payments/payments.ts (`POST /showtimes/:id/checkout`, ADR 0019). Any contract
 * change lands in a matinee-server PR first. Hand-written, like the seats and holds contracts: an interface
 * plus a type guard, not a schema library.
 *
 * The server prices the order (seats + one flat service fee) and returns the PaymentIntent's `clientSecret`
 * for the native PaymentSheet. The `Idempotency-Key` header makes a repeated checkout return the SAME
 * PaymentIntent — the app generates one per checkout screen and reuses it on a retry, so a dismissed sheet
 * never creates a second charge.
 */

export interface CheckoutResponse {
  reference: string;
  showtimeId: string;
  seatIds: string[];
  seatTotalCents: number;
  feeCents: number;
  totalCents: number;
  totalFormatted: string;
  currency: string;
  /** For the PaymentSheet. `null` once the PaymentIntent can no longer be confirmed. */
  clientSecret: string | null;
  status: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isWholeCents(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isCheckoutResponse(value: unknown): value is CheckoutResponse {
  if (!isRecord(value)) return false;
  return (
    typeof value.reference === 'string' &&
    typeof value.showtimeId === 'string' &&
    isStringArray(value.seatIds) &&
    value.seatIds.length > 0 &&
    isWholeCents(value.seatTotalCents) &&
    isWholeCents(value.feeCents) &&
    isWholeCents(value.totalCents) &&
    typeof value.totalFormatted === 'string' &&
    typeof value.currency === 'string' &&
    (typeof value.clientSecret === 'string' || value.clientSecret === null) &&
    typeof value.status === 'string'
  );
}

/** The header Stripe's idempotency convention uses, mirrored by the server (ADR 0019). */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/**
 * A deterministic idempotency key for one (showtime, seats). The server scopes it per owner, so the key need
 * only be stable for the SAME install asking for the SAME seats: a checkout that was cancelled and retried
 * reuses the same key and gets the SAME PaymentIntent back (no second charge), even across a screen unmount.
 */
export function idempotencyKeyFor(showtimeId: string, seatIds: readonly string[]): string {
  return `checkout:${showtimeId}:${[...seatIds].sort().join('.')}`;
}

export async function acquireCheckout(
  showtimeId: string,
  seatIds: readonly string[],
  idempotencyKey: string,
  clientId: string,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<CheckoutResponse> {
  const { data } = await fetchApiJson(`${baseUrl}/showtimes/${showtimeId}/checkout`, isCheckoutResponse, signal, {
    method: 'POST',
    headers: { ...clientIdHeaders(clientId), [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    body: { seatIds },
  });
  return data;
}

/**
 * What a refused `POST /checkout` means for the screen, so the checkout never jumps from the request straight
 * to the PaymentSheet: a 409 (hold gone), a 503 (holds or payments down), a 429, or no network each get a
 * clear line and a way back to the seats.
 */
export function checkoutFailureMessage(error: unknown): string {
  if (!(error instanceof MovieApiError)) return 'Could not start the payment. Check your connection and try again.';
  switch (error.kind) {
    case 'seat_not_held':
    case 'seat_taken':
      return 'Those seats are no longer available. Go back and pick different ones.';
    case 'holds_unavailable':
      return 'Seats are temporarily unavailable. Try again in a moment.';
    case 'payment_unavailable':
      return 'Payment is temporarily unavailable. Try again shortly.';
    case 'rate_limited':
      return 'Slow down a moment, then try again.';
    case 'server_busy':
      return "We're very busy right now. Try again in a moment.";
    case 'network_error':
      return 'Could not reach the Matinee server. Check your connection and try again.';
    case 'idempotency_mismatch':
      return 'This order was already started with different seats. Go back and start again.';
    default:
      return error.message;
  }
}
