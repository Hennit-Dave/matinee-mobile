# Handoff: Seat selection, mobile side (branch `feat/seatmap`)

Mobile PR of two. It mirrors the contract from matinee-server PR #21 (merged: `GET /showtimes/:id/seats`, ADR 0014). Built from the Figma frames in file `76VKO0l9gGt5YMNYtH8yvM`: Overview `57:6720`, 300+ `57:8938`, Zoomed `57:7114`, Seat taken `57:7594`, Sold out `57:8080`, Hold under 2:00 `57:9738`, `SeatMap/Seat` `19:58`, plus `SeatMap` `54:4988` (four levels, including Skeleton), `SeatMap/Legend` `19:59` and `Countdown` `37:819`.

## The two things to check closely

**1. An empty grid is an error, never "sold out".**
- `resolveSeatsViewStatus` ([seats.ts](../../src/api/seats.ts)): a 200 with no seats at all (`rows: []`, or rows holding no seats) is the retryable `error` state. Sold out is read **only from seat statuses**: a full grid in which every seat is `sold`. A room whose seats are only held or sold is **not** sold out (held seats can come back); it stays a map.
- A failed refresh is an error even if an earlier response is in hand: stale availability is never drawn as live.
- Unit tests name both rules (`EMPTY ROWS ARE AN ERROR, NOT SOLD OUT`, `SOLD OUT IS DRIVEN BY SEAT STATUSES`) and the held-only case.
- **Verified on the device** with a dev-only mock serving specific showtime ids (not committed): `rows: []` shows "Couldn't load seats / No seats came back for this showing. Try again in a moment." with Try again; a full all-sold grid shows "This showing is sold out"; a held-only room shows the map. See `docs/evidence/seatmap/state-*.png`.

**2. `react-native-worklets`: there WAS a mismatch, now pinned to 0.13.0.**
- Read from the running app (Expo Go 58.0.5, Android emulator): **JS 0.13.1, native 0.13.0** (Reanimated JS and native were both 4.7.1).
- The library's own check did not catch it: `matchVersion` compares **only major and minor and skips the patch**, so 0.13.1 vs 0.13.0 passes silently. "No mismatch error" proved nothing; the Skeleton working proved even less.
- Pinned: `react-native-worklets` added to `package.json` as an exact `0.13.0` (it had only been a peer that npm resolved to 0.13.1). The lockfile moves that one package, plus `"peer"` markers. After the pin the running app reports `js=0.13.0 native=0.13.0`.
- Then exercised on the pinned versions, with **0 worklets or JS errors in the device log**: tap, the tap-to-zoom animation, one-finger pan, and a **real two-finger pinch** out and in (sent through the emulator's gRPC `sendTouch`; `sendevent` is not allowed on this image and the console route did not reach the app). Record: `docs/evidence/seatmap/worklets-version-check.txt`.

## What changed

- **Contract, hand-written** ([seats.ts](../../src/api/seats.ts), [useSeats.ts](../../src/api/useSeats.ts)): interfaces mirroring the server field for field, a type guard that checks the whole response (an unknown seat `kind` or `status` is rejected rather than drawn wrongly), a URL builder that validates the showtime id, and `useShowtimeSeats` (`retry: false`, `staleTime: 0`, `gcTime: 0`). No zod and no change to the other contracts, as asked.
- **`SeatMap`, `Seat`, `SeatLegend`, `Countdown`** ([components](../../src/components/)): tokens only (every colour, size, space and radius is a token; `tokens.ts` untouched). Decisions that need no renderer live in `seatMapLogic.ts` and `countdownLogic.ts` and are unit-tested.
  - The whole map is one layer moved and scaled on the UI thread; rows are memoized on their own picks. **Measured on the device: picking a seat re-renders 1 `Seat`, not 320** (a cold mount renders all 320 once; zooming renders none).
  - Overview (0.5×, 0.3× for 300+ seats), Zoomed (row letters, mini-map, Plus and Minus), Skeleton. Tap on the Overview zooms; pinch settles on the Overview, full size or 1.5×; pan exists only while zoomed (so the Overview never swallows a parent list's scroll).
  - `Icon` gained `plus` and `minus` (geometry from the Figma assets).
- **"Pick your seats"** ([seats.tsx](../../src/app/showtime/[id]/seats.tsx)): a root-level route, so the NavBar (which lives in the tabs layout) is not drawn. States: loading, ready, sold out, not found, server overloaded, error. Footer: "2 seats · D8, D9" over **the server's `£18.50 each`** (no money maths or formatting in the app); Continue is disabled until a seat is picked and then shows the honest Toast, with a "Preview only: seats aren't held or booked yet." note. A cap of 8 seats is a UI guard only.
- **Routing:** the showtime chip now pushes `/showtime/[id]/seats` with the slot id and the movie title (display only). `GestureHandlerRootView` added at the root (RNGH v3 throws in dev without it).
- **Gallery:** `Seat`, `SeatLegend`, `SeatMap` in a new Seats section and `Countdown` under Feedback, all out of `PLANNED_COMPONENTS` (still planned: QRCode, Switch, ListRow). `registry.test` enforces it.
- **Haptics** (added to this branch after the first push):
  - `expo-haptics` installed with `npx expo install expo-haptics`, which picked `~58.0.8`, Expo SDK 58's own pin (not hand-chosen). `expo install --check` reports everything up to date. **It ships in Expo Go**: Expo Go 58.0.5's `classes3.dex` contains `expo/modules/haptics/HapticsModule`, so there is no new EAS build.
  - **`src/lib/haptics.ts`** is the one shared place for haptic calls, for other screens to reuse: `selection()`, `impactLight()`, `warning()`. Each is fire-and-forget (returns nothing, never a promise) and safe: a no-op on the web and where the native module is missing, and it swallows any throw or rejection (`expo-haptics` reports a missing module as a rejected promise). The safety logic is in `hapticsCore.ts`, unit-tested without React Native (8 tests, including "no unhandled rejection").
  - **Wired on the seat screen only:** a `selection()` tick on every pick **and** drop, and a `warning()` at the 8-seat cap (alongside the existing Toast). The rule is `selectionHaptic` in `seatMapLogic.ts`, tested. Nothing on scroll, pan, pinch, zoom or render, none on a tap that changes nothing, and none on the inert Continue. The gallery demo maps do not buzz.
  - **Measured on the device** from Android's vibration log: 0 on mount, zoom, pan, pinch, Plus, Minus, a gutter tap and Continue; 1 tick per pick and per drop (8 picks gave 8); and the ninth seat gave 1 distinct, longer warning (223 ms against 52 ms). Record: `docs/evidence/seatmap/haptics.txt`.
- **Docs:** `COMPONENTS.md` "Built" notes, deviations and the haptics helper; evidence under `docs/evidence/seatmap/`.

## What passed

- `npm run typecheck`, `npm run lint`: clean.
- `npm test`: **182 passed, 0 failed** (68 new on top of the existing 114: 16 for the seats contract and view status, 40 for the map logic, 4 for the Countdown, 8 for the haptics helper).
- On the Android emulator against the real server (PR #21, throwaway local Postgres, 320-seat IMAX room): header, 320-seat room, legend, footer price, pick and drop, the 8-seat limit and Toast, Continue Toast, tap-to-zoom, Plus and Minus (Plus greys out at the limit), pan, two-finger pinch, dark mode, every state in the table above.
- `gitleaks detect`: 29 commits scanned, no leaks.

## Deviations from Figma and from the plan, on purpose

- **Footer shows the per-seat price, not a running total** (Figma shows £24.00): totals are deferred and server-calculated.
- **No Countdown on the live screen** (Figma has it in the header): nothing is held yet, so a counting pill would mislead. It is built and in the gallery.
- **300+ Overview gaps and aisle scale with the seats** (about 2.4 and 12) where Figma keeps 4 and 20, because the whole map is one transformed layer. The 0.5× Overview is exact. The "Screen" bar is the flat pill Figma draws, not a curve.
- **Plus steps to a 1.5× stop** so it is never a dead control while zoomed.
- **`EmptyState` is vertically centred** by the shared component; Figma `57:8080` draws the sold-out message right under the header. I tried wrapping it and that collapsed the shared component (`flex: 1`), so I reverted rather than fork it.
- **`runOnJS`** is used from Reanimated (deprecated there in favour of `scheduleOnRN` from `react-native-worklets`); `react-native-worklets` is now declared, so switching is possible later.

## Unproven

- **Neon.** The seats table and 844 seats are not there until Dave runs `npm run db:migrate` then `npm run db:seed -- --seats-only` on matinee-server (see its handoff note). Until then the real screen shows the empty-rows **error** (which is the point of check 1).
- **A real phone and iOS.** Not run. Frame timing on the emulator: panning the 320-seat room is 22% janky and pinching 28%, against 5.7% for a plain scroll on the same device and touch path, with frame times of 17–19 ms, 0 missed vsyncs and 0 slow-UI-thread frames (`performance.txt`). Not proven on a phone, and a room full of sold seats (one SVG cross each) was not measured. The ADR 0014 fallback is to draw the grid as one `react-native-svg` element.
- **How the haptics feel, and iOS.** The emulator's vibration log proves the requests were made by Expo Go's native module and when, not how they feel. iOS (`UIImpactFeedbackGenerator` and friends) was not run, and neither was a real Android phone.
- **TalkBack and VoiceOver.** The accessibility tree exposes each seat ("Row D, seat 8, selected") and the activate actions, but nobody has listened to it.
- **Seat limit and Continue Toast on iOS.** Android only.
- One React Native log line appeared once while scrolling the gallery: "Can't cancel already finished gesture". It did not recur and had no visible effect.
- In the gallery, dragging inside a **zoomed** map pans the map, not the page (documented on screen); the real screen has no scrolling list, so it does not matter there.

## Deferred (not built here)

- Live Redis seat holds, the running 2:00 countdown, seat-taken-by-another-user, and hold expiry: traffic slice (Requirement 5).
- The running price total, Continue into checkout, payment, booking, ticket and BullMQ jobs: payments slice (Requirement 4). The total will be server-calculated; the app never does money arithmetic.

## Next

- **Dave:** squash-merge matinee-mobile after checking CI. Run the two matinee-server commands on Neon first if you want the real screen to show seats.
- `LEARNING-LOG.md` is untouched.
