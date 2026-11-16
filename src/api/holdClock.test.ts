import { test } from 'node:test';
import assert from 'node:assert/strict';
import { URGENT_BELOW_SECONDS, countdownTone, formatCountdown } from '../components/countdownLogic';
import {
  ANNOUNCE_AT_SECONDS,
  HOLD_ENDED_ANNOUNCEMENT,
  announcementFor,
  nextTickDelayMs,
  remainingMs,
  secondsToShow,
  startHoldClock,
  type ClockReading,
} from './holdClock';

const T0: ClockReading = { mono: 50_000, wall: 1_763_328_000_000 };
const at = (monoMs: number, wallMs: number = monoMs): ClockReading => ({ mono: T0.mono + monoMs, wall: T0.wall + wallMs });

test('seeded from expiresInMs: the full time is left at the moment of the response', () => {
  const clock = startHoldClock(599_940, T0);
  assert.equal(remainingMs(clock, T0), 599_940);
});

test('time left falls as both clocks run, and is 0 (never negative) once it is up', () => {
  const clock = startHoldClock(600_000, T0);
  assert.equal(remainingMs(clock, at(1_000)), 599_000);
  assert.equal(remainingMs(clock, at(600_000)), 0);
  assert.equal(remainingMs(clock, at(900_000)), 0);
});

test('a hold that arrives with 0 left, a negative or a non-finite time is already over', () => {
  for (const seed of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(remainingMs(startHoldClock(seed, T0), T0), 0, String(seed));
  }
});

test('the countdown never shows more time than the hold has: the larger elapsed reading wins', () => {
  const clock = startHoldClock(600_000, T0);

  // Deep sleep: the monotonic clock moved 1 s while the wall clock moved 301 s (the phone slept for 5 minutes).
  assert.equal(remainingMs(clock, at(1_000, 301_000)), 299_000);

  // The user set the wall clock BACK an hour: the monotonic clock still counts, so time is not given back.
  assert.equal(remainingMs(clock, at(60_000, -3_600_000)), 540_000);

  // The wall clock was moved forward: the countdown shortens (the safe direction), it does not lengthen.
  assert.equal(remainingMs(clock, at(1_000, 3_600_000)), 0);
});

test('time never increases from one reading to the next, even if a clock jumps back mid-run', () => {
  const clock = startHoldClock(600_000, T0);
  const readings = [at(0), at(10_000, 10_000), at(20_000, -5_000), at(30_000, 30_000), at(31_000, 0)];
  let previous = Infinity;
  for (const reading of readings) {
    const left = remainingMs(clock, reading);
    assert.ok(left <= previous, `${left} should not exceed ${previous}`);
    previous = left;
  }
});

test('seconds are rounded UP, so 0:00 shows only when the hold has ended', () => {
  assert.equal(secondsToShow(600_000), 600);
  assert.equal(secondsToShow(599_999), 600);
  assert.equal(secondsToShow(599_000), 599);
  assert.equal(secondsToShow(1), 1);
  assert.equal(secondsToShow(0), 0);
  assert.equal(secondsToShow(-3), 0);
});

test('with the real window, the pill reads 10:00 at the start, 2:00 is calm and 1:59 is urgent', () => {
  assert.equal(formatCountdown(secondsToShow(600_000)), '10:00');
  assert.equal(formatCountdown(secondsToShow(599_940)), '10:00', 'a hold a trip old is still 10:00 on screen');
  assert.equal(countdownTone(secondsToShow(120_000)), 'calm');
  assert.equal(countdownTone(secondsToShow(119_500)), 'calm', '119.5 s left is shown as 2:00 (rounded up), still calm');
  assert.equal(countdownTone(secondsToShow(119_000)), 'urgent');
  assert.equal(formatCountdown(secondsToShow(119_000)), '1:59');
  assert.equal(URGENT_BELOW_SECONDS, 120);
  assert.equal(formatCountdown(secondsToShow(0)), '0:00');
});

test('the next tick lands just after the shown second changes, never sooner, and never loops', () => {
  assert.equal(nextTickDelayMs(0), 0);
  assert.equal(nextTickDelayMs(-5), 0);
  // 2.5 s left shows "3"; it shows "2" once 2.0 s are left, 500 ms from now.
  const delay = nextTickDelayMs(2_500);
  assert.ok(delay >= 500 && delay <= 510, String(delay));
  assert.equal(secondsToShow(2_500 - delay), 2);
  // Exactly on a boundary: a full second until the next change, not 0 (which would spin).
  const onBoundary = nextTickDelayMs(3_000);
  assert.ok(onBoundary >= 1_000 && onBoundary <= 1_010, String(onBoundary));
  // Always positive while there is time left.
  for (const r of [1, 999, 1_000, 1_001, 59_999, 600_000]) assert.ok(nextTickDelayMs(r) > 0, String(r));
});

test('a screen reader is told at 5:00, 2:00, 1:00 and 0:30, once each, and when the hold ends', () => {
  assert.deepEqual([...ANNOUNCE_AT_SECONDS], [300, 120, 60, 30]);
  const heard: string[] = [];
  let previous = 600;
  for (let shown = 599; shown >= 0; shown--) {
    const message = announcementFor(previous, shown);
    if (message) heard.push(`${shown}: ${message}`);
    previous = shown;
  }
  assert.deepEqual(heard, [
    '300: 5 minutes left',
    '120: 2 minutes left',
    '60: 1 minute left',
    '30: 30 seconds left',
    `0: ${HOLD_ENDED_ANNOUNCEMENT}`,
  ]);
});

test('a long sleep that jumps past several thresholds is announced once, with the time actually left', () => {
  assert.equal(announcementFor(400, 100), '1 minute 40 seconds left');
  assert.equal(announcementFor(400, 0), HOLD_ENDED_ANNOUNCEMENT);
});

test('nothing is announced when the time did not fall, between thresholds, or after the end', () => {
  assert.equal(announcementFor(600, 600), null);
  assert.equal(announcementFor(100, 150), null, 'time never "goes up"');
  assert.equal(announcementFor(299, 298), null);
  assert.equal(announcementFor(0, 0), null, 'the end is announced once');
});
