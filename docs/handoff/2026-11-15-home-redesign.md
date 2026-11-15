# Handoff: Home screen redesign (branch `feat/home-redesign`)

## What changed
- **Shared hero component ([HeroBackdrop.tsx](file:///Users/blk/Developer/Matinee/matinee-mobile/src/components/HeroBackdrop.tsx)):**
  - Extracted the progressive hero image + `Skeleton` placeholder + `react-native-svg` fade-to-surface and status-bar scrim gradients (with explicit `stopOpacity` parsing via `svgStopProps`) from Movie detail into `HeroBackdrop`, exported from `src/components/index.ts`.
  - Updated `src/app/(tabs)/(home)/movie/[id]/index.tsx` to reuse `HeroBackdrop`.
- **Home helpers ([homeHelpers.ts](file:///Users/blk/Developer/Matinee/matinee-mobile/src/api/homeHelpers.ts), [homeHelpers.test.ts](file:///Users/blk/Developer/Matinee/matinee-mobile/src/api/homeHelpers.test.ts)):**
  - Added `resolveHeroHeight` (`448` on compact screens, `512` on `>= 880` tall screens matching Figma `40:1339` and `40:1899`), `selectFeaturedMovie`, `resolveHeroImageCandidates`, and `composeFeaturedMeta`.
- **Home screen ([index.tsx](file:///Users/blk/Developer/Matinee/matinee-mobile/src/app/(tabs)/(home)/index.tsx)):**
  - Replaced the search-bar + 2-column grid with the Figma Home layout:
    - Featured hero at top showing the first now-playing movie (`backdropUrl` with `posterUrl` fallback), display title, meta line, and full-width `"See showtimes"` button routing to `/movie/[id]/showtimes`.
    - Floating `48×48` circular Search icon button in the top-right routing to `/search`.
    - `"Now playing"` horizontal carousel of `MovieCard` (`layout="poster"`) tiles routing to `/movie/[id]`.
    - Implemented `loading` (skeleton), `offline_saved_data` (hero + offline banner + carousel), `empty`, `server_overloaded`, and `error` states, all with tokens-only styling, light/dark support, and NavBar clearance.

## What passed
- `npm run typecheck`
- `npm run lint`
- `npm test` (48 passed, 0 failed)
- `gitleaks git matinee-mobile` (no leaks found)

## Next
- **Dave:** Review and squash-merge the PR.
