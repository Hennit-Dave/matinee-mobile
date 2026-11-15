import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MovieApiError, buildDiscoverMoviesUrl, buildGenresUrl } from './movies';
import { formatFilmCount, isOfflineNetworkError, resolveSearchMode } from './searchHelpers';

test('resolveSearchMode prioritises text query over genre chip, otherwise idle', () => {
  assert.equal(resolveSearchMode('', null), 'idle');
  assert.equal(resolveSearchMode('', 28), 'genre');
  assert.equal(resolveSearchMode('dune', 28), 'text');
  assert.equal(resolveSearchMode('dune', null), 'text');
});

test('formatFilmCount formats singular and plural counts', () => {
  assert.equal(formatFilmCount(1, 1), '1 film');
  assert.equal(formatFilmCount(4, 4), '4 films');
  assert.equal(formatFilmCount(0, 3), '3 films');
});

test('isOfflineNetworkError distinguishes network errors from server errors', () => {
  assert.equal(
    isOfflineNetworkError(new MovieApiError('offline', { status: 0, kind: 'network_error' })),
    true
  );
  assert.equal(
    isOfflineNetworkError(new MovieApiError('down', { status: 503, kind: 'upstream_unavailable' })),
    false
  );
  assert.equal(isOfflineNetworkError(new Error('other')), false);
});

test('buildGenresUrl and buildDiscoverMoviesUrl validate inputs and clamp page', () => {
  assert.equal(buildGenresUrl('https://api.example.com'), 'https://api.example.com/genres');
  assert.equal(
    buildDiscoverMoviesUrl('https://api.example.com', 28, 2),
    'https://api.example.com/movies/discover?genreId=28&page=2'
  );
  assert.equal(
    buildDiscoverMoviesUrl('https://api.example.com', 28, 999),
    'https://api.example.com/movies/discover?genreId=28&page=500'
  );
  assert.throws(() => buildDiscoverMoviesUrl('https://api.example.com', 0, 1));
});
