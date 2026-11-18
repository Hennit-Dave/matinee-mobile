import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOrderStatus, isOrderStatusResponse, type OrderStatusResponse } from './orderStatus';

const VALID: OrderStatusResponse = {
  reference: '33333333-3333-4333-8333-333333333333',
  status: 'succeeded',
  ticket: {
    movieId: 42,
    movieTitle: 'Dune',
    cinemaName: 'BFI Southbank',
    screenName: 'IMAX',
    format: 'IMAX',
    startsAt: '2026-12-01T20:30:00.000Z',
    time: '20:30',
    seats: [{ row: 'A', number: 1 }],
    totalFormatted: '£20.00',
  },
};

test('a succeeded order with a ticket passes; refunded with a reason passes; requires_payment has no ticket', () => {
  assert.equal(isOrderStatusResponse(VALID), true);
  assert.equal(isOrderStatusResponse({ reference: VALID.reference, status: 'refunded', refundReason: 'hold_expired_refund' }), true);
  assert.equal(isOrderStatusResponse({ reference: VALID.reference, status: 'requires_payment' }), true);
  assert.equal(isOrderStatusResponse({ reference: VALID.reference, status: 'failed' }), true);
});

test('a malformed order status is refused', () => {
  assert.equal(isOrderStatusResponse({ ...VALID, status: 'nonsense' }), false);
  assert.equal(isOrderStatusResponse({ ...VALID, ticket: { ...VALID.ticket, seats: [{ row: 1, number: 1 }] } }), false);
  assert.equal(isOrderStatusResponse(null), false);
});

test('isOrderStatus accepts only the four server states', () => {
  assert.deepEqual(['requires_payment', 'succeeded', 'refunded', 'failed'].filter(isOrderStatus), [
    'requires_payment',
    'succeeded',
    'refunded',
    'failed',
  ]);
  assert.equal(isOrderStatus('processing'), false);
});
