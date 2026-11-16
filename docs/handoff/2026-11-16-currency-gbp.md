# Handoff: Display currency USD -> GBP, mobile side (branch `feat/currency-gbp`)

Companion to the server PR `Hennit-Dave/matinee-server#20`, which changes `priceFormatted` to `£`. **Merge the server PR first.**

## What changed
- **No app code renders a currency symbol.** The app only displays the server's `priceFormatted` string (it appears in the showtime slot accessibility label in `src/app/(tabs)/(home)/movie/[id]/showtimes.tsx`), so no runtime behaviour changes.
- **Hardcoded `$` strings fixed (test fixtures and a doc comment only):**
  - `src/api/showtimes.ts`: doc comment example is now `"£15.50"`.
  - `src/api/showtimes.test.ts`, `src/api/movieDetailHelpers.test.ts`: `priceFormatted` fixtures changed from `$12.00`, `$15.50`, `$18.50` to `£12.00`, `£15.50`, `£18.50`, so mock data matches what the server now sends. `priceCents` fixture values are unchanged.

## What passed
- `npm run typecheck`
- `npm run lint`
- `npm test` (114 passed, 0 failed)
- Repo grep (excluding `node_modules`) for `$`, `USD`, `dollar`, `cents`: nothing left. The remaining `toFixed` hits are contrast ratios, not money.

## Unproven
- Not checked on a device or simulator: the app was not run against the updated server. The only user-visible use of the string is an accessibility label, so a screen reader will now say "£" instead of "$" once the server change is live.

## Next
- **Dave:** squash-merge the server PR first, then this one. No contract change, so no ordering risk beyond that.
