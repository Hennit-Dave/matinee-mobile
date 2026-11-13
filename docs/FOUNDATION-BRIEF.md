# Matinee: approved foundation brief

Cinema ticket booking app for Android, built in React Native with Expo.
Approved on 10 November 2026.

## Source of truth

- Figma file: https://www.figma.com/design/76VKO0l9gGt5YMNYtH8yvM
- Code: `tokens.ts` (154 variables, checked to match Figma exactly)
- Rule: any token change is made in Figma and `tokens.ts` together.

## Colour

- **Direction:** Projector. No brand hue. Posters supply the colour; the interface is the dark room.
- **Surfaces:** near-black `#0E0E0F` in dark, warm off-white `#F6F5F2` in light.
- **Primary action:** off-white in dark, ink `#131314` in light.
- **Urgent:** orange (`#FF5B2E` dark, `#C93A0C` light), reserved for the hold countdown under 2:00.
- **Status:** green (success), amber (warning), red (error), blue (info).
- **Naming:** button tokens are `primary/*` and `secondary/*`. There is no second brand colour.
- **Contrast:** every text pair clears 4.5:1 in both themes.
- **Dark theme:** designed in its own right; height is shown by lighter surfaces and a hairline border, not shadow.

## Seat states

Shape carries the state; colour only reinforces it.

| State | Shape | Token |
|---|---|---|
| Available | Empty outline | `seat/available` |
| Selected | Solid fill with a tick | `seat/selected`, `seat/selected-mark` |
| Held | Solid fill with diagonal hatching | `seat/held` |
| Sold | Dim fill with a cross | `seat/sold`, `seat/sold-mark` |
| Wheelchair | Circle with the access glyph | `seat/accessible` |

## Typography

- **Newsreader 400** for film titles and the ticket: `type/display` (32/40), `type/title-lg` (24/32).
- **Inter 400, 500, 600** for everything else:

| Token | Size / line height | Weight |
|---|---|---|
| `type/title` | 20 / 28 | 600 |
| `type/body-lg` | 16 / 24 | 400 |
| `type/body` | 14 / 20 | 400 |
| `type/label-lg` | 16 / 24 | 600 |
| `type/label` | 14 / 20 | 500 |
| `type/caption` | 12 / 16 | 500 |

- Text scales with the system font size; containers use minimum heights.
- The nav bar and seat labels cap at 1.3x.
- Countdown and prices use tabular figures.

## Other tokens

| Group | Values |
|---|---|
| Spacing | 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 |
| Radii | `sm` 4, `md` 8, `lg` 16, `full` 999 |
| Touch target | `size/touch-min` 48 |
| Controls | button 48, input 48, chip 32 |
| Icons | 16, 20, 24 |
| Seats | `size/seat` 36, `size/seat-gap` 8 |
| Nav bar | `size/nav-height` 56 |
| Elevation | three levels: `elevation/1` cards, `/2` toasts, `/3` sheets |
| Durations | fast 150 ms, base 250 ms, slow 350 ms, celebrate 600 ms |
| Easing | standard, enter, exit |

With reduced motion on, everything becomes a 150 ms fade.

## Product decisions

- **Navigation:** floating rounded pill with Home, Tickets and Account. It sits 16 above the gesture area and hides during Seat selection and Checkout.
- **Search:** included.
- **Showtimes:** its own screen, opened from Movie detail.
- **Sign-in:** email plus a six-digit code, as a bottom sheet when a showtime is tapped. Browsing needs no account.
- **Payment:** the payment provider's own sheet, not a custom card form.
- **Seat map:** two levels. The overview shows the whole room and zooms on tap; zoomed seats are full size and tappable. Plus and minus buttons sit alongside pinch, a mini-map shows position, and selected seats stay visible in the overview.
- **Countdown:** plain secondary text until 2:00, then a filled urgent pill with heavier weight.

## Screens

| Flow | Screens |
|---|---|
| Browse | Home, Search |
| Movie | Movie detail, Showtimes |
| Booking | Waiting room, Seat selection, Accessible seat sheet, Hold expired sheet |
| Payment | Checkout, Confirming booking, Booking confirmed |
| Tickets | Tickets, Ticket detail |
| Account | Sign-in sheet, Code entry sheet, Account, About |
| System | No internet, Server overloaded, Something went wrong, Component gallery |

All loading states use skeletons. All 12 required components are used: Button, Text, Card, MovieCard, Input, Chip, Badge, BottomSheet, Skeleton, Toast, EmptyState, SeatMap.

## Required states and where they live

| State | Screen |
|---|---|
| Movie data unavailable, showing saved data | Home, Movie detail |
| Server overloaded with retry | Server overloaded screen |
| Hold expired mid-checkout | Checkout, via the Hold expired sheet |
| Seat taken at the moment of tapping | Seat selection |
| Payment failed | Checkout |
| Payment made, confirmation delayed | Confirming booking, then Tickets and Ticket detail as pending |
| Showtime cancelled and refunded | Tickets, Ticket detail |
| Sold-out showtime | Showtimes, Seat selection |
| No internet | No internet screen; Tickets and Ticket detail work from saved data |

## Next step

Screen design, once the reference study (Peacock, Hulu, Prime Video, Disney+, HBO Max) is done and the screen-build prompt is written.