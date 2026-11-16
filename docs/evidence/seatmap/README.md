# Evidence: seat selection (branch `feat/seatmap`)

Screenshots are from an **Android emulator (Pixel_10a, API 37) running Expo Go 58.0.5**, scaled down from 1080 × 2424. The "real server" screens talk to the real matinee-server API from PR #21 on a throwaway local Postgres (with the 320-seat IMAX room seeded), not to mock data. **No Neon database was touched.** iOS and a real phone were not run.

## The component gallery (no network)

| File | What it shows |
|---|---|
| `gallery-seat-states-and-legend.png` | All six `Seat` looks at 36 and at the legend's 24, and the `SeatLegend` (two columns, the Figma words). |
| `gallery-skeleton-and-overview-126.png` | The Skeleton level and the 126-seat Overview (0.5×): centre aisle, D8 and D9 picked, hatching, wheelchair spaces at both ends of the back row, the "Screen" bar. |
| `gallery-zoomed-1x.png` | Zoomed, reached by tapping the Overview: row letters, mini-map with its viewport box, Plus and Minus. |
| `gallery-zoomed-1_5x-letters-aligned.png` | One step further in (Plus). The row letters stay level with their rows at this scale (a bug caught here and fixed). |

## The real screen, on real server data

| File | What it shows |
|---|---|
| `screen-overview-320-real-server.png` | "Pick your seats" for the IMAX showing: no NavBar, header "The Lantern Road · Mon 16, 20:30 · IMAX", the 320-seat room (16 rows × 20) at 0.3×, the legend, and the footer with the server's "£18.50 each", the preview note, and Continue disabled until a seat is picked. |
| `screen-zoomed-picked-and-continue-toast.png` | Zoomed, H14 and H15 picked: footer "2 seats · H14, H15", Continue enabled, and the honest Toast after pressing it ("Checkout isn't built yet. Your seats aren't held or booked."). |
| `screen-eight-seat-limit-toast.png` | Eight seats picked; a ninth is refused with "You can pick up to 8 seats." |
| `screen-after-two-finger-pinch-out.png` | After a real two-finger pinch out on the Overview: it settled on full-size seats, centred on the fingers. |
| `screen-after-pan-drag.png` | After a one-finger drag: the map moved, the row letters stayed level, and the mini-map's viewport box moved. |

## What the server sends, and what the screen does with it

Driven with a small dev-only mock in front of the real API (not committed) that serves special showtime ids; every other id goes to the real server.

| File | Server response | Screen |
|---|---|---|
| `state-sold-out.png` | 200, a full grid, **every seat `sold`** | "This showing is sold out", "See other times", disabled Continue. |
| `state-empty-rows-is-an-error.png` | 200, **`rows: []`** | **Error, not sold out:** "Couldn't load seats / No seats came back for this showing. Try again in a moment." with a Try again button. |
| `state-held-only-is-a-map-not-sold-out.png` | 200, no seat free but some **held** | The map ("0 of 126 seats available"): held seats can come back, so it is not sold out. |
| `state-not-found.png` | 404 | "This showing isn't available". |
| `state-server-overloaded.png` | 503 | "Server overloaded" with Try again. |
| `state-invalid-response.png` | 200, an unknown seat status | "Couldn't load seats" (the app never guesses how to draw a status it does not know). |
| `state-loading-skeleton.png` | slow response | The Skeleton level. It caught the pulse's faint phase: in light mode `skeleton/highlight` equals `surface/default`, so the blocks fade out at the peak, as the existing `Skeleton` does. |

## Dark mode

`dark-overview-320.png`, `dark-zoomed-picked.png`, `dark-sold-out.png`.

## Text records

| File | What it records |
|---|---|
| `worklets-version-check.txt` | **The worklets JS/native mismatch (0.13.1 vs 0.13.0) and the pin to 0.13.0**, read from the running app. Includes why the library's own check missed it. |
| `render-counts.txt` | Seat renders on the device: 320 on mount, 0 on zoom, **1 per pick**. |
| `performance.txt` | Frame timing while panning and pinching the 320-seat room, against a control, with the caveats. |
| `haptics.txt` | That `expo-haptics` ships in Expo Go, and Android's vibration log around each action: a tick on every pick and drop, a distinct warning at the 8-seat cap, and **nothing** on mount, zoom, pan, pinch, Plus, Minus or Continue. |

## Not shown, and why

- **Neon.** The seats table and the 844 seats are Dave's step after the server merge (see the server handoff note). Until then the real screen shows the empty-rows error.
- **iOS, a real phone, TalkBack and VoiceOver.** Not run. The accessibility tree was read with `uiautomator` (each seat exposes "Row D, seat 8, selected"), which shows the labels exist, not how a screen reader speaks them.
- **How the haptics feel, and iOS haptics.** The emulator proves the requests were made, not how they feel.
- **A running Countdown, and "seat taken by someone else".** Deferred to the traffic slice. The Countdown is in the gallery only.
