import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTicketItem, isTicketsResponse, isUpcomingTicket, ticketBadge, ticketNote, type TicketItem } from './tickets';

const NOW = Date.parse('2026-11-25T00:00:00.000Z');

const item = (overrides: Partial<TicketItem> = {}): TicketItem => ({
  reference: '33333333-3333-4333-8333-333333333333',
  status: 'succeeded',
  movieId: 42,
  movieTitle: 'Dune',
  cinemaName: 'BFI Southbank',
  screenName: 'IMAX',
  format: 'IMAX',
  startsAt: '2026-12-01T20:30:00.000Z',
  time: '20:30',
  seats: [{ row: 'A', number: 1 }],
  totalFormatted: '£20.00',
  ...overrides,
});

test('isTicketItem / isTicketsResponse accept a valid item and reject malformed ones', () => {
  assert.equal(isTicketItem(item()), true);
  assert.equal(isTicketsResponse([item()]), true);
  assert.equal(isTicketsResponse([]), true);

  assert.equal(isTicketItem({ ...item(), status: 'failed' }), false, 'failed is not a ticket status');
  assert.equal(isTicketItem({ ...item(), seats: [{ row: 'A' }] }), false, 'a seat needs row and number');
  assert.equal(isTicketsResponse([item(), { nope: true }]), false);
  assert.equal(isTicketsResponse('not-an-array'), false);
});

test('isUpcomingTicket: succeeded ahead is upcoming, succeeded past and any refunded are past', () => {
  assert.equal(isUpcomingTicket('succeeded', '2026-12-01T20:30:00.000Z', NOW), true);
  assert.equal(isUpcomingTicket('succeeded', '2026-11-20T20:30:00.000Z', NOW), false);
  assert.equal(isUpcomingTicket('refunded', '2026-12-01T20:30:00.000Z', NOW), false, 'refunded is never upcoming');
  assert.equal(isUpcomingTicket('requires_payment', '2026-12-01T20:30:00.000Z', NOW), true, 'confirming is upcoming');
});

test('ticketBadge maps status + time to the right word and tone', () => {
  assert.deepEqual(ticketBadge('succeeded', '2026-12-01T20:30:00.000Z', NOW), { label: 'Ready', tone: 'success' });
  assert.deepEqual(ticketBadge('succeeded', '2026-11-20T20:30:00.000Z', NOW), { label: 'Watched', tone: 'neutral' });
  assert.deepEqual(ticketBadge('refunded', '2026-12-01T20:30:00.000Z', NOW), { label: 'Refunded', tone: 'warning' });
  assert.deepEqual(ticketBadge('requires_payment', '2026-12-01T20:30:00.000Z', NOW), { label: 'Confirming', tone: 'info' });
});

test('ticketNote varies by status and is null for a watched (past, succeeded) ticket', () => {
  assert.equal(ticketNote('refunded', '2026-12-01T20:30:00.000Z', NOW), 'Refund on its way');
  assert.equal(ticketNote('requires_payment', '2026-12-01T20:30:00.000Z', NOW), 'Ticket appears here soon');
  assert.equal(ticketNote('succeeded', '2026-12-01T20:30:00.000Z', NOW), 'Saved on this phone');
  assert.equal(ticketNote('succeeded', '2026-11-20T20:30:00.000Z', NOW), null);
});
