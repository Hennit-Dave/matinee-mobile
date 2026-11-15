# Handoff: Search screen redesign (branch `feat/search-redesign-v2`)

Supersedes `feat/search-redesign` (PR #20). That branch was cut before PR #19 (Home hero + carousel) merged. This one is the same Search change re-applied on top of current `main`, so CI runs against the code that will actually ship. PR #20 can be closed.

## What changed
- **API mirrors ([movies.ts](../../src/api/movies.ts), [useMovies.ts](../../src/api/useMovies.ts)):**
  - Added `Genre`, `GenresResponse`, `buildGenresUrl`, `buildDiscoverMoviesUrl`, `fetchGenres` and `fetchDiscoverMovies`.
  - Added `useGenres` and `useDiscoverMovies` (`retry: false`).
  - Additions only; nothing existing was edited.
  - Contract: `GET /genres` and `GET /movies/discover?genreId=<id>&page=<n>`, landed in matinee-server PR #18 (merged), see ADR 0012.
- **`SearchResultRow` ([SearchResultRow.tsx](../../src/components/SearchResultRow.tsx), [index.ts](../../src/components/index.ts), [COMPONENTS.md](../../docs/COMPONENTS.md)):**
  - `64×96` poster thumbnail on the left, `label-lg` title and `body` meta on the right, `size/touch-min` minimum height.
  - Exported from `index.ts` next to `HeroBackdrop` and `Chip`, which were left as they are on `main`.
- **Search helpers ([searchHelpers.ts](../../src/api/searchHelpers.ts), [searchHelpers.test.ts](../../src/api/searchHelpers.test.ts)):**
  - `resolveSearchMode`, `formatFilmCount`, `isOfflineNetworkError`, unit-tested.
- **Search screen ([search.tsx](../../src/app/search.tsx)):**
  - Rebuilt to Figma frames `41:1335`, `41:1265`, `41:1462`, `41:1519`, `41:1633` and `41:1715`.
  - Idle: "Search" input (placeholder "Film title") and a "Browse by genre" `Chip` cloud from `GET /genres`.
  - Genre browse: tapping a chip fetches `GET /movies/discover`.
  - Results: "N films" count and a vertical list of `SearchResultRow`; tap goes to `/movie/[id]`.
  - Covers skeleton, no results, offline, server overloaded and offline saved-data states, light and dark, tokens only.

## Not touched
Home (`(tabs)/(home)/index.tsx`), `HeroBackdrop`, `homeHelpers`, the Movie detail screen, `tokens.ts`, `LEARNING-LOG.md`.

## What passed
- `npm run typecheck`
- `npm run lint`
- `npm test` (52 passed, 0 failed)
- `gitleaks git .` (no leaks)
- On-device (Android, Expo Go), against the live server: idle genre chips, genre browse and a typed query. Screenshots in [docs/evidence/search-redesign/](../evidence/search-redesign/).

## Unproven / known polish
- Dark mode, offline, server-overloaded and no-result states come from the original Search slice and were not re-checked on device in this pass.
- `formatFilmCount` prints large counts without a thousands separator (for example "20001 films"). Worth a follow-up.
- After picking a genre, the chips become a horizontal strip that starts at "Action", so a selected chip further along (such as "Horror") is off-screen.

## Next
- **Dave:** review and squash-merge the PR, then close PR #20 and I'll delete the old `feat/search-redesign` branch.
