import assert from 'node:assert/strict';
import { test } from 'node:test';
import { refundReasonCopy } from './refundCopy';

test('showtime_cancelled_refund goes home, never back to a dead seat map', () => {
  assert.deepEqual(refundReasonCopy('showtime_cancelled_refund'), {
    headline: 'This showing was cancelled',
    body: 'Your payment has been refunded. Browse other showings to try again.',
    destination: 'home',
  });
});

test('the hold-expiry reasons keep the existing "back to seats" copy and action', () => {
  const expected = {
    headline: 'Your seats were released',
    body: 'Your payment has been refunded because the hold ran out. Pick different seats to try again.',
    destination: 'seats',
  };
  assert.deepEqual(refundReasonCopy('hold_expired_refund'), expected);
  assert.deepEqual(refundReasonCopy('hold_lapsed_refund'), expected);
});

test('an unknown or missing reason is a safe generic, never a blank, and goes home', () => {
  const expected = {
    headline: 'Your payment was refunded',
    body: 'Your payment has been refunded.',
    destination: 'home',
  };
  assert.deepEqual(refundReasonCopy(undefined), expected);
  assert.deepEqual(refundReasonCopy(null), expected);
  assert.deepEqual(refundReasonCopy('some_future_reason'), expected);
  assert.deepEqual(refundReasonCopy(''), expected);
});
