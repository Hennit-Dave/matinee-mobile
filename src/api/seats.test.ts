import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MovieApiError } from './movies';
import {
  NO_SEATS_MESSAGE,
  buildShowtimeSeatsUrl,
  countSeats,
  isShowtimeSeatsResponse,
  isSoldOut,
  resolveSeatsViewStatus,
  type SeatStatus,
  type SeatsFetchResult,
  type ShowtimeSeatRow,
  type ShowtimeSeatsResponse,
} from './seats';

const SHOWTIME_ID = '3f2c1b7e-6a1d-4c8e-9a52-0b1d2e3f4a5b';

function seat(row: string, number: number, status: SeatStatus = 'available', kind: 'standard' | 'wheelchair' = 'standard') {
  return { id: `${row}-${number}`, row, number, kind, status };
}

/** Two rows of four seats, every seat given the same status. */
function grid(status: SeatStatus): ShowtimeSeatRow[] {
  return ['A', 'B'].map((row) => ({ row, seats: [1, 2, 3, 4].map((n) => seat(row, n, status)) }));
}

function response(rows: ShowtimeSeatRow[]): ShowtimeSeatsResponse {
  return {
    showtimeId: SHOWTIME_ID,
    movieId: 900001,
    startsAt: '2026-11-20T20:30:00.000Z',
    time: '20:30',
    screen: { id: 'bfi-southbank-imax', name: 'IMAX', format: 'IMAX', totalSeats: 8 },
    priceCents: 1850,
    priceFormatted: '£18.50',
    rows,
  };
}

function result(rows: ShowtimeSeatRow[]): SeatsFetchResult {
  return { cache: null, data: response(rows) };
}

const BASE = { enabled: true, isPending: false, isError: false, error: null } as const;

// ---- URL ------------------------------------------------------------------------------------------

test('buildShowtimeSeatsUrl builds the seats URL and rejects an id that is not a UUID', () => {
  assert.equal(
    buildShowtimeSeatsUrl('https://api.example.test', SHOWTIME_ID),
    `https://api.example.test/showtimes/${SHOWTIME_ID}/seats`
  );
  for (const bad of ['', 'not-a-uuid', '12345', `${SHOWTIME_ID}/extra`, '../movies']) {
    assert.throws(
      () => buildShowtimeSeatsUrl('https://api.example.test', bad),
      (err: unknown) => err instanceof MovieApiError && err.kind === 'validation_failed' && err.status === 400,
      `should reject "${bad}"`
    );
  }
});

// ---- Type guard -----------------------------------------------------------------------------------

test('the type guard accepts a full server response', () => {
  assert.ok(isShowtimeSeatsResponse(response(grid('available'))));
  assert.ok(isShowtimeSeatsResponse(response([{ row: 'A', seats: [seat('A', 1, 'sold', 'wheelchair')] }])));
});

test('the type guard accepts an empty grid, which the resolver (not the guard) turns into an error', () => {
  assert.ok(isShowtimeSeatsResponse(response([])));
});

test('the type guard rejects unknown seat statuses and kinds instead of drawing them wrongly', () => {
  const badStatus = response(grid('available'));
  (badStatus.rows[0]!.seats[0] as { status: string }).status = 'booked';
  assert.equal(isShowtimeSeatsResponse(badStatus), false);

  const badKind = response(grid('available'));
  (badKind.rows[0]!.seats[0] as { kind: string }).kind = 'vip';
  assert.equal(isShowtimeSeatsResponse(badKind), false);
});

test('the type guard rejects malformed envelopes', () => {
  assert.equal(isShowtimeSeatsResponse(null), false);
  assert.equal(isShowtimeSeatsResponse('seats'), false);
  assert.equal(isShowtimeSeatsResponse({}), false);
  const missingPrice = { ...response(grid('available')), priceFormatted: undefined };
  assert.equal(isShowtimeSeatsResponse(missingPrice), false);
  const rowsNotArray = { ...response([]), rows: {} };
  assert.equal(isShowtimeSeatsResponse(rowsNotArray), false);
  const missingScreen = { ...response(grid('available')), screen: undefined };
  assert.equal(isShowtimeSeatsResponse(missingScreen), false);
  const seatMissingNumber = response(grid('available'));
  delete (seatMissingNumber.rows[0]!.seats[0] as { number?: number }).number;
  assert.equal(isShowtimeSeatsResponse(seatMissingNumber), false);
});

// ---- Counting and sold-out ------------------------------------------------------------------------

test('countSeats adds up every seat in every row', () => {
  assert.equal(countSeats(grid('available')), 8);
  assert.equal(countSeats([]), 0);
});

test('isSoldOut is true only when a full grid has every seat sold', () => {
  assert.equal(isSoldOut(grid('sold')), true);
  assert.equal(isSoldOut(grid('available')), false);
  assert.equal(isSoldOut(grid('held')), false, 'held seats can come back, so the room is not sold out');
  assert.equal(isSoldOut([]), false, 'an empty grid is not a sold-out room');
  assert.equal(isSoldOut([{ row: 'A', seats: [] }]), false, 'rows with no seats are not a sold-out room');

  const oneFree = grid('sold');
  oneFree[1]!.seats[3]!.status = 'available';
  assert.equal(isSoldOut(oneFree), false);
});

// ---- View status ----------------------------------------------------------------------------------

test('EMPTY ROWS ARE AN ERROR, NOT SOLD OUT: a 200 with rows: [] renders the retryable error state', () => {
  const status = resolveSeatsViewStatus({ ...BASE, result: result([]) });
  assert.equal(status, 'error');
  assert.notEqual(status, 'sold_out');
});

test('rows that exist but hold no seats are also an error, not sold out', () => {
  const status = resolveSeatsViewStatus({ ...BASE, result: result([{ row: 'A', seats: [] }, { row: 'B', seats: [] }]) });
  assert.equal(status, 'error');
});

test('SOLD OUT IS DRIVEN BY SEAT STATUSES: a full grid with every seat sold is sold_out', () => {
  assert.equal(resolveSeatsViewStatus({ ...BASE, result: result(grid('sold')) }), 'sold_out');
});

test('a room with any available seat is ready, whatever else is sold', () => {
  const mixed = grid('sold');
  mixed[0]!.seats[0]!.status = 'available';
  assert.equal(resolveSeatsViewStatus({ ...BASE, result: result(mixed) }), 'ready');
  assert.equal(resolveSeatsViewStatus({ ...BASE, result: result(grid('available')) }), 'ready');
});

test('a room whose seats are only held or sold is ready (the map), not sold out: held seats can be released', () => {
  const heldAndSold = grid('sold');
  heldAndSold[0]!.seats[0]!.status = 'held';
  assert.equal(resolveSeatsViewStatus({ ...BASE, result: result(heldAndSold) }), 'ready');
  assert.equal(resolveSeatsViewStatus({ ...BASE, result: result(grid('held')) }), 'ready');
});

test('loading, disabled, and no-result states', () => {
  assert.equal(resolveSeatsViewStatus({ ...BASE, isPending: true, result: undefined }), 'loading');
  assert.equal(resolveSeatsViewStatus({ ...BASE, enabled: false, result: undefined }), 'error');
  assert.equal(resolveSeatsViewStatus({ ...BASE, result: undefined }), 'error');
});

test('request failures map to not_found, server_overloaded or error', () => {
  const notFound = new MovieApiError('Not found.', { status: 404, kind: 'not_found' });
  const overloaded = new MovieApiError('Down.', { status: 503, kind: 'service_unavailable' });
  const network = new MovieApiError('Offline.', { status: 0, kind: 'network_error' });
  const invalid = new MovieApiError('Bad shape.', { status: 200, kind: 'invalid_response', retryable: false });

  assert.equal(resolveSeatsViewStatus({ ...BASE, isError: true, error: notFound, result: undefined }), 'not_found');
  assert.equal(resolveSeatsViewStatus({ ...BASE, isError: true, error: overloaded, result: undefined }), 'server_overloaded');
  assert.equal(resolveSeatsViewStatus({ ...BASE, isError: true, error: network, result: undefined }), 'error');
  assert.equal(resolveSeatsViewStatus({ ...BASE, isError: true, error: invalid, result: undefined }), 'error');
  assert.equal(resolveSeatsViewStatus({ ...BASE, isError: true, error: new Error('boom'), result: undefined }), 'error');
});

test('a failed refresh is an error even when an earlier map is still in hand (stale availability is never shown)', () => {
  const network = new MovieApiError('Offline.', { status: 0, kind: 'network_error' });
  assert.equal(
    resolveSeatsViewStatus({ ...BASE, isError: true, error: network, result: result(grid('available')) }),
    'error'
  );
});

test('the empty-grid message is stable for the retryable error state', () => {
  assert.equal(NO_SEATS_MESSAGE, 'No seats came back for this showing.');
});
