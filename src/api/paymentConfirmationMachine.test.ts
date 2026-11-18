import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentConfirmationController, CONFIRM_TIMEOUT_MS } from './paymentConfirmationMachine';
import type { OrderStatusResponse } from './orderStatus';

const REF = '33333333-3333-4333-8333-333333333333';
const TICKET = {
  movieId: 42,
  movieTitle: 'Dune',
  cinemaName: 'BFI Southbank',
  screenName: 'IMAX',
  format: 'IMAX',
  startsAt: '2026-12-01T20:30:00.000Z',
  time: '20:30',
  seats: [{ row: 'A', number: 1 }],
  totalFormatted: '£20.00',
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function boot(answers: (OrderStatusResponse | Error)[]) {
  const clock = { now: 1_000_000 };
  const timers: { callback: () => void; delayMs: number }[] = [];
  const poll = async (): Promise<OrderStatusResponse> => {
    const next = answers.shift();
    if (!next) throw new Error('no answer left');
    if (next instanceof Error) throw next;
    return next;
  };
  const controller = createPaymentConfirmationController({
    poll,
    schedule: (callback, delayMs) => {
      timers.push({ callback, delayMs });
      return () => {
        const i = timers.findIndex((t) => t.callback === callback);
        if (i >= 0) timers.splice(i, 1);
      };
    },
    now: () => clock.now,
  });
  return {
    controller,
    clock,
    timers,
    /** Runs the next scheduled poll and lets its async work settle. */
    fire: async () => {
      const timer = timers.shift();
      timer?.callback();
      await tick();
      await tick();
    },
  };
}

test('a succeeded order is a terminal success with the ticket', async () => {
  const app = boot([{ reference: REF, status: 'succeeded', ticket: TICKET }]);
  app.controller.start(REF);
  await tick();
  await tick();
  const state = app.controller.getState();
  assert.equal(state.phase, 'succeeded');
  assert.equal(state.ticket?.movieTitle, 'Dune');
});

test('a refunded order is a terminal refund with the reason; a failed order is a terminal failure', async () => {
  const refunded = boot([{ reference: REF, status: 'refunded', refundReason: 'hold_expired_refund' }]);
  refunded.controller.start(REF);
  await tick();
  await tick();
  assert.deepEqual(refunded.controller.getState(), { phase: 'refunded', reference: REF, ticket: null, refundReason: 'hold_expired_refund' });

  const failed = boot([{ reference: REF, status: 'failed' }]);
  failed.controller.start(REF);
  await tick();
  await tick();
  assert.equal(failed.controller.getState().phase, 'failed');
});

test('requires_payment keeps polling, and the deadline turns it into unconfirmed (not a dead end)', async () => {
  const app = boot([{ reference: REF, status: 'requires_payment' }, { reference: REF, status: 'requires_payment' }]);
  app.controller.start(REF);
  await tick();
  await tick();
  assert.equal(app.controller.getState().phase, 'checking');
  assert.equal(app.timers.length, 1, 'the next poll is scheduled');

  app.clock.now += CONFIRM_TIMEOUT_MS + 1; // the deadline has passed
  await app.fire();
  assert.equal(app.controller.getState().phase, 'unconfirmed');

  // retry gives it a fresh window.
  app.clock.now += 1;
  app.controller.retry();
  await tick();
  await tick();
  assert.equal(app.controller.getState().phase, 'checking');
});

test('a failed poll is tolerated: it keeps asking instead of failing', async () => {
  const app = boot([new Error('network'), { reference: REF, status: 'succeeded', ticket: TICKET }]);
  app.controller.start(REF);
  await tick();
  await tick();
  assert.equal(app.controller.getState().phase, 'checking', 'the network error did not end the flow');
  await app.fire();
  assert.equal(app.controller.getState().phase, 'succeeded');
});
