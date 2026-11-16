import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MovieApiError,
  buildMovieDetailUrl,
  resolveMovieDetailViewStatus,
  type MovieDetailFetchResult,
} from './movies';
import {
  buildMovieShowtimesUrl,
  resolveShowtimesViewStatus,
  type ShowtimesFetchResult,
} from './showtimes';

const DETAIL_RESULT: MovieDetailFetchResult = {
  cache: 'hit',
  data: {
    id: 900001,
    title: 'The Lantern Road',
    overview: 'Full overview.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/p.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/w780/b.jpg',
    year: 2026,
    releaseDate: '2026-11-07',
    runtimeMinutes: 134,
    genres: ['Drama'],
    rating: 7.8,
    tagline: null,
    certification: '15',
    language: 'English',
    director: 'Ines Marlow',
    cast: ['Tomas Reyes', 'Ada Quill'],
  },
};

const SHOWTIMES_RESULT: ShowtimesFetchResult = {
  cache: null,
  data: {
    movieId: 900001,
    cinemas: [
      {
        cinemaId: 'curzon-soho',
        cinemaName: 'Curzon Soho',
        cinemaAddress: '99 Shaftesbury Ave, London',
        dates: [
          {
            date: '2026-11-15',
            showtimes: [
              {
                id: '11111111-1111-4111-8111-111111111111',
                startsAt: '2026-11-15T14:30:00.000Z',
                time: '14:30',
                screenId: 'curzon-soho-1',
                screenName: 'Screen 1',
                format: 'Standard',
                totalSeats: 120,
                priceCents: 1200,
                priceFormatted: '£12.00',
              },
            ],
          },
        ],
      },
    ],
  },
};

test('buildMovieDetailUrl and buildMovieShowtimesUrl validate positive integer ids', () => {
  assert.equal(buildMovieDetailUrl('https://api.example.com', 900001), 'https://api.example.com/movies/900001');
  assert.equal(
    buildMovieShowtimesUrl('https://api.example.com', 900001),
    'https://api.example.com/movies/900001/showtimes'
  );
  assert.throws(() => buildMovieDetailUrl('https://api.example.com', 0));
  assert.throws(() => buildMovieShowtimesUrl('https://api.example.com', -5));
});

test('resolveMovieDetailViewStatus handles loading, ready, stale, 404, 503, and error', () => {
  assert.equal(
    resolveMovieDetailViewStatus({ enabled: true, isPending: true, isError: false, error: null, result: undefined }),
    'loading'
  );
  assert.equal(
    resolveMovieDetailViewStatus({
      enabled: true,
      isPending: false,
      isError: false,
      error: null,
      result: DETAIL_RESULT,
    }),
    'ready'
  );
  assert.equal(
    resolveMovieDetailViewStatus({
      enabled: true,
      isPending: false,
      isError: false,
      error: null,
      result: { ...DETAIL_RESULT, cache: 'stale' },
    }),
    'offline_saved_data'
  );
  assert.equal(
    resolveMovieDetailViewStatus({
      enabled: true,
      isPending: false,
      isError: true,
      error: new MovieApiError('Not found', { status: 404, kind: 'not_found' }),
      result: undefined,
    }),
    'not_found'
  );
  assert.equal(
    resolveMovieDetailViewStatus({
      enabled: true,
      isPending: false,
      isError: true,
      error: new MovieApiError('Overloaded', { status: 503, kind: 'upstream_unavailable' }),
      result: undefined,
    }),
    'server_overloaded'
  );
});

test('resolveShowtimesViewStatus handles loading, ready, empty, 503, and error', () => {
  assert.equal(
    resolveShowtimesViewStatus({ enabled: true, isPending: true, isError: false, error: null, result: undefined }),
    'loading'
  );
  assert.equal(
    resolveShowtimesViewStatus({
      enabled: true,
      isPending: false,
      isError: false,
      error: null,
      result: SHOWTIMES_RESULT,
    }),
    'ready'
  );
  assert.equal(
    resolveShowtimesViewStatus({
      enabled: true,
      isPending: false,
      isError: false,
      error: null,
      result: { cache: null, data: { movieId: 900001, cinemas: [] } },
    }),
    'empty'
  );
  assert.equal(
    resolveShowtimesViewStatus({
      enabled: true,
      isPending: false,
      isError: true,
      error: new MovieApiError('Unavailable', { status: 503, kind: 'service_unavailable' }),
      result: undefined,
    }),
    'server_overloaded'
  );
});
