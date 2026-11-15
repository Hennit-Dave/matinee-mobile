# Handoff: Movie detail & Showtimes screens (branch `feat/movie-detail-screen`)

## What changed
- **Routing (`src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/(home)/_layout.tsx`, `src/components/navBarLogic.ts`):**
  - Converted the Home tab into a nested `(home)` Stack inside `(tabs)` (`(home)/index.tsx`, `(home)/movie/[id]/index.tsx`, `(home)/movie/[id]/showtimes.tsx`), keeping the floating glass `NavBar` mounted with `Home` active on both Movie Detail and Showtimes.
  - Updated `activeNavItem` so `/movie/*` resolves to `'home'`, and `TabNavBar` navigates back to `/` when tapping `Home` from a movie sub-route.
  - Wired `MovieCard` `onPress` in Home and `src/app/search.tsx` to push `/movie/[id]` with `{ id, title, posterUrl }` params.
- **API & pure helpers (`src/api/movies.ts`, `src/api/showtimes.ts`, `src/api/useMovies.ts`, `src/api/useShowtimes.ts`, `src/api/movieDetailHelpers.ts`):**
  - Mirrored `MovieDetail` (including `certification`, `language`, `director`, `cast`) and `MovieShowtimesResponse` (including `format` per slot) field-for-field from `matinee-server`.
  - Added `fetchMovieDetail`, `fetchMovieShowtimes`, `useMovieDetail`, `useMovieShowtimes` (`staleTime: 0`), `resolveMovieDetailViewStatus`, and `resolveShowtimesViewStatus`.
  - Added pure unit-tested helpers for runtime (`"2h 14m"`), release date (`"7 November 2026"`), meta-line composition, date-chip formatting (`"Today Wed 11"` / `"Thu 12"`), nearest non-empty date selection, and `cinema -> format -> slots` grouping.
- **Components (`src/components/Chip.tsx`, `src/components/BottomSheet.tsx`, `src/components/index.ts`, `docs/COMPONENTS.md`):**
  - Built `Chip` (selected / default / disabled `"Sold out"` variants, 32px pill inside 48px touch wrapper, `tabularNums` support) and `BottomSheet` (scrim tap, handle drag-down, system back dismiss, `elevation/3`, `surface/overlay`).
  - Documented both in `docs/COMPONENTS.md`. Note: the component gallery screen is still not built yet in this repo.
- **Screens (`src/app/(tabs)/(home)/movie/[id]/index.tsx`, `src/app/(tabs)/(home)/movie/[id]/showtimes.tsx`):**
  - Built Movie Detail (448-tall hero with `react-native-svg` gradients, back circle button, meta line, `"See showtimes"` CTA, offline banner, 3-line overview + `"More"` `BottomSheet`, skeleton/error/503/404 states) and Showtimes (header, horizontal date chips, `cinema -> format -> time` chips with safe no-op press, per-date empty jump button, whole-movie empty/error/503/skeleton states).

## What passed
- `npm run typecheck`
- `npm run lint`
- `npm test` (44 passed, 0 failed)

## Unproven locally
- Visual/device check on iOS/Android simulator (no simulator launched in this session).

## Next
- **Dave:** Squash-merge the PR.
- **Slice 5 (SeatMap):** Wire the Showtimes time `Chip` `onPress` to the Seat selection stack route outside `(tabs)`.
