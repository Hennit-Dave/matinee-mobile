import { test } from 'node:test';
import assert from 'node:assert/strict';
import { URGENT_BELOW_SECONDS, countdownTone, formatCountdown, spokenCountdown } from './countdownLogic';

test('the time reads m:ss with the minutes unpadded and the seconds padded', () => {
  assert.equal(formatCountdown(598), '9:58');
  assert.equal(formatCountdown(600), '10:00');
  assert.equal(formatCountdown(119), '1:59');
  assert.equal(formatCountdown(65), '1:05');
  assert.equal(formatCountdown(9), '0:09');
  assert.equal(formatCountdown(0), '0:00');
});

test('time never goes negative, and a fraction or a bad number is tidied rather than shown', () => {
  assert.equal(formatCountdown(-5), '0:00');
  assert.equal(formatCountdown(58.9), '0:58');
  assert.equal(formatCountdown(Number.NaN), '0:00');
  assert.equal(formatCountdown(Number.POSITIVE_INFINITY), '0:00');
});

test('calm until 2:00, urgent for the last two minutes (Figma: 9:58 calm, 1:59 urgent)', () => {
  assert.equal(URGENT_BELOW_SECONDS, 120);
  assert.equal(countdownTone(598), 'calm');
  assert.equal(countdownTone(121), 'calm');
  assert.equal(countdownTone(120), 'calm', '2:00 itself is still calm');
  assert.equal(countdownTone(119), 'urgent');
  assert.equal(countdownTone(1), 'urgent');
  assert.equal(countdownTone(0), 'urgent');
});

test('screen readers hear the time in words', () => {
  assert.equal(spokenCountdown(598), '9 minutes 58 seconds left');
  assert.equal(spokenCountdown(61), '1 minute 1 second left');
  assert.equal(spokenCountdown(120), '2 minutes left');
  assert.equal(spokenCountdown(45), '45 seconds left');
  assert.equal(spokenCountdown(0), '0 seconds left');
});
