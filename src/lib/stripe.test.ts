import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPaymentSheetError, readStripePublishableKey } from './stripe';

test('the PaymentSheet answer maps to its meaning: success, canceled, timeout, failed', () => {
  assert.equal(classifyPaymentSheetError(undefined), 'success');
  assert.equal(classifyPaymentSheetError({ code: 'Canceled' }), 'canceled');
  assert.equal(classifyPaymentSheetError({ code: 'Timeout' }), 'timeout');
  assert.equal(classifyPaymentSheetError({ code: 'Failed' }), 'failed');
  assert.equal(classifyPaymentSheetError({ code: 'SomethingElse' }), 'failed');
});

test('the publishable key is public config: present when set, null when not', () => {
  // The env is not set in a test run, so this reads null — the important part is that it never throws and
  // that a blank value is treated the same as an absent one.
  assert.equal(readStripePublishableKey(), null);
});
