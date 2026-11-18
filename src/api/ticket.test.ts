import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTicketDate, formatTicketSeats } from './ticket';

test('formatTicketDate turns the server\'s UTC ISO datetime into a readable date', () => {
  // 2026-12-01 is a Tuesday (UTC).
  assert.equal(formatTicketDate('2026-12-01T20:30:00.000Z'), 'Tue 1 Dec 2026');
  assert.equal(formatTicketDate('not-a-date'), 'not-a-date');
});

test('formatTicketSeats joins the seats as "row + number"', () => {
  assert.equal(
    formatTicketSeats([
      { row: 'A', number: 1 },
      { row: 'A', number: 2 },
      { row: 'B', number: 10 },
    ]),
    'A1, A2, B10'
  );
  assert.equal(formatTicketSeats([]), '');
});
