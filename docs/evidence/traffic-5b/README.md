# Evidence: seat holds, live countdown and polling (traffic slice 5b)

Android emulator Pixel_10a, Expo Go 58.0.5, against a throwaway local `matinee-server` (main at `fa7b363`) with a throwaway
Postgres 16 and Redis. Dave's own Postgres, Redis, Metro and API were not touched. The server's structured request log and
Redis itself are the oracle for every claim about holds. Each text file says exactly how it was measured and what it does not show.

## Text records

| File | What it shows |
|---|---|
| `before.txt` | The baseline, committed first (`8cfe652`): Continue inert, 0 polls in 30 s, 0 holds, no user id in the log |
| `hold-lifecycle.txt` | One hold from Continue to its end, as the server saw it: Redis keys and TTL, a second user's view, Change seats, contention (poll and 409), Redis down (503, `Retry-After`), leaving, expiry |
| `polling.txt` | Requests per window while focused, blurred, backgrounded and resumed, counted from the server's log; the three-failures behaviour; a run I threw away and why |
| `render-counts.txt` | Seat renders on the device for polls, other users' changes, picking and holding |
| `client-id.txt` | The two new native modules in Expo Go, the pins, and the install id persisting across a force-stop |
| `mutation-checks.txt` | Eight deliberate breakages, all caught by the new tests |
| `after.txt` | Typecheck, lint, the test suite, and the secret scan |

## Screenshots (1080 x 2400, light unless the name says dark)

Frames are Figma file `76VKO0l9gGt5YMNYtH8yvM`. Images 02 to 04 and 08 to 13 are from the real 600 s server (the countdown starts at 9:58). Images 01, 05 to 07 and 14 to 20 are from a scratch server with a 150 s window (so a countdown there starts at 2:30), because the urgent and expired states cannot be reached in ten minutes of test time (see `hold-lifecycle.txt`).

| # | State | Figma |
|---|---|---|
| `before-idle-light.png`, `before-continue-toast-light.png` | Before: the inert Continue and its honest Toast | `57:6720` |
| 01, 14 | Two seats picked, no countdown, Continue enabled | `57:6720` |
| 02, 15 | Held: calm countdown in the header, seats "Yours", Change seats | `57:6720`, `57:7114` |
| 03 | Continue while held: the payment-deferred Toast | Checkout `60:12130` is the destination |
| 04 | A tap on the locked map: a Toast, no request | none (existing `Toast`) |
| 05, 16 | Under 2:00: the filled orange pill | `57:9738` |
| 06 | The last seconds ("0:06 left") | `57:9738` |
| 07, 17 | The hold ended: "0:00 left", the sheet "Your seats were released", seats still "Yours" | `57:11576`, `57:12254` |
| 08, 19 | A 409: the seat was taken before Continue; Toast names it, the map refetches, the pick is dropped | `57:7594` |
| 09, 18 | Another user's hold found by a poll: the seat turns held, Toast, the footer recounts | `57:7594` |
| 10 | Redis down: "Seats are temporarily unavailable" with Try again | none (existing `Toast` with an action) |
| 11 | One failed poll: the map stays, "Can't refresh seats. Trying again…" | none (existing `Toast`) |
| 12 | Three failed polls in a row: the existing "Server overloaded" state | `107:15536` |
| 13 | After Redis returns and Try again: the map is back and the pick was kept | |
| 20 | Held at 1.3x text size, dark | the 1.3x frames in the Booking page |
| 21, 22 | Gallery: `LiveCountdown` live, calm then urgent | gallery |

Mode: 14 to 20 and 21 and 22 are dark; the others are light.
