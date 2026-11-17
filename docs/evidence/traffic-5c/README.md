# Evidence: handling 429 and sending X-Client-Id on search (traffic slice 5c, mobile half)

Server half: matinee-server PR #24 (squash-merged as `eaaa82c`), ADR 0016. Everything below ran against that server's real rate
limiter over a throwaway Postgres 16 and Redis, with a stub movie source so search works without TMDB (see `device-run.txt`).
Dave's own Postgres, Redis, API and Metro were not touched. The server's structured request log and Redis are the oracle.

## Text records

| File | What it shows |
|---|---|
| `before.txt` | The baseline, committed first (`af78c13`): a 429 reaches the app as a plain "rejected" hold and a "Search failed" state, `retryable=false`, and search sends no `X-Client-Id` (only the address counter exists in Redis for search) |
| `before-probe.ts` | The script that produced it. Calls the app's own functions; nothing mocked |
| `after-probe.ts`, `after.txt` | The same checks on the finished code: `rateLimited` with `maybeHeld: false`, `retryable=true`, `X-Client-Id` on search (the `rl:search:u:...` key now exists), and the real retry policy timed against the server's `Retry-After` (asked 5 s, asked again 5.00 s later). Also typecheck, lint, the suite, a per-commit check, and the secret scan |
| `device-run.txt` | The device runs: the server's log lines for each, what the screen showed, runs I threw away and why, and what is not shown |
| `mutation-checks.txt` | Twelve deliberate breakages of the new logic, all caught by the new tests |

## Screenshots (1080 x 2400)

Android emulator Pixel_10a, Expo Go 58.0.5. No Figma frame exists for any of these states (see the handoff): they are built from the existing
`Toast`, `EmptyState` and `Button`.

| # | State |
|---|---|
| `before-search-failed-light` | Before: a 429 on search is "Search failed" with the server's raw sentence and a manual Try again |
| `before-hold-rejected-light` | Before: a 429 on Continue is an error Toast with the raw sentence and no Try again |
| 01 | Search refused: the skeleton stays and an info Toast says "Slow down a moment. Searching again shortly..." |
| 02 | The same search after the app asked again by itself: the results |
| 03 | Continue refused: "Slow down a moment, then try again." with Try again |
| 04 | After Try again: Continue shows it is working while the app waits out Retry-After (nothing is sent yet) |
| 05 | The hold taken once Retry-After had passed: the countdown runs, Change seats |
| 06 | Dark: the Continue Toast. The app then left the screen and sent no release (nothing was held) |
| 07 | Dark: the search Toast and skeleton |
| 08 | Dark: three automatic retries spent: "Too many searches" with a manual Try again |

01 to 05 and the two "before" images are light; 06 to 08 are dark.
