/**
 * The one place the app talks about Stripe (the TMDB rule for payments). The PaymentSheet calls themselves
 * go through `@stripe/stripe-react-native` in the checkout screen; the pieces worth unit-testing — the
 * publishable key and the meaning of the sheet's answer — live here, pure.
 *
 * The publishable key is PUBLIC by design (it identifies the Stripe account, it cannot charge anyone); the
 * SECRET key stays on the server and never appears in this repo.
 */

/** Shown to the customer inside the PaymentSheet (Android requires a non-empty name). */
export const MERCHANT_DISPLAY_NAME = 'Matinee';

export type PaymentSheetOutcome = 'success' | 'canceled' | 'timeout' | 'failed';

/**
 * What the PaymentSheet's answer means for the flow. `presentPaymentSheet` resolves with `{ error }` where the
 * error's `code` is `Canceled` (the customer dismissed it), `Timeout`, `Failed`, or the error is absent
 * (success — which is NOT a booking: the server confirms only on its webhook).
 */
export function classifyPaymentSheetError(error: { code?: string } | undefined): PaymentSheetOutcome {
  if (!error) return 'success';
  if (error.code === 'Canceled') return 'canceled';
  if (error.code === 'Timeout') return 'timeout';
  return 'failed';
}

/** The public key, or `null` when it is not set (a build without it still browses, it just cannot pay). */
export function readStripePublishableKey(): string | null {
  const raw = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  return raw && raw.trim() ? raw.trim() : null;
}
