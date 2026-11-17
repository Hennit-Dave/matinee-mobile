import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  POLL_FAILURES_BEFORE_ERROR,
  SEATS_POLL_INTERVAL_MS,
  isPollingActive,
  nextPollDelay,
  pollIntervalMs,
  shouldRefreshOnResume,
} from './seatsPolling';

test('the interval is 5 s, plus or minus 20 %: 4 s to 6 s, and the middle is 5 s', () => {
  assert.equal(SEATS_POLL_INTERVAL_MS, 5_000);
  assert.equal(pollIntervalMs(0), 4_000);
  assert.equal(pollIntervalMs(0.5), 5_000);
  assert.equal(pollIntervalMs(1), 6_000);
  for (let r = 0; r <= 1; r += 0.01) {
    const ms = pollIntervalMs(r);
    assert.ok(ms >= 4_000 && ms <= 6_000, `${r} gave ${ms}`);
  }
});

test('a random number outside 0..1 cannot push the wait out of bounds', () => {
  assert.equal(pollIntervalMs(-3), 4_000);
  assert.equal(pollIntervalMs(7), 6_000);
});

test('polling is on only while the screen is focused AND the app is in the foreground', () => {
  assert.equal(isPollingActive({ focused: true, appState: 'active' }), true);
  assert.equal(isPollingActive({ focused: false, appState: 'active' }), false, 'another screen is on top');
  assert.equal(isPollingActive({ focused: true, appState: 'background' }), false);
  assert.equal(isPollingActive({ focused: true, appState: 'inactive' }), false);
  assert.equal(isPollingActive({ focused: false, appState: 'background' }), false);
});

test('while paused there is no next refresh at all', () => {
  assert.equal(nextPollDelay({ active: false, consecutiveFailures: 0, random: 0.5 }), false);
});

test('while active the next refresh is one jittered interval away', () => {
  assert.equal(nextPollDelay({ active: true, consecutiveFailures: 0, random: 0.5 }), 5_000);
  assert.equal(nextPollDelay({ active: true, consecutiveFailures: 1, random: 0 }), 4_000, 'one or two failures keep polling');
  assert.equal(nextPollDelay({ active: true, consecutiveFailures: POLL_FAILURES_BEFORE_ERROR - 1, random: 1 }), 6_000);
});

test('after three failures in a row polling stops, so a phone with no signal is not hammering behind the error screen', () => {
  assert.equal(POLL_FAILURES_BEFORE_ERROR, 3);
  assert.equal(nextPollDelay({ active: true, consecutiveFailures: 3, random: 0.5 }), false);
  assert.equal(nextPollDelay({ active: true, consecutiveFailures: 9, random: 0.5 }), false);
});

test('coming back to the screen or the foreground refreshes at once; nothing else does', () => {
  assert.equal(shouldRefreshOnResume(false, true), true);
  assert.equal(shouldRefreshOnResume(true, true), false, 'already polling');
  assert.equal(shouldRefreshOnResume(true, false), false, 'going away');
  assert.equal(shouldRefreshOnResume(false, false), false);
});
