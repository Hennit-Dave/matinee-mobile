# Handoff: Seat holds, live countdown and polling, mobile side (branch `feat/seat-holds-mobile`)

Traffic slice 5b, mobile only. It uses the server from matinee-server PR #23 (merged, `fa7b363`; ADR 0015): `POST` and `DELETE /showtimes/:id/holds`, and `GET /showtimes/:id/seats` with real `held` and `sold`. Built from the Figma frames in file `76VKO0l9gGt5YMNYtH8yvM`: Overview `57:6720`, Zoomed `57:7114`, Hold under 2:00 `57:9738`, Seat taken `57:7594`, Hold expired sheet `57:11576` (light `57:12254`), `Countdown` `37:819`; Checkout `60:12130` is the destination of Continue and is not built here.

Decisions Dave made at the plan, applied as written: the footer label stays **"Continue"** in the held state (it matches the Figma held frames, and Checkout is its real destination), the states with no Figma frame are built from the existing `Button` and `Toast`, the **stale-refresh rule is refined** (below), and `expo-secure-store` and `expo-crypto` are added.

## The one rule I changed, and why

`resolveSeatsViewStatus` used to say: a failed refresh is an error even if an earlier map is in hand, because stale availability must never look live. That was written for a screen that fetched once. With a map that polls every ~5 s, a single dropped packet would wipe a half-made seat choice and replace the room with an error.

**New rule** (in the comment at `resolveSeatsViewStatus`, `src/api/seats.ts`, and unit-tested):
- One or two failed refreshes **in a row** keep the last good map on screen and show ONE Toast ("Can't refresh seats. Trying again…").
- The **third in a row** is an error, as before, and polling stops (the error screen has Try again).
- Nothing to show (a failed first load), no failure count (a one-off fetch), or a showing that has gone (404) behave exactly as before.

The reason for the original rule still holds, which is why this is a refinement and not a reversal: nothing is lost by keeping the map, because Continue is safe on any map (the server decides every hold and refuses a taken seat), the failure is announced, and the third failure stops the pretence. No ADR recorded the original rule (it lived in that code comment and in `2026-11-16-seatmap-mobile.md`), so the refinement is recorded in the same two places and there is no ADR to amend. Measured: `docs/evidence/traffic-5b/polling.txt`.

## What changed

- **Contract, hand-written** (`src/api/holds.ts`, and `movies.ts` for the shared fetch): interfaces and type guards mirroring `matinee-server/src/bookings/booking.ts` and the new error codes (`seat_taken`, `seat_not_held`, `holds_unavailable`), no zod. `fetchApiJson` gained optional request options (method, headers, JSON body) and the error carries `seatIds` and `Retry-After`; a plain GET is unchanged (a test pins it). `classifyHoldError` turns any failure into one of four: **taken** (409, nothing held), **unavailable** (503, may be held), **rejected** (the server said no on purpose, nothing held), **uncertain** (no usable answer, may be held).
- **Install id** (`clientId.ts`, `clientIdNative.ts`): one UUID per install from `expo-crypto`, kept in `expo-secure-store`, sent as `X-Client-Id` on hold, release and seat requests. Generate once, many callers share one lookup, a corrupt stored value is replaced, and if storage cannot be read the id lives in memory for the run (a stored one is never overwritten). A stand-in for a user id, not authentication.
- **Hold flow** (`holdMachine.ts`, `useSeatHold.ts`): a plain controller with injected network, clocks and timers, so it is unit-tested without React Native: idle, acquiring, held, expired. One Continue sends one request (a second tap is ignored). The rule it exists to keep: **if the server might be holding seats for us, leaving gives them back** (`maybeHeld`): a request in flight when you leave is released the moment it lands; a request with no answer, or a 503 from a Redis outage (a command sent just before the outage can still land, ADR 0015), is released on leave. A refusal the server made on purpose is not. After a 503 the next attempt waits out `Retry-After` (2 s). Expiry, "Change seats" and leaving all release.
- **Countdown** (`holdClock.ts`, `LiveCountdown`): seeded from the server's `expiresInMs` (a duration, so no clock comparison); elapsed time is the **larger of a monotonic and a wall reading**, so a long sleep or a changed clock can only shorten it, never lengthen it; rounded up so "0:00" means over; ticks on the second; announced to a screen reader at 5:00, 2:00, 1:00 and 0:30 and at the end. `Countdown` itself stays presentational.
- **Polling** (`seatsPolling.ts`, `useSeats.ts`, `usePollActive.ts`): every 5 s ±20 %, only while the screen is focused and the app is in the foreground, an immediate refresh on return, stops after three failed refreshes. TanStack's structural sharing keeps unchanged rows as the same objects.
- **The seat screen** (`src/app/showtime/[id]/seats.tsx`): Continue takes the hold; the header shows the countdown; the seats are drawn "Yours" (the server calls them `held`, so `withOwnHold` re-draws them); the map locks while holding; **Change seats**; the expiry sheet (`BottomSheet`, Figma `57:11576`); a Toast for each thing that can happen (`seatNotices.ts`, unit-tested): seats taken before Continue (a refresh finds it, or a 409), `holds_unavailable` with a **Try again** action, "could not confirm", the stale map. "Preview only: seats aren't held" is gone.
- **Gallery and docs:** `LiveCountdown` is in the Feedback section (the live demo restarts), `Countdown` gained an "ended" state; `COMPONENTS.md` (Countdown, LiveCountdown, BottomSheet, seats, haptics), the README section "Seat holds, the install id and live seats".
- **Dependencies:** `expo-secure-store ~58.0.3`, `expo-crypto ~58.0.8` (Expo's own SDK 58 pins). `app.json` has the secure-store config plugin with `faceIDPermission: false`.

## What passed

- `npm run typecheck`, `npm run lint`: clean.
- `npm test`: **276 passed, 0 failed** (94 new on top of the 182 before). New files: `holds.test.ts` (contract, request shape, error mapping), `clientId.test.ts`, `holdClock.test.ts`, `holdMachine.test.ts` (28: every sequence, including leaving mid-request), `seatsPolling.test.ts`, `seatNotices.test.ts`; additions to `seats.test.ts` and `seatMapLogic.test.ts`.
- **The tests can fail.** `evidence/traffic-5b/mutation-checks.txt` breaks the logic eight ways (seed from `expiresAt`, monotonic clock only, no release on expiry, no release for a request that lands after leaving, a network failure treated as a clean refusal, polling that ignores focus, an overlay that un-sells a sold seat, a tolerance off by one); each is caught, then restored.
- **On the device** (Android emulator Pixel_10a, Expo Go 58.0.5, throwaway local server, Postgres 16 and Redis; light and dark): the whole flow, with the server's request log and Redis as the oracle: `hold-lifecycle.txt`. A real hold (2 keys owned by the install id, PTTL ≈ 597 s, countdown "9:58 left"); a second user sees them held; Change seats releases (2 keys to 0); a seat taken by someone else is found by a poll within 2 s, named in a Toast, and dropped; a 409 when the map had not caught up; Redis down gives a 503 with `Retry-After: 2` and a Try again Toast; three failed polls give the error screen and stop polling; system BACK releases; the hold ending sends the release at the moment the pill reaches 0 and shows the sheet. 1.3× text size fits (`20-held-1.3x-text-dark.jpg`).
- **Polling** measured from the server's own log: 6 requests in 30 s focused, 0 while blurred, 1 immediately on return, 0 in the background, 1 immediately on resume, then continuing: `polling.txt`.
- **Render counts** on the device: holding two seats redraws 0 seats, the polls that then say they are `held` redraw 0, another user's seat changing redraws 1: `render-counts.txt`.
- **The two new native modules** (`client-id.txt`): the classes are in Expo Go 58.0.5, the pins equal Expo's SDK list, `expo install --check` is clean, and the same install id appeared on the server across a force-stop. The APK carries no per-module version, so unlike worklets the native version could not be read directly.
- Baseline first: `before.txt` (commit `8cfe652`): Continue was inert, 0 polls, 0 holds.

## Deviations from Figma, on purpose

- **Footer shows the per-seat price, not a total** (Figma shows £24.00): the server sends no total and the app never computes money. Carried from the seat-map slice; the checkout total will be server-calculated.
- **The "taken" Toast names the seat** ("Seat J5 was just taken. Pick another.") where Figma `57:7594` says "That seat was just taken. Pick another." The brief asks to say which.
- **No Figma frame exists for**: Change seats, the 503 Toast with Try again, the "could not confirm" Toast, the "Can't refresh seats" Toast, and the "Your seats are held" Toast on the locked map. All are built from the existing `Button` text variant and `Toast`, as agreed. The "Change seats" label is indented by its own padding, so it is pulled back (`marginLeft: -space/4`) to line up with the footer text.
- **Every way out of the expiry sheet (scrim, drag, back) does what the button does**, because the seats are already gone and there is nowhere else to go. The "10-minute" in the sheet is Figma's wording; the window itself is the server's.
- Figma draws the hold Countdown on the Overview frame before anything is held (its mock has the hold running from the first tap). The locked decision is a hold at Continue, so the countdown appears only once seats are held.

## Unproven

- **A real phone, iOS and TalkBack/VoiceOver.** The screen-reader announcements (`announceForAccessibility` at 5:00, 2:00, 1:00, 0:30 and the end) were never listened to. The warning haptic for lost seats was not measured the way the seat-cap one was.
- **Real Neon, Railway Redis, and the k6 load.** Everything ran against a throwaway local server. The 600 s window was observed from its start (9:58); the urgent and expired states were captured against a **scratch server with a 150 s TTL** (a copy of the server's `main.ts` kept outside the repo; the server repo stayed clean), not by waiting ten minutes.
- **A phone that really sleeps.** The "larger of two clocks" rule is unit-tested with injected readings (a long sleep, a clock set back or forward); deep sleep was not provoked on the emulator.
- **Hook wiring is not unit-tested** (no React Native renderer, ADR 0005): `useSeatHold`, `useShowtimeSeats`, `usePollActive` and `LiveCountdown` are shown by the device runs above, while every decision inside them is a tested pure function.
- **A hold lost early** (a Redis flush) is only discovered when the countdown ends or at confirm in the payments chapter (`seat_not_held`): the map cannot say whose `held` a seat is. **A killed app cannot release**: its hold lingers until the 10-minute TTL (seen once on the emulator).
- **Dev-only quirk:** an Expo Go process started before a native-module package was installed cannot load it on fast refresh (`Cannot find native module 'ExpoCrypto'`); relaunch the app after `npm install`. A real build is unaffected.
- Layout was checked at 1.3× text in dark with seats held, not at every size or on a 320-wide phone.

## Deferred (not built here)

- Checkout, payment, the booking confirm, the ticket and QR, BullMQ jobs: **the payments chapter**. The app never calls `POST /showtimes/:id/bookings`.
- Rate limiting per user and per IP and the per-owner hoarding cap: **5c**. The waiting room and graceful overload: **5d**. The k6 500-user / 50-seat load test, `TRAFFIC.md`, `SHARDING.md`: **5e**.

## Notes for the payments chapter

- Figma Checkout (`60:12130`) shows a countdown too ("7:41 left"): the same hold. `createHoldController` is store-like (create, attach, detach) so it can be lifted above the screens. **This slice releases when the seat screen unmounts because nothing comes after it;** once Checkout exists, moving forward must not release.
- Confirm checks the caller still holds every seat (`409 seat_not_held`). The error code and `seatIds` are already in the contract mirror.

## Next

- **Dave:** check CI, then squash-merge. No migration, no environment variable, **no EAS build** (there is no `eas.json` yet; the two native modules join the first dev build automatically).
- Close the chat and write your `LEARNING-LOG.md` paragraph (your words only).
- `LEARNING-LOG.md` is untouched.
