import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ShowtimeSeat, ShowtimeSeatRow } from './seats';
import { RATE_LIMITED_MESSAGE, holdOutcomeNotice, lostPicksNotice } from './seatNotices';

function seat(row: string, number: number): ShowtimeSeat {
  return { id: `${row}-${number}`, row, number, kind: 'standard', status: 'held' };
}
const rows: ShowtimeSeatRow[] = [{ row: 'D', seats: [seat('D', 8), seat('D', 9), seat('D', 10)] }];

test('seats taken by someone else while picking: named, an error Toast with a warning buzz, no retry', () => {
  assert.deepEqual(lostPicksNotice(rows, ['D-8']), {
    message: 'Seat D8 was just taken. Pick another.',
    tone: 'error',
    haptic: true,
    retry: false,
    refetch: false,
  });
  assert.equal(lostPicksNotice(rows, ['D-8', 'D-9']).message, 'Seats D8, D9 were just taken. Pick others.');
});

test('a 409 seat_taken names the seats, buzzes, and refreshes the map at once', () => {
  assert.deepEqual(holdOutcomeNotice({ id: 1, kind: 'taken', seatIds: ['D-9'] }, rows), {
    message: 'Seat D9 was just taken. Pick another.',
    tone: 'error',
    haptic: true,
    retry: false,
    refetch: true,
  });
});

test('a 409 that names no seat we know still refreshes the map and does not invent a name', () => {
  const notice = holdOutcomeNotice({ id: 1, kind: 'taken', seatIds: [] }, rows);
  assert.equal(notice.message, 'Some of your seats were just taken. Pick others.');
  assert.equal(notice.refetch, true);
  assert.equal(holdOutcomeNotice({ id: 1, kind: 'taken', seatIds: ['Z-1'] }, undefined).message, 'Some of your seats were just taken. Pick others.');
});

test('503 holds_unavailable: the retryable "temporarily unavailable" notice, picks kept, no buzz', () => {
  assert.deepEqual(holdOutcomeNotice({ id: 2, kind: 'unavailable' }, rows), {
    message: 'Seats are temporarily unavailable. Try again in a moment.',
    tone: 'error',
    haptic: false,
    retry: true,
    refetch: false,
  });
});

test('429 rate_limited: "slow down a moment", calm tone, no buzz, picks kept, Try again, nothing to refresh', () => {
  assert.deepEqual(holdOutcomeNotice({ id: 5, kind: 'rateLimited' }, rows), {
    message: 'Slow down a moment, then try again.',
    tone: 'info',
    haptic: false,
    retry: true,
    refetch: false,
  });
  assert.equal(RATE_LIMITED_MESSAGE, 'Slow down a moment, then try again.');
  // Nothing about the map changed (nothing was held), so it needs no refresh, with or without a map on screen.
  assert.equal(holdOutcomeNotice({ id: 5, kind: 'rateLimited' }, undefined).refetch, false);
});

test('no usable answer: says it could not confirm, and offers Try again (safe: the server treats a repeat as the same hold)', () => {
  const notice = holdOutcomeNotice({ id: 3, kind: 'uncertain' }, rows);
  assert.equal(notice.message, "Couldn't confirm your hold. Try again.");
  assert.equal(notice.retry, true);
});

test('a refusal the server gave on purpose shows its message, or a plain fallback', () => {
  assert.equal(holdOutcomeNotice({ id: 4, kind: 'rejected', message: 'Showing not found.' }, rows).message, 'Showing not found.');
  assert.equal(holdOutcomeNotice({ id: 4, kind: 'rejected', message: '' }, rows).message, "Couldn't hold those seats.");
  assert.equal(holdOutcomeNotice({ id: 4, kind: 'rejected', message: 'x' }, rows).retry, false);
});
