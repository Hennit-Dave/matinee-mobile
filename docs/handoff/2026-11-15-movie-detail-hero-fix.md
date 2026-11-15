# Handoff: Movie detail hero image fix (branch `fix/movie-detail-hero`)

## What changed
- **Hero gradient transparency (`src/app/(tabs)/(home)/movie/[id]/index.tsx`):**
  - Added `svgStopProps()` to split `rgba(r, g, b, a)` token strings (`surface/default-clear`, `surface/scrim`, `surface/scrim-clear`) into `rgb(r, g, b)` + explicit `stopOpacity={a}` for `react-native-svg` `<Stop>`. Previously `react-native-svg` ignored the alpha channel in `rgba(..., 0)` on `stopColor`, painting the 448px hero opaque and hiding the image.
- **Layer order & progressive fallback (`src/app/(tabs)/(home)/movie/[id]/index.tsx`):**
  - Preserved explicit layer order inside the 448px hero: pulsing `<Skeleton>` behind -> `<Image>` (`backdropUrl` with `posterUrl` fallback on load error) -> `HeroGradients` (`fade to surface` + `status bar fade`) -> title, meta line, and `"See showtimes"` button.

## What passed
- `npm run typecheck`
- `npm run lint`
- `npm test` (44 passed, 0 failed)
