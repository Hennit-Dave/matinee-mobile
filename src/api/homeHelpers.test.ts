import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HERO_HEIGHT_COMPACT,
  HERO_HEIGHT_TALL,
  composeFeaturedMeta,
  resolveHeroHeight,
  resolveHeroImageCandidates,
  selectFeaturedMovie,
} from './homeHelpers';
import type { Movie, MovieDetail } from './movies';

const SAMPLE_MOVIE: Movie = {
  id: 101,
  title: 'The Lantern Road',
  posterUrl: 'https://image.tmdb.org/t/p/w500/lantern.jpg',
  year: 2026,
  overview: 'A quiet journey.',
};

const SAMPLE_DETAIL: MovieDetail = {
  id: 101,
  title: 'The Lantern Road',
  overview: 'A quiet journey.',
  posterUrl: 'https://image.tmdb.org/t/p/w500/lantern.jpg',
  backdropUrl: 'https://image.tmdb.org/t/p/w780/lantern-bg.jpg',
  year: 2026,
  releaseDate: '2026-10-12',
  runtimeMinutes: 134,
  genres: ['Drama', 'Mystery'],
  rating: 7.8,
  tagline: null,
  certification: '12A',
  language: 'English',
  director: 'Jane Doe',
  cast: ['Actor One'],
};

test('resolveHeroHeight matches compact (448) and tall (512) Figma frames', () => {
  assert.equal(resolveHeroHeight(800), HERO_HEIGHT_COMPACT);
  assert.equal(resolveHeroHeight(879), HERO_HEIGHT_COMPACT);
  assert.equal(resolveHeroHeight(880), HERO_HEIGHT_TALL);
  assert.equal(resolveHeroHeight(915), HERO_HEIGHT_TALL);
});

test('selectFeaturedMovie returns the first now-playing movie or null', () => {
  assert.equal(selectFeaturedMovie([]), null);
  assert.deepEqual(selectFeaturedMovie([SAMPLE_MOVIE]), SAMPLE_MOVIE);
});

test('composeFeaturedMeta uses genre and runtime when matching detail is available, otherwise year', () => {
  assert.equal(composeFeaturedMeta(SAMPLE_MOVIE), '2026 · Now playing');
  assert.equal(composeFeaturedMeta(SAMPLE_MOVIE, SAMPLE_DETAIL), 'Drama · 2h 14m · Now playing');
  assert.equal(
    composeFeaturedMeta({ ...SAMPLE_MOVIE, year: null }, null),
    'Now playing'
  );
  // Mismatched detail id must not leak into another featured movie.
  assert.equal(
    composeFeaturedMeta(SAMPLE_MOVIE, { ...SAMPLE_DETAIL, id: 999 }),
    '2026 · Now playing'
  );
});

test('resolveHeroImageCandidates prefers matching backdrop with poster fallback', () => {
  assert.deepEqual(resolveHeroImageCandidates(SAMPLE_MOVIE), {
    primaryUrl: 'https://image.tmdb.org/t/p/w500/lantern.jpg',
    fallbackUrl: null,
  });
  assert.deepEqual(resolveHeroImageCandidates(SAMPLE_MOVIE, SAMPLE_DETAIL), {
    primaryUrl: 'https://image.tmdb.org/t/p/w780/lantern-bg.jpg',
    fallbackUrl: 'https://image.tmdb.org/t/p/w500/lantern.jpg',
  });
});
