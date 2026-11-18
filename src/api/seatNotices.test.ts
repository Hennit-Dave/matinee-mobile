import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ShowtimeSeat, ShowtimeSeatRow } from './seats';
import type { HoldOutcome } from './holdMachine';
import {
  BUSY_MESSAGE,
  RATE_LIMITED_MESSAGE,
  YOUR_TURN_MESSAGE,
  holdLimitMessage,
  holdOutcomeNotice,
  lostPicksNotice,
  yourTurnNotice,
} from './seatNotices';

function seat(row: string, number: number): ShowtimeSeat {
  return { id: `${row}-${number}`, row, number, kind: 'standard', status: 'held' };
}
const rows: ShowtimeSeatRow[] = [{ row: 'D', seats: [seat('D', 8), seat('D', 9), seat('D', 10)] }];

/** A notice the outcome is expected to earn (the silent outcome is tested on its own). */
function needNotice(outcome: HoldOutcome, shown: readonly ShowtimeSeatRow[] | undefined) {
  const draft = holdOutcomeNotice(outcome, shown);
  assert.ok(draft, `${outcome.kind} should earn a notice`);
  return draft;
}


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
  assert.deepEqual(needNotice({ id: 1, kind: 'taken', seatIds: ['D-9'] }, rows), {
    message: 'Seat D9 was just taken. Pick another.',
    tone: 'error',
    haptic: true,
    retry: false,
    refetch: true,
  });
});

test('a 409 that names no seat we know still refreshes the map and does not invent a name', () => {
  const notice = needNotice({ id: 1, kind: 'taken', seatIds: [] }, rows);
  assert.equal(notice.message, 'Some of your seats were just taken. Pick others.');
  assert.equal(notice.refetch, true);
  assert.equal(needNotice({ id: 1, kind: 'taken', seatIds: ['Z-1'] }, undefined).message, 'Some of your seats were just taken. Pick others.');
});

test('503 holds_unavailable: the retryable "temporarily unavailable" notice, picks kept, no buzz', () => {
  assert.deepEqual(needNotice({ id: 2, kind: 'unavailable' }, rows), {
    message: 'Seats are temporarily unavailable. Try again in a moment.',
    tone: 'error',
    haptic: false,
    retry: true,
    refetch: false,
  });
});

test('429 rate_limited: "slow down a moment", calm tone, no buzz, picks kept, Try again, nothing to refresh', () => {
  assert.deepEqual(needNotice({ id: 5, kind: 'rateLimited' }, rows), {
    message: 'Slow down a moment, then try again.',
    tone: 'info',
    haptic: false,
    retry: true,
    refetch: false,
  });
  assert.equal(RATE_LIMITED_MESSAGE, 'Slow down a moment, then try again.');
  // Nothing about the map changed (nothing was held), so it needs no refresh, with or without a map on screen.
  assert.equal(needNotice({ id: 5, kind: 'rateLimited' }, undefined).refetch, false);
});

test('no usable answer: says it could not confirm, and offers Try again (safe: the server treats a repeat as the same hold)', () => {
  const notice = needNotice({ id: 3, kind: 'uncertain' }, rows);
  assert.equal(notice.message, "Couldn't confirm your hold. Try again.");
  assert.equal(notice.retry, true);
});

test('a refusal the server gave on purpose shows its message, or a plain fallback', () => {
  assert.equal(needNotice({ id: 4, kind: 'rejected', message: 'Showing not found.' }, rows).message, 'Showing not found.');
  assert.equal(needNotice({ id: 4, kind: 'rejected', message: '' }, rows).message, "Couldn't hold those seats.");
  assert.equal(needNotice({ id: 4, kind: 'rejected', message: 'x' }, rows).retry, false);
});

// ---- Waiting room, overload and the hoarding cap (traffic slice 5d) -------------------------------

test('503 server_busy on a hold: a calm "very busy" notice with Try again, picks kept, no buzz, nothing to refresh', () => {
  assert.deepEqual(needNotice({ id: 6, kind: 'busy' }, rows), {
    message: "We're very busy right now. Try again in a moment.",
    tone: 'info',
    haptic: false,
    retry: true,
    refetch: false,
  });
  assert.equal(BUSY_MESSAGE, "We're very busy right now. Try again in a moment.");
});

test('403 waiting_room_required is silent: the screen joins the line again by itself, so no Toast', () => {
  assert.equal(holdOutcomeNotice({ id: 7, kind: 'needsPass' }, rows), null);
  assert.equal(holdOutcomeNotice({ id: 7, kind: 'needsPass' }, undefined), null);
});

test('409 hold_limit_reached: the limit comes from the server, with a warning buzz, a calm tone and no Try again', () => {
  assert.deepEqual(needNotice({ id: 8, kind: 'limitReached', holdLimit: { scope: 'owner', limit: 8, held: 8 } }, rows), {
    message: 'You can hold up to 8 seats for one showing.',
    tone: 'info',
    haptic: true,
    retry: false,
    refetch: false,
  });
});

test('hold_limit_reached never says a number the server did not send', () => {
  assert.equal(holdLimitMessage({ scope: 'owner', limit: 6, held: 6 }), 'You can hold up to 6 seats for one showing.');
  assert.equal(holdLimitMessage({ scope: 'owner', limit: 1, held: 1 }), 'You can hold up to 1 seat for one showing.');
  assert.equal(holdLimitMessage(null), "You've reached the most seats you can hold for one showing.");
  assert.ok(!/\d/.test(holdLimitMessage(null)), 'no digits when the server gave none');
});

test('hold_limit_reached at the address cap talks about the connection, not about "you"', () => {
  const message = holdLimitMessage({ scope: 'address', limit: 16, held: 16 });
  assert.equal(message, 'Too many seats are held from this connection for one showing.');
  assert.ok(!message.includes('16'), 'the address cap is not the number a person can act on');
});

test('being let in after waiting: a short success Toast with its own pulse (not the warning buzz), nothing to retry or refresh', () => {
  assert.deepEqual(yourTurnNotice(), {
    message: 'Your turn',
    tone: 'success',
    haptic: false,
    success: true,
    retry: false,
    refetch: false,
  });
  assert.equal(YOUR_TURN_MESSAGE, 'Your turn');
});

test('no other notice asks for the success pulse', () => {
  const outcomes: HoldOutcome[] = [
    { id: 1, kind: 'taken', seatIds: [] },
    { id: 2, kind: 'unavailable' },
    { id: 3, kind: 'rateLimited' },
    { id: 4, kind: 'busy' },
    { id: 5, kind: 'limitReached', holdLimit: null },
    { id: 6, kind: 'uncertain' },
    { id: 7, kind: 'rejected', message: 'x' },
  ];
  for (const outcome of outcomes) assert.notEqual(needNotice(outcome, rows).success, true, outcome.kind);
  assert.notEqual(lostPicksNotice(rows, ['D-8']).success, true);
});
