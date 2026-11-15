# Handoff: Search screen redesign (branch `feat/search-redesign`)

## What changed
- **API mirrors (`src/api/movies.ts`, `src/api/useMovies.ts`):**
  - Added `Genre`, `GenresResponse`, `buildGenresUrl`, `buildDiscoverMoviesUrl`, `fetchGenres`, and `fetchDiscoverMovies`.
  - Added `useGenres` and `useDiscoverMovies` (`retry: false`) hooks.
- **SearchResultRow component ([SearchResultRow.tsx](file:///Users/blk/Developer/Matinee/matinee-mobile/src/components/SearchResultRow.tsx), [index.ts](file:///Users/blk/Developer/Matinee/matinee-mobile/src/components/index.ts), [COMPONENTS.md](file:///Users/blk/Developer/Matinee/matinee-mobile/docs/COMPONENTS.md)):**
  - Built and documented `SearchResultRow` (`64×96` poster thumbnail on left, `label-lg` title + `body` meta on right, `size/touch-min` touch target).
- **Search helpers ([searchHelpers.ts](file:///Users/blk/Developer/Matinee/matinee-mobile/src/api/searchHelpers.ts), [searchHelpers.test.ts](file:///Users/blk/Developer/Matinee/matinee-mobile/src/api/searchHelpers.test.ts)):**
  - Added and unit-tested `resolveSearchMode`, `formatFilmCount`, `isOfflineNetworkError`, `buildGenresUrl`, and `buildDiscoverMoviesUrl`.
- **Search screen ([search.tsx](file:///Users/blk/Developer/Matinee/matinee-mobile/src/app/search.tsx)):**
  - Rebuilt to Figma frames `41:1335`, `41:1265`, `41:1462`, `41:1519`, `41:1633`, and `41:1715`:
    - Idle: `"Search"` input (`"Film title"`) + `"Browse by genre"` `Chip` cloud from `GET /genres`.
    - Genre browse: tapping a genre chip fetches `GET /movies/discover?genreId=...`.
    - Results: `"<N> films"` count + vertical list of `SearchResultRow`s (tap → `/movie/[id]`).
    - Covers skeleton, no-results (`No films match '<query>'`), offline (`You're offline`), server-overloaded, and offline saved-data states in light and dark mode with tokens-only styling.

## What passed
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `gitleaks git matinee-mobile`

## Next
- **Dave:** Review and squash-merge the PR.
