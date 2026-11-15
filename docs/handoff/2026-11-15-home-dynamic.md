# Handoff: Home dynamic (branch `feat/home-dynamic`)

Two enhancements layered on the Figma-faithful Home from PR #19: a "Popular" carousel and an auto-cycling featured hero. `HeroBackdrop` is unchanged, so the #18 image/gradient fix is untouched.

## What changed
- **Popular carousel**
  - [movies.ts](../../src/api/movies.ts): `buildPopularMoviesUrl` (page clamped 1..500, like the server's `PopularQuerySchema`) and `fetchPopularMovies`, returning `MoviesPage`.
  - [useMovies.ts](../../src/api/useMovies.ts): `usePopularMovies` (`retry: false`).
  - Contract: `GET /movies/popular?page=<1..500>` from matinee-server PR #19 (merged), ADR 0013.
  - [index.tsx](../../src/app/(tabs)/(home)/index.tsx): a "Popular" section under "Now playing", `MovieCard layout="poster"`, tap goes to `/movie/[id]`. Now playing and Popular share one `PosterRow`.
  - Popular has its own states, so a Popular failure never replaces the whole Home: skeleton row, inline empty text, inline error or overloaded text with a "Try again" button, and saved-data. The row is hidden when the API URL is not configured (`idle`).
- **Auto-cycling hero**
  - [homeHelpers.ts](../../src/api/homeHelpers.ts): `selectHeroSlides` (first 5 now-playing movies that have a poster; falls back to the first movie), `nextHeroIndex`, `resolveHeroIndex`, `shouldAutoCycleHero`, `pickDetail`, `waitForImageReady`, `scheduleHeroAdvance`.
  - [useHeroCycle.ts](../../src/api/useHeroCycle.ts): advances every 5 s, only while Home is focused (`useFocusEffect`) and OS reduce-motion is off. The timer is cancelled on blur. It warms the next slide's image before advancing so the cross-fade never reveals a skeleton.
  - [CrossfadeStack.tsx](../../src/components/CrossfadeStack.tsx): the incoming slide fades in (`duration/slow`) over the outgoing one, which stays opaque below. The outgoing layer ignores touches and is hidden from screen readers. Documented in [COMPONENTS.md](../COMPONENTS.md).
  - Home: "See showtimes" and a tap on the hero image (new, opens `/movie/[id]`) always act on the slide on screen. Detail is requested only for the slide shown, the next one and the one leaving, not all twenty movies.
  - Reduce-motion uses Reanimated's `useReducedMotion`, the same signal as `Skeleton`: no timer, always the first movie, no fade.

## Not touched
`HeroBackdrop.tsx`, `tokens.ts`, the Movie detail screen, Search, `LEARNING-LOG.md`.

## What passed
- `npm run typecheck`, `npm run lint`
- `npm test`: 61 passed, 0 failed. The new tests cover slide selection, wrap and clamp, the run/pause rule, the image-ready gate, the popular URL clamp, and the timer with mock timers (advance, cancel, cancel mid-prepare, failed prepare).
- On device (Android, Expo Go), against the live server. Evidence in [docs/evidence/home-dynamic/](../evidence/home-dynamic/).
  - Cycles through 5 slides in order and wraps, advancing roughly every 5 s. A screen recording shows two changes 5.25 s apart: the 5 s timer plus the image warm-up.
  - A screen recording across a transition shows a clean cross-dissolve (both titles visible at once, backdrop never dips or shows a skeleton).
  - Tapping the hero and "See showtimes" opened the movie that was on screen.
  - The hero held its slide for 16 s while Home was blurred (three missed intervals), then resumed.
  - With Android animations switched off (and the app restarted), the hero stayed on the first slide for 32 s. The phone's animation settings were put back afterwards.
  - Light and dark both render the Popular row.

## Unproven / known limits
- Popular's empty, error and overloaded states are written but were not triggered on device, because the live server was healthy.
- Not tested with TalkBack or Switch Access.
- `useReducedMotion` is read once when the app starts (its docs say so), so turning reduce-motion on or off while the app is running needs an app restart. `Skeleton` behaves the same today.
- The fade uses Reanimated's default easing, not the `easing/standard` token (a CSS cubic-bezier string).
- Popular and Now playing overlap on the top films, because both come from TMDB popularity and showtimes. No de-duplication was asked for.
- If a slide's detail has not loaded when it arrives (rare, because it is requested 5 s earlier), it shows the poster first and swaps to the backdrop when detail lands.
- `HeroBackdrop` is still not documented in `COMPONENTS.md` (a gap from #19, left alone here).
- No Figma frame exists for a Popular row. It reuses the Now playing section styling; the closest frame, "Coming soon" (`40:1381`), uses poster+title cards.

## Next
- **Dave:** review and squash-merge. `main` (including Search v2, #21) has been merged into this branch with no conflicts; typecheck, lint and all 65 tests pass on the combined code.
