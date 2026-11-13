# Handoff: Browse slice — Home + Search (branch `feat/browse-home-search`)

## What changed
- **Dependencies:** Added `react-native-reanimated` (for `Skeleton` pulse animation with reduced-motion support) and `react-native-svg` (for `Icon`). Both are included in Expo Go; no new EAS native build is required.
- **Data layer (`src/api/movies.ts`, `src/api/useMovies.ts`, `src/api/movies.test.ts`):**
  - Mirrors `Movie`, `MoviesPage`, `OVERVIEW_MAX_LENGTH`, `MAX_PAGE`, `MAX_QUERY_LENGTH`, `normaliseSearchQuery`, and `ApiErrorBody` from `matinee-server/src/movies/movie.ts` and `matinee-server/src/http/errors.ts`.
  - Calls `GET /movies/now-playing?page=` and `GET /movies/search?q=&page=` via `readApiBaseUrl()` (`src/api/config.ts`) and TanStack Query (`useNowPlayingMovies`, `useSearchMovies`). Never calls TMDB.
  - Classifies view states via `resolveMoviesViewStatus`: `loading` (skeletons), `ready`, `empty`, `offline_saved_data` (cached data on error or `X-Cache: STALE`), `server_overloaded` (503 `upstream_unavailable` / `service_unavailable` with retry), and `error`.
- **Components (`src/components/`):**
  - `Text`, `Icon` (`search`, `close`, `info`, `error`, `success`, `chevron-left`, `chevron-right`), `Button` (`primary`, `secondary`, `text`), `Skeleton` (`block`, `text`, `poster`, `circle` via Reanimated), `Input` (with `leadingIcon="search"`, focus/error/disabled states, clear button), `MovieCard` (`poster`, `poster-title`, `list` layouts), and `EmptyState`.
  - Built strictly from `src/tokens/tokens.ts` and `useTheme()`.
- **Screens:**
  - **Home (`src/app/(tabs)/index.tsx`):** Search entry button at top navigating to `/search`, now-playing `MovieCard` grid (`poster-title`), `Skeleton` loading, "showing saved data" offline strip, and 503 retryable `EmptyState`.
  - **Search (`src/app/search.tsx`, registered in `src/app/_layout.tsx`):** Not a tab; reached from Home. `Input` in search mode (300ms debounce), `MovieCard` (`list` layout) results, `Skeleton` loading, no-results `EmptyState`, offline strip, and 503 retryable `EmptyState`.

## What passed
- `npm run typecheck`
- `npm run lint`
- `npm test` (includes `src/api/movies.test.ts`, `src/api/config.test.ts`, `src/theme/resolveMode.test.ts`, `src/tokens/tokens.test.ts`)

## Unproven
- Live visual rendering and network calls in Expo Go / Android emulator against a running `matinee-server` were not run in this session.

## Deferred
- **Glass `NavBar` (`expo-blur`):** Intentionally deferred to its own slice. The existing Expo Router tab bar in `src/app/(tabs)/_layout.tsx` is left as-is.
- **Movie detail navigation:** `MovieCard` `onPress` on Home and Search is currently a no-op until the Movie detail / Showtimes slice is built.
- **Component gallery:** Hidden component gallery screen is not built yet.

## Next
- Confirm live rendering of Home and Search in Expo Go / Android emulator against `matinee-server`.
- Pick up the **Movie detail + Showtimes** slice (or the **Glass `NavBar`** slice — note `expo-blur` may need a new EAS native build; tell Dave before adding it per `AGENTS.md`).
