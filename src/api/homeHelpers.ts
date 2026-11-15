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

/** Auto-cycling featured hero. */
export const HERO_CYCLE_INTERVAL_MS = 5_000;
export const HERO_MAX_SLIDES = 5;
export const HERO_IMAGE_READY_TIMEOUT_MS = 2_000;

/**
 * The movies the hero cycles through: the first `max` now-playing movies that have a poster.
 * If none have a poster, falls back to the first movie alone so the hero is never empty
 * while the carousel has films.
 */
export function selectHeroSlides(movies: readonly Movie[], max = HERO_MAX_SLIDES): Movie[] {
  const limit = Math.max(0, Math.trunc(max));
  const withPoster = movies.filter((movie) => Boolean(movie.posterUrl)).slice(0, limit);
  if (withPoster.length > 0) return withPoster;
  const first = selectFeaturedMovie(movies);
  return first && limit > 0 ? [first] : [];
}

export function nextHeroIndex(currentIndex: number, count: number): number {
  if (count <= 1) return 0;
  return (currentIndex + 1) % count;
}

/** Keeps the shown index valid when the list shrinks; reduced motion always shows the first. */
export function resolveHeroIndex(index: number, count: number, reducedMotion: boolean): number {
  if (count <= 0 || reducedMotion) return 0;
  return ((Math.trunc(index) % count) + count) % count;
}

export function shouldAutoCycleHero(params: {
  count: number;
  isFocused: boolean;
  reducedMotion: boolean;
}): boolean {
  return params.count > 1 && params.isFocused && !params.reducedMotion;
}

/** Returns the detail that belongs to `movieId`, if any of the candidates is it. */
export function pickDetail(
  candidates: readonly (MovieDetail | null | undefined)[],
  movieId: number
): MovieDetail | null {
  return candidates.find((detail) => detail?.id === movieId) ?? null;
}

/**
 * Resolves once `url` is warm in the image cache, fails soft, and never waits longer than
 * `timeoutMs`. Used so the next hero slide does not fade in as a skeleton.
 */
export async function waitForImageReady(
  url: string | null,
  prefetch: (url: string) => Promise<unknown>,
  timeoutMs = HERO_IMAGE_READY_TIMEOUT_MS
): Promise<void> {
  if (!url) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  try {
    await Promise.race([
      prefetch(url).then(
        () => undefined,
        () => undefined
      ),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Waits `intervalMs`, lets `prepare` finish (best effort), then calls `onAdvance`.
 * The returned function cancels the whole thing, including a pending `prepare`.
 */
export function scheduleHeroAdvance(params: {
  intervalMs: number;
  prepare: () => Promise<void>;
  onAdvance: () => void;
}): () => void {
  let cancelled = false;
  const handle = setTimeout(() => {
    void params
      .prepare()
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) params.onAdvance();
      });
  }, params.intervalMs);

  return () => {
    cancelled = true;
    clearTimeout(handle);
  };
}
