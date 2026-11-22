import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayReference, formatTicketDate, formatTicketSeats } from './ticket';

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

test('displayReference derives a short MTN-XXXX code from the first UUID chars, uppercased', () => {
  assert.equal(displayReference('a1b2c3d4-e5f6-4333-8333-333333333333'), 'MTN-A1B2');
  assert.equal(displayReference('11111111-2222-4333-8333-333333333333'), 'MTN-1111');
  assert.equal(displayReference('ab-cd-ef-gh'), 'MTN-ABCD');
});
