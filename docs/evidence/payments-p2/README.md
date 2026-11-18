# Evidence: payments P2 — native PaymentSheet + confirmation poll

The payment flow is proven by its unit tests (the confirmation machine, the checkout/order-status type guards, the
PaymentSheet result classification) — no native build needed for those. The real Stripe-test-mode end-to-end is run by
**Dave** on the EAS dev build (the agent never reads `.env`); the exact steps are below, including a fast way to force the
refund path without waiting out the 10-minute hold.

## What the tests prove (`npm test`)

| File | What |
|---|---|
| `src/api/checkout.test.ts` | The checkout contract guard; the deterministic idempotency key (same seats → same key, a cancelled retry reuses it); the checkout failure messages (409/503/429/network each get a clear line, never a raw 5xx). |
| `src/api/orderStatus.test.ts` | The order-status contract guard (succeeded + ticket, refunded + reason, requires_payment, failed). |
| `src/api/paymentConfirmationMachine.test.ts` | The confirmation poll: succeeded → ticket, refunded → reason, failed → terminal, `requires_payment` keeps polling, the deadline → `unconfirmed` (not a dead end) and `retry()` re-enters; a failed poll is tolerated. |
| `src/lib/stripe.test.ts` | PaymentSheet answer classification (success / Canceled / Timeout / Failed) and the publishable key read. |

## Dave's end-to-end (test mode)

1. **Server** (terminal 1–3): run `matinee-server` with `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (test values in
   `.env` / `.env.test.local`), run the worker (`npm run worker`), and forward Stripe:
   ```
   stripe listen --forward-to localhost:3000/webhooks/stripe
   ```
2. **Build the dev client** (the Stripe SDK is native — Expo Go cannot run it):
   ```
   eas login
   eas build --profile development --platform android
   ```
   The first build may prompt to link/create the EAS project, which writes `extra.eas.projectId` into `app.json`.
3. **Run it** against the dev client with the publishable key set:
   ```
   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_… npx expo start --dev-client
   ```
   (Also set `EXPO_PUBLIC_API_URL` to reach the local server, e.g. `http://localhost:3000` via `adb reverse`.)
4. **The happy path.** Pick seats → Continue (checkout opens over the seat screen) → the PaymentSheet → pay with
   **`4242 4242 4242 4242`**, any future expiry, any CVC → "Confirming your payment…" → the ticket. Save the booking row
   and the ledger row dumps.
5. **Cancel path.** Present the sheet, then dismiss it: the app returns to the seat screen, the hold is still alive, and
   tapping Continue again reuses the same order (no second PaymentIntent — the idempotency key is deterministic on the seats).

## Forcing the refund path (no 10-minute wait)

The "paid but the hold expired" reconciliation. Do this between presenting the sheet and confirming the card, so the hold is
gone before the webhook lands:

1. Hold seats and open checkout; leave the PaymentSheet waiting for the card.
2. In another terminal, delete the hold keys for that showing (the server's key is `hold:{<showtimeId>}:<seatId>`, braces and all):
   ```
   redis-cli --scan --pattern 'hold:{<showtimeId>}:*' | xargs -r redis-cli DEL
   ```
   (The `<showtimeId>` is in the seat screen's URL; the hold keys live in the same Redis the server uses.)
3. Confirm the card. The webhook → worker finds the hold gone → refunds the PaymentIntent → the app's poll shows
   **"Your seats were released … payment refunded"**.

Alternative (no `redis-cli`): use Stripe CLI to replay a `payment_intent.succeeded` event for the intent after the hold has
lapsed naturally (`stripe trigger payment_intent.succeeded` after the 10 minutes), but the DEL is faster and doesn't touch
the 10-minute TTL.

## Deferred

The QR code and the full ticket design are the next mobile PR; the ticket screen here is a minimal shell that proves the
confirmed booking renders from `GET /orders/:reference`.
