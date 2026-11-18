# Evidence: the waiting room, the busy screen and the hold cap (traffic slice 5d, mobile half)

Server half: matinee-server PR #25 (hold caps, ADR 0018, squash-merged `b9e0df0`) and PR #26 (waiting room + load shedding, ADR 0017, squash-merged
`0f4f92f`). Everything below ran against that server over a throwaway Postgres 16 and Redis, with a stub movie source so the app needs no TMDB (see
`device-run.txt`). Dave's own Postgres, Redis, API and Metro were not touched. The server's structured request log is the oracle.

## Text records

| File | What it shows |
|---|---|
| `before.txt` | The baseline, committed first (`26e2b19`): with the room on, the shipped app cannot book at all. The seat map and every hold are refused with `403 waiting_room_required` and the screen is a dead end ("Couldn't load seats" and the server's raw sentence); the 9th seat shows the server's raw sentence, not a limit; a shed `503` is a plain EmptyState with no countdown |
| `before-probe.ts` | The script that produced it. It calls the app's own functions; nothing mocked |
| `after-probe.ts`, `after.txt` | The same questions on the finished code, with the real queue machine and real timers: an empty room (straight in, the map loads), a full room draining in real time (`ahead` 2, 1, 0, then "Your turn"), a lapsed pass re-joined silently and the hold taken, the hold cap in the server's numbers, and a saturated server (busy countdown, automatic retry, recovery). Also typecheck, lint, the suite, a per-commit check and the secret scan |
| `device-run.txt` | The device runs, with the server's log lines for each, what the screen showed, a bug the device run found and its fix, and what was not shown |
| `mutation-checks.txt` | Twenty-three deliberate breakages of the new logic, all caught by the new tests (the first run caught 21 of 23 and exposed two weak tests, which were then fixed) |

## Screenshots (1080 x 2424)

Android emulator Pixel_10a, Expo Go 58.0.5. Light unless the name says dark.

| # | State | Figma |
|---|---|---|
| `before-seats-403-light` | Before: the seat screen against a room that is on. A dead end | |
| 01 | Admitted straight in (empty room): the seat map | |
| 02 | The same map after the server forgot the pass under it: the app joined again by itself, nothing changed on screen | |
| 03 | Waiting, "11 people ahead of you", with the film and showing | `56:6607` |
| 04 | The same, dark | `56:6586` |
| 05 | Dark with the system text at 1.3x | `56:6708` |
| 06 | Nobody ahead: "You're next" | none (built from the same type tokens) |
| 07 | Just let in after waiting: the "Your turn" Toast above the footer; the map is still loading | none |
| 08 | A refused poll while waiting: the place is kept and the freshness line says "Trying to update..." | none |
| 09 | The server is saturated when the showing opens: the join is refused, the busy screen at once, "Trying again in 0:03" | `107:15558` |
| 10 | The countdown ended under continued overload: the app tried again by itself and started a new one (0:12) | `107:15558` |
| 11 | The server was let go: the next automatic try joined the line | `56:6607` |
| 12 | Waiting, then saturated: after three refused polls the busy screen replaces the line | `107:15558` |
| 13 | On the seat map, saturated: the first refused refresh keeps the map and shows the existing "Can't refresh seats" Toast | existing |
| 14 | The third refused refresh: the busy screen inside the seat screen, header kept | `107:15558` |
| 15 | After a pass that lapsed while the server was busy (the bug the device run found, fixed): the seat map is back | |
| 16 | The hold cap: "You can hold up to 8 seats for one showing." (the 8 is the server's number) | none |
| 17 | Continue pressed with the pass gone: re-joined and held in about 130 ms, A3 held, the 9:57 countdown | `57:6720` |
| 18, 19, 20 | Gallery: "You're next", stale, and the skeleton | `56:6691` |

No Figma frame exists for the "You're next" state, the "Your turn" Toast, the stale freshness line or the hold-cap Toast (see the handoff).
The waiting-room note deliberately differs from Figma's: it says "Keep Matinee open" where Figma promises a notification the app does not send.
