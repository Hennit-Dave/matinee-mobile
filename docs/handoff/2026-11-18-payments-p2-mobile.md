# Handoff: native PaymentSheet + confirmation poll, mobile (branch `feat/payments-p2-payments`)

Payments P2, mobile PR 2 of 3 (stacked on the server `GET /orders/:reference` PR, merged as #29). Plan approved by Dave
with the six additions (no-cache/shed-exempt status endpoint, terminal `failed`, pre-sheet checkout errors, cancel reuses
the key, the fast refund recipe, first-run EAS). The ticket's QR is PR 3.

## What changed

- **Deps + config.** `@stripe/stripe-react-native` (native → needs an EAS dev build; Expo Go cannot run it), the Stripe
  config plugin with `merchantDisplayName: "Matinee"` in `app.json`, a new `eas.json` `development` profile
  (`developmentClient` + `distribution: internal`, Android APK), and `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env.example`
  (name only; a publishable key is public by design — the secret key stays server-only).
- **Checkout** (`src/app/showtime/[id]/checkout.tsx`), pushed as a **modal** over the seat screen so the seat screen — and its
  hold — stays mounted. It POSTs `/showtimes/:id/checkout` (with an `Idempotency-Key` that is **deterministic on the seats**,
  so a cancelled sheet retried reuses the SAME PaymentIntent), presents the native PaymentSheet, and treats "success" as
  NOT a booking.
- **The confirmation poll** (`paymentConfirmationMachine.ts` + `usePaymentConfirmation.ts`): polls `GET /orders/:reference`
  every 2 s until the order resolves — `succeeded` → the ticket (success haptic), `refunded` → "seats released, refunded",
  `failed` → "payment didn't go through", and a 60 s deadline → "still confirming" with a re-check. A failed poll is tolerated.
- **Pre-sheet checkout errors** (`checkoutFailureMessage`) each get a clear line and a way back to the seats — 409 (hold gone),
  503, 429, network, `payment_unavailable` — so the app never jumps straight from the POST to the sheet. A missing
  publishable key is "payments not set up on this build".
- **Cancel** returns to the seats without starting confirmation; the deterministic idempotency key means a retry reuses the
  order. The `ticket/[reference]` route is a minimal shell (fetches the order status and shows the confirmed booking); the QR
  and full design are PR 3.
- **API contract** (`checkout.ts`, `orderStatus.ts`) mirrors the server, hand-written + type guards; `movies.ts` gained the two
  P1 error codes (`idempotency_mismatch`, `payment_unavailable`).

## What passed

- `npm run typecheck`, `npm run lint`: clean. `npm test`: **434 of 434** (+14: the confirmation machine, the checkout and
  order-status guards, the PaymentSheet classification, the idempotency-key determinism and the failure messages).

## Unproven / carry-forwards

1. **The real PaymentSheet + webhook e2e is Dave's to run** on the EAS dev build (`docs/evidence/payments-p2/README.md` has the
   exact steps, the test card `4242 4242 4242 4242`, and the fast refund recipe — DEL the `hold:{<showtimeId>}:<seatId>` key
   between presenting the sheet and confirming).
2. **`extra.eas.projectId`** is not pre-filled: the first `eas build` links/creates the EAS project and writes it into
   `app.json` (it may prompt). Dave's only manual steps are `eas login` + the build.
3. The checkout is a modal over the seat screen by design (the hold survives). I did not build the Tickets-tab listing — the
   ticket is reached only from a fresh confirmation for now.

## Deferred

- **PR 3 (this branch's next, stacked):** the QR code (`react-native-qrcode-svg`) and the full ticket design.
- **P3 (server/mobile):** cancelled-showtime refunds, re-hold-if-still-free, the Tickets tab listing.

## Next

- **Dave:** check CI, then **squash-merge**. No new secret, no new service; the only manual step is the EAS build (after merge).
- Close the chat and write your `LEARNING-LOG.md` paragraph (your words only). `LEARNING-LOG.md` is untouched.
