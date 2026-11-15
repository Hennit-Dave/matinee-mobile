import { formatRuntime } from './movieDetailHelpers';
import type { Movie, MovieDetail } from './movies';

export const HERO_HEIGHT_COMPACT = 448;
export const HERO_HEIGHT_TALL = 512;
export const TALL_SCREEN_MIN_HEIGHT = 880;

/**
 * Matches the two Figma Home breakpoints: 360×800 uses a 448px hero; 412×915 uses 512px.
 */
export function resolveHeroHeight(windowHeight: number): number {
  return windowHeight >= TALL_SCREEN_MIN_HEIGHT ? HERO_HEIGHT_TALL : HERO_HEIGHT_COMPACT;
}

export function selectFeaturedMovie(movies: readonly Movie[]): Movie | null {
  return movies[0] ?? null;
}

export function resolveHeroImageCandidates(
  movie: Movie,
  detail?: MovieDetail | null
): { primaryUrl: string | null; fallbackUrl: string | null } {
  const matchingDetail = detail && detail.id === movie.id ? detail : null;
  if (matchingDetail?.backdropUrl) {
    return {
      primaryUrl: matchingDetail.backdropUrl,
      fallbackUrl: matchingDetail.posterUrl ?? movie.posterUrl,
    };
  }
  return {
    primaryUrl: matchingDetail?.posterUrl ?? movie.posterUrl,
    fallbackUrl: null,
  };
}

export function composeFeaturedMeta(movie: Movie, detail?: MovieDetail | null): string {
  const matchingDetail = detail && detail.id === movie.id ? detail : null;
  if (matchingDetail) {
    const parts = [
      matchingDetail.genres[0] ?? null,
      formatRuntime(matchingDetail.runtimeMinutes),
      'Now playing',
    ].filter((part): part is string => Boolean(part));
    return parts.join(' · ');
  }

  const parts = [movie.year ? String(movie.year) : null, 'Now playing'].filter(
    (part): part is string => Boolean(part)
  );
  return parts.join(' · ');
}
