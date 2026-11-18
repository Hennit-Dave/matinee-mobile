import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEAVE_LABEL,
  NEXT_IN_LINE,
  OVERLOADED_BODY,
  OVERLOADED_HEADLINE,
  OVERLOADED_RETRY_LABEL,
  QUEUE_HEADING,
  WAITING_NOTE,
  aheadCaption,
  aheadNumeral,
  aheadSpoken,
  freshnessLabel,
  retryFootnote,
} from './waitingRoomLogic';

test('the place in the line is a number and a label, never a time', () => {
  assert.equal(aheadNumeral(128), '128');
  assert.equal(aheadCaption(128), 'people ahead of you');
  assert.equal(aheadCaption(2), 'people ahead of you');
  assert.equal(aheadCaption(1), 'person ahead of you', 'one person is not "people"');
  assert.equal(aheadSpoken(128), '128 people ahead of you');
  assert.equal(aheadSpoken(1), '1 person ahead of you');
});

test('nobody ahead is "You\'re next", and is not drawn as a zero', () => {
  assert.equal(NEXT_IN_LINE, "You're next");
  assert.equal(aheadSpoken(0), "You're next");
  assert.equal(aheadSpoken(-3), "You're next", 'a negative place cannot reach the screen as one');
});

test('the numeral is always a whole, non-negative number, whatever it is given', () => {
  assert.equal(aheadNumeral(0), '0');
  assert.equal(aheadNumeral(7.9), '7');
  assert.equal(aheadNumeral(-4), '0');
  assert.equal(aheadNumeral(Number.NaN), '0');
  assert.equal(aheadNumeral(Number.POSITIVE_INFINITY), '0');
  assert.equal(aheadNumeral(1280), '1280');
});

test('no word on the waiting room promises a time or a notification', () => {
  const words = [QUEUE_HEADING, LEAVE_LABEL, WAITING_NOTE, NEXT_IN_LINE, aheadSpoken(5), aheadSpoken(0), freshnessLabel(false), freshnessLabel(true)];
  for (const text of words) {
    assert.ok(!/\b(minute|min|second|hour|about|around|roughly|estimate)s?\b/i.test(text), `"${text}" mentions a time`);
    assert.ok(!/\b(notif|push|lock your phone|we'll tell you|we will tell you)/i.test(text), `"${text}" promises a notification`);
  }
});

test('the note is the deliberate deviation from Figma: keep the app open, move them the moment it is their turn', () => {
  assert.equal(WAITING_NOTE, "Your place is held. Keep Matinee open and we'll move you the moment it's your turn.");
  assert.ok(!WAITING_NOTE.includes('lock your phone'), 'Figma promises a push that does not exist');
});

test('the Figma wording that stays is word for word', () => {
  assert.equal(QUEUE_HEADING, "You're in the queue");
  assert.equal(LEAVE_LABEL, 'Leave the queue');
  assert.equal(OVERLOADED_HEADLINE, "We're very busy right now");
  assert.equal(OVERLOADED_BODY, "Lots of people are booking at once. You haven't been charged. We'll try again for you.");
  assert.equal(OVERLOADED_RETRY_LABEL, 'Try again now');
});

test('the freshness line only says "just now" when the last refresh worked', () => {
  assert.equal(freshnessLabel(false), 'Updated just now');
  assert.equal(freshnessLabel(true), 'Trying to update…');
});

test('the retry footnote counts down in the Figma form, and says "Trying again…" once there is nothing left to count', () => {
  assert.equal(retryFootnote(14, false), 'Trying again in 0:14');
  assert.equal(retryFootnote(9, false), 'Trying again in 0:09');
  assert.equal(retryFootnote(60, false), 'Trying again in 1:00');
  assert.equal(retryFootnote(1, false), 'Trying again in 0:01');
  assert.equal(retryFootnote(0, false), 'Trying again…');
  assert.equal(retryFootnote(14, true), 'Trying again…', 'a request in flight is not a countdown');
});
