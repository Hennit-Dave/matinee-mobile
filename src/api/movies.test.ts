import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MovieApiError,
  buildNowPlayingUrl,
  buildSearchMoviesUrl,
  formatMovieMeta,
  normaliseSearchQuery,
  resolveMoviesViewStatus,
  type MoviesFetchResult,
} from './movies';

const SAMPLE_RESULT: MoviesFetchResult = {
  cache: 'hit',
  data: {
    movies: [
      {
        id: 1,
        title: 'Dune: Part Two',
        posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        year: 2024,
        overview: 'Follow the mythic journey of Paul Atreides.',
      },
    ],
    page: 1,
    totalPages: 1,
    totalResults: 1,
  },
};

test('normaliseSearchQuery trims, collapses whitespace, and lowercases', () => {
  assert.equal(normaliseSearchQuery('  Dune   PART two '), 'dune part two');
  assert.equal(normaliseSearchQuery('   '), '');
});

test('buildNowPlayingUrl clamps page to 1..500', () => {
  assert.equal(buildNowPlayingUrl('http://localhost:3000', 1), 'http://localhost:3000/movies/now-playing?page=1');
  assert.equal(buildNowPlayingUrl('http://localhost:3000', 0), 'http://localhost:3000/movies/now-playing?page=1');
  assert.equal(buildNowPlayingUrl('http://localhost:3000', 999), 'http://localhost:3000/movies/now-playing?page=500');
});

test('buildSearchMoviesUrl normalises and encodes query', () => {
  assert.equal(
    buildSearchMoviesUrl('http://localhost:3000', '  Blade   Runner ', 2),
    'http://localhost:3000/movies/search?q=blade+runner&page=2'
  );
});

test('resolveMoviesViewStatus handles loading, ready, empty, offline saved data, and 503 server overloaded', () => {
  assert.equal(
    resolveMoviesViewStatus({ enabled: false, isPending: false, isError: false, error: null, result: undefined }),
    'idle'
  );
  assert.equal(
    resolveMoviesViewStatus({ enabled: true, isPending: true, isError: false, error: null, result: undefined }),
    'loading'
  );
  assert.equal(
    resolveMoviesViewStatus({ enabled: true, isPending: false, isError: false, error: null, result: SAMPLE_RESULT }),
    'ready'
  );
  assert.equal(
    resolveMoviesViewStatus({
      enabled: true,
      isPending: false,
      isError: false,
      error: null,
      result: { cache: 'miss', data: { movies: [], page: 1, totalPages: 0, totalResults: 0 } },
    }),
    'empty'
  );
  assert.equal(
    resolveMoviesViewStatus({
      enabled: true,
      isPending: false,
      isError: true,
      error: new MovieApiError('Network down', { status: 0, kind: 'network_error' }),
      result: SAMPLE_RESULT,
    }),
    'offline_saved_data'
  );
  assert.equal(
    resolveMoviesViewStatus({
      enabled: true,
      isPending: false,
      isError: false,
      error: null,
      result: { ...SAMPLE_RESULT, cache: 'stale' },
    }),
    'offline_saved_data'
  );
  assert.equal(
    resolveMoviesViewStatus({
      enabled: true,
      isPending: false,
      isError: true,
      error: new MovieApiError('Movie data is temporarily unavailable.', {
        status: 503,
        kind: 'upstream_unavailable',
        requestId: 'req-123',
      }),
      result: undefined,
    }),
    'server_overloaded'
  );
});

test('formatMovieMeta formats year and overview cleanly', () => {
  assert.equal(formatMovieMeta({ year: 2026, overview: 'A teaser.' }), '2026 · A teaser.');
  assert.equal(formatMovieMeta({ year: 2026, overview: null }), '2026');
  assert.equal(formatMovieMeta({ year: null, overview: 'A teaser.' }), 'A teaser.');
  assert.equal(formatMovieMeta({ year: null, overview: null }), '');
});
