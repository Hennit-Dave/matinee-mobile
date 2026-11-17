# Handoff: Handling 429 and X-Client-Id on search, mobile side (branch `feat/rate-limiting-mobile`)

Traffic slice 5c, mobile only. It uses the server from matinee-server PR #24 (squash-merged, `eaaa82c`; ADR 0016), which added `429 rate_limited` with a `Retry-After` header. Built exactly as the approved 5c plan's "Mobile PR" section lays out (no plan-wait, as agreed). Hand-written contract, no zod. Polling, `tokens.ts`, `.env`, `LEARNING-LOG.md` untouched.

## What changed

- **Contract, hand-written** (`src/api/movies.ts`, `holds.ts`): `rate_limited` joins `ApiErrorCode`; `isRateLimitedError` is its type guard; a 429 is `retryable`; its `Retry-After` is read (`retryAfterMs`, shared by the 503 and 429 paths). `classifyHoldError` gets a **`rateLimited`** kind with **`maybeHeld: false`**: the limiter runs before the hold script (ADR 0016), so nothing was held, unlike a 503 where a command may already have reached Redis (`maybeHeld: true`, unchanged).
- **Hold flow** (`holdMachine.ts`, `seatNotices.ts`): a `rateLimited` outcome gates the next attempt on `Retry-After` exactly like a 503 does, and leaving sends no release. The seat screen shows an `info` Toast "Slow down a moment, then try again." with **Try again**.
- **Search** (`searchHelpers.ts`, `useMovies.ts`, `search.tsx`): `X-Client-Id` is sent, so the per-install search limit now applies as well as the per-address one. A 429 is retried by TanStack after `Retry-After`; the skeleton stays, a Toast says "Slow down a moment. Searching again shortly...", and "Search failed" never shows. Only a 429 is retried; every other failure behaves as before.
- **Docs:** a README section, this note, `docs/evidence/traffic-5c/`.
- **No new dependency, environment variable, migration, service or native build.**

## Decisions I made that you may want to change

- **Auto-retry is bounded: 3 retries, then an error state.** The brief says "auto-retry after Retry-After"; an endless loop behind a busy shared address (carrier-grade NAT, ADR 0016) would keep a phone asking forever. After the third retry the screen shows "Too many searches / Give it a moment, then try again." with a manual Try again (the existing `EmptyState`). `SEARCH_RATE_LIMIT_RETRIES` in `searchHelpers.ts`; set it high to approximate "forever".
- **Never retry sooner than 1 s** (`SEARCH_MIN_RETRY_MS`), whatever the header says: a `0` must not become a tight loop. The server's own value is at least 1 s.
- **The hold wait can be long.** After a 429 the Continue button shows its working state for the whole `Retry-After`, which the server computes from the minute-aligned window: 15 s in the device run, but up to the app's 60 s cap if the install's 10-a-minute limit was just hit. That is "wait it out like a 503" as specified; leaving the screen cancels it. If a minute of spinner feels wrong, the alternative is to disable Continue with a countdown instead; that needs a Figma frame.
- **A 429 with no readable server envelope** (an HTML page, or JSON in another shape) is `retryable` but is NOT called `rate_limited`, so a hold stays cautious (`uncertain`, `maybeHeld: true`): it cannot be told apart from something in front of the server. Pinned by tests.
- **Tone `info`, no buzz** for the slow-down Toast: it is a nudge, not a failure of the app. The brief's "slow down a moment" wording is kept; the search Toast and the "Too many searches" copy are mine.

## What passed

- `npm run typecheck`, `npm run lint`: clean. `npm test`: **302 passed, 0 failed** (276 on main + 26 new). Every commit passes on its own (276, 286, 294, 302).
- **The tests can fail.** `evidence/traffic-5c/mutation-checks.txt`: twelve breakages (a 429 treated as maybe-held, no wait after a 429, 429 not retryable, Retry-After ignored, the retry cap off by one, retrying every failure, no `X-Client-Id`, a non-UUID id sent, no 1 s floor, a buzz, a stuck "waiting" flag, an unreadable 429 called `rate_limited`). All caught, then restored. My first version of the retry tests hung instead of failing when the code retried too often; I fixed that before using them (they now assert the search *ended*).
- **The retry policy runs for real in a test**: a real `QueryClient` with the very options the hook uses, a stand-in for fetch, mocked timers. A 429 then success waits exactly `Retry-After` (1 ms short is still waiting); a 429 that never stops is retried exactly three times and then never again; a 500, 503 or 404 is not retried.
- **Against the real limiter** (`before.txt`, `after.txt`): before, a 429 was `kind rate_limited` only by accident of a cast, `retryable=false`, a plain `rejected` hold, status `error` on search, and the search request carried no headers. After: `rateLimited` / `maybeHeld:false` / `retryable=true`, `X-Client-Id` on search (the `rl:search:u:<install>` key now exists), and the search retry asked again 5.00 s after a `Retry-After: 5`.
- **On the device** (`device-run.txt`, ten screenshots, light and dark): the server's request log is the oracle. A refused search carries the install's `userId` and is retried about 14 s later (the server's wait) and succeeds; a refused hold's Try again sends nothing until 15 s after the refusal (the server's wait) and then the hold lands; a hold refused with a 429 and then left sends **no** release; a search refused every time stops after exactly 3 retries and shows the error state.
- **Polling is not touched**, and a 429 there is covered by the existing rule, run read-only on a 429 error: polls 1 and 2 keep the map and show the stale Toast, poll 3 is the error screen.
- `gitleaks`: no leaks.

## Not Figma'd

No Figma frame exists for: the slow-down Toast on Continue, the search Toast, or "Too many searches". Same precedent as 5b (states with no frame are built from the existing `Toast`, `EmptyState` and `Button`). If you want them designed, that is a design task; the copy is in `seatNotices.ts` and `searchHelpers.ts`.

## Unproven

- **A real phone, iOS, TalkBack/VoiceOver.** The new Toasts use the existing Toast announcement path; none was listened to.
- **The real Railway edge** (server ADR 0016 carry-forward 1). Here the address is 127.0.0.1 shared by the emulator and my `curl`, so the "busy shared address" case is exact, but how Railway presents client addresses, and so who is behind an address in production, is still unproven.
- **Real TMDB.** The movie source was a stub in the scratch server (the limiter, routes and app code were real).
- **A hold wait of the full 60 s**; the longest observed was 15 s.
- **A poll that gets a 429 on the device** (checked on the logic only, as above).
- **Hook wiring is not unit-tested** (no React Native renderer, ADR 0005): `useSearchMovies`, `search.tsx` and the seat screen's Toast are shown by the device runs; every decision inside them is a tested pure function.
- **Native modules reach more screens.** `useMovies.ts` now imports the install-id module, so Home, movie detail and search load `expo-crypto` and `expo-secure-store`, where before only the seat screen did. Both were added and approved in 5b and are in Expo Go 58.0.5 and the first dev build, so no new build; but a build that lacks them would now fail at Home rather than at the seat screen. (A stale Expo Go process showed this once on the device: force-stop and relaunch, the same dev-only quirk 5b recorded.)

## Deferred (not built here)

- Booking: no caller exists, so there is nothing to wire. The `booking` policy goes with the payments chapter.
- **5d:** the waiting room, graceful overload and the per-owner hoarding cap. **5e:** the k6 load test (500 users from one address will meet these limits; 5e needs a way to lift them for that run), `TRAFFIC.md`, `SHARDING.md`. **Deploy slice:** `verify-client-ip.sh` against the real Railway edge.

## Next

- **Dave:** check CI, then squash-merge. No migration, no environment variable, **no EAS build**. The server PR it depends on (#24) is already merged and linked in the PR.
- Close the chat and write your `LEARNING-LOG.md` paragraph (your words only). `LEARNING-LOG.md` is untouched.
