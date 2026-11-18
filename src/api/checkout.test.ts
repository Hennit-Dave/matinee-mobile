import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutFailureMessage, idempotencyKeyFor, isCheckoutResponse, type CheckoutResponse } from './checkout';
import { MovieApiError } from './movies';

const VALID: CheckoutResponse = {
  reference: '33333333-3333-4333-8333-333333333333',
  showtimeId: '11111111-1111-4111-8111-111111111111',
  seatIds: ['aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'],
  seatTotalCents: 1850,
  feeCents: 150,
  totalCents: 2000,
  totalFormatted: '£20.00',
  currency: 'gbp',
  clientSecret: 'pi_secret',
  status: 'requires_payment',
};

test('a well-formed checkout response passes the guard; a clientSecret of null is allowed', () => {
  assert.equal(isCheckoutResponse(VALID), true);
  assert.equal(isCheckoutResponse({ ...VALID, clientSecret: null }), true);
});

test('a malformed checkout response is refused (money must be whole pence, seats non-empty)', () => {
  assert.equal(isCheckoutResponse({ ...VALID, totalCents: 19.99 }), false);
  assert.equal(isCheckoutResponse({ ...VALID, seatIds: [] }), false);
  assert.equal(isCheckoutResponse({ ...VALID, reference: 42 }), false);
  assert.equal(isCheckoutResponse(null), false);
  assert.equal(isCheckoutResponse({ ...VALID, totalFormatted: 2000 }), false);
});

test('the idempotency key is deterministic on (showtime, seats): a retry reuses it, a different seat does not', () => {
  const showtime = '11111111-1111-4111-8111-111111111111';
  const a1 = 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  const a2 = 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  assert.equal(idempotencyKeyFor(showtime, [a1, a2]), idempotencyKeyFor(showtime, [a2, a1]), 'order-insensitive');
  assert.notEqual(idempotencyKeyFor(showtime, [a1]), idempotencyKeyFor(showtime, [a2]));
  assert.notEqual(idempotencyKeyFor('99999999-9999-4999-8999-999999999999', [a1]), idempotencyKeyFor(showtime, [a1]));
});

test('checkout failures map to a clear line and never a raw 5xx', () => {
  const err = (kind: MovieApiError['kind']) => new MovieApiError('x', { status: 0, kind });
  assert.equal(checkoutFailureMessage(err('seat_not_held')), 'Those seats are no longer available. Go back and pick different ones.');
  assert.equal(checkoutFailureMessage(err('seat_taken')), 'Those seats are no longer available. Go back and pick different ones.');
  assert.equal(checkoutFailureMessage(err('rate_limited')), 'Slow down a moment, then try again.');
  assert.equal(checkoutFailureMessage(err('payment_unavailable')), 'Payment is temporarily unavailable. Try again shortly.');
  assert.equal(checkoutFailureMessage(err('network_error')), 'Could not reach the Matinee server. Check your connection and try again.');
  assert.equal(checkoutFailureMessage(new Error('boom')), 'Could not start the payment. Check your connection and try again.');
});
