# Handoff: the QR ticket screen, mobile (branch `feat/payments-p2-ticket`)

Payments P2, mobile PR 3 of 3, stacked on PR 2 (the checkout + confirmation poll, merged as #30). Replaces the
`ticket/[reference]` shell with the full ticket.

## What changed

- **The QR ticket** (`src/app/ticket/[reference].tsx`): reads `GET /orders/:reference` (owner-scoped, so a deep link
  with someone else's reference is "not found") and renders the movie, cinema · screen, date + time, the seats, the
  server-formatted total, the reference, and a **QR code** that encodes the reference (the only non-sensitive thing a
  ticket needs; the secret key never leaves the server). Skeleton while loading; designed not-found and error states;
  dark mode; accessibility labels and ≥48×48 touch targets.
- **`react-native-qrcode-svg`** (pure JS on the existing `react-native-svg` — no extra native module beyond the Stripe
  SDK already added in PR 2). The QR uses the `qr/background` / `qr/foreground` tokens, which are white-on-dark in both
  themes for scanability.
- **Formatting helpers** (`src/api/ticket.ts`, pure + tested): `formatTicketDate` and `formatTicketSeats`.

## What passed

`npm run typecheck`, `npm run lint`: clean. `npm test`: **436 of 436** (+2).

## Unproven / carry-forwards

- The QR is rendered but not scanned end-to-end — Dave's e2e (from `docs/evidence/payments-p2/README.md`) can scan it
  with a phone to confirm it reads back the reference.
- The **Tickets tab** is still a placeholder: a confirmed ticket is reached only from the fresh confirmation flow. Listing
  and reopening past tickets from the tab is later (needs a "list my orders" endpoint on the server).

## Deferred

- **P3 (server/mobile):** cancelled-showtime refunds, re-hold-if-still-free, the Tickets-tab listing.

## Next

- **Dave:** check CI, then **squash-merge**. No new secret or service; the EAS dev build from PR 2 covers this (pure JS
  QR, no new native module), so no rebuild is needed just for the ticket.
- Close the chat and write your `LEARNING-LOG.md` paragraph (your words only). `LEARNING-LOG.md` is untouched.
