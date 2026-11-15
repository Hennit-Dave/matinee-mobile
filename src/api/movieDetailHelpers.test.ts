import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  composeMovieMetaLine,
  extractShowtimeDates,
  findNearestDateWithShowtimes,
  formatDateChipLabel,
  formatReleaseDate,
  formatRuntime,
  formatShortDateLabel,
  groupDateShowtimesByCinemaAndFormat,
} from './movieDetailHelpers';
import type { CinemaShowtimes } from './showtimes';

const SAMPLE_CINEMAS: CinemaShowtimes[] = [
  {
    cinemaId: 'curzon-soho',
    cinemaName: 'Curzon Soho',
    cinemaAddress: '99 Shaftesbury Ave, London',
    dates: [
      {
        date: '2026-11-11',
        showtimes: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            startsAt: '2026-11-11T14:30:00.000Z',
            time: '14:30',
            screenId: 'curzon-soho-1',
            screenName: 'Screen 1',
            format: 'Standard',
            totalSeats: 120,
            priceCents: 1200,
            priceFormatted: '$12.00',
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            startsAt: '2026-11-11T19:30:00.000Z',
            time: '19:30',
            screenId: 'curzon-soho-2',
            screenName: 'Screen 2',
            format: 'Standard',
            totalSeats: 84,
            priceCents: 1550,
            priceFormatted: '$15.50',
          },
        ],
      },
      { date: '2026-11-12', showtimes: [] },
    ],
  },
  {
    cinemaId: 'bfi-southbank',
    cinemaName: 'BFI Southbank',
    cinemaAddress: 'Belvedere Rd, London',
    dates: [
      {
        date: '2026-11-11',
        showtimes: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            startsAt: '2026-11-11T18:45:00.000Z',
            time: '18:45',
            screenId: 'bfi-southbank-imax',
            screenName: 'IMAX',
            format: 'IMAX',
            totalSeats: 320,
            priceCents: 1850,
            priceFormatted: '$18.50',
          },
          {
            id: '44444444-4444-4444-8444-444444444444',
            startsAt: '2026-11-11T20:30:00.000Z',
            time: '20:30',
            screenId: 'bfi-southbank-nft1',
            screenName: 'NFT1',
            format: 'Dolby Atmos',
            totalSeats: 180,
            priceCents: 1550,
            priceFormatted: '$15.50',
          },
        ],
      },
      {
        date: '2026-11-13',
        showtimes: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            startsAt: '2026-11-13T17:45:00.000Z',
            time: '17:45',
            screenId: 'bfi-southbank-imax',
            screenName: 'IMAX',
            format: 'IMAX',
            totalSeats: 320,
            priceCents: 1850,
            priceFormatted: '$18.50',
          },
        ],
      },
    ],
  },
];

test('formatRuntime formats minutes into hours and minutes', () => {
  assert.equal(formatRuntime(134), '2h 14m');
  assert.equal(formatRuntime(120), '2h');
  assert.equal(formatRuntime(45), '45m');
  assert.equal(formatRuntime(0), null);
  assert.equal(formatRuntime(null), null);
});

test('formatReleaseDate formats YYYY-MM-DD into day Month year', () => {
  assert.equal(formatReleaseDate('2026-11-07'), '7 November 2026');
  assert.equal(formatReleaseDate('2026-01-15'), '15 January 2026');
  assert.equal(formatReleaseDate(null), null);
  assert.equal(formatReleaseDate('invalid'), null);
});

test('composeMovieMetaLine joins present fields with middot and omits nulls', () => {
  assert.equal(
    composeMovieMetaLine({
      genres: ['Drama', 'Thriller'],
      runtimeMinutes: 134,
      certification: '15',
      language: 'English',
    }),
    'Drama · 2h 14m · 15 · English'
  );
  assert.equal(
    composeMovieMetaLine({
      genres: [],
      runtimeMinutes: 95,
      certification: null,
      language: 'French',
    }),
    '1h 35m · French'
  );
  assert.equal(
    composeMovieMetaLine({
      genres: [],
      runtimeMinutes: null,
      certification: null,
      language: null,
    }),
    ''
  );
});

test('formatDateChipLabel and formatShortDateLabel format UTC dates', () => {
  assert.equal(formatDateChipLabel('2026-11-11', '2026-11-11'), 'Today Wed 11');
  assert.equal(formatDateChipLabel('2026-11-12', '2026-11-11'), 'Thu 12');
  assert.equal(formatShortDateLabel('2026-11-15'), 'Sun 15');
});

test('extractShowtimeDates and findNearestDateWithShowtimes compute available dates', () => {
  const summary = extractShowtimeDates(SAMPLE_CINEMAS);
  assert.deepEqual(summary.dates, ['2026-11-11', '2026-11-12', '2026-11-13']);
  assert.equal(summary.defaultDate, '2026-11-11');
  assert.deepEqual(Array.from(summary.hasShowtimesDates).sort(), ['2026-11-11', '2026-11-13']);

  assert.equal(findNearestDateWithShowtimes('2026-11-12', summary.hasShowtimesDates), '2026-11-11');
  assert.equal(findNearestDateWithShowtimes('2026-11-15', summary.hasShowtimesDates), '2026-11-13');
  assert.equal(findNearestDateWithShowtimes('2026-11-12', new Set()), null);
});

test('groupDateShowtimesByCinemaAndFormat groups selected date by cinema -> format -> slots', () => {
  const dayOne = groupDateShowtimesByCinemaAndFormat(SAMPLE_CINEMAS, '2026-11-11');
  assert.equal(dayOne.length, 2);
  assert.equal(dayOne[0]?.cinemaName, 'Curzon Soho');
  assert.equal(dayOne[0]?.formats.length, 1);
  assert.equal(dayOne[0]?.formats[0]?.format, 'Standard');
  assert.equal(dayOne[0]?.formats[0]?.slots.length, 2);

  assert.equal(dayOne[1]?.cinemaName, 'BFI Southbank');
  assert.deepEqual(
    dayOne[1]?.formats.map((f) => f.format),
    ['IMAX', 'Dolby Atmos']
  );

  const emptyDay = groupDateShowtimesByCinemaAndFormat(SAMPLE_CINEMAS, '2026-11-12');
  assert.deepEqual(emptyDay, []);
});
