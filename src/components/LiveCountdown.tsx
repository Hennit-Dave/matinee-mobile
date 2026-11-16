import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import {
  announcementFor,
  nextTickDelayMs,
  readClock,
  remainingMs,
  secondsToShow,
  type HoldClock,
} from '../api/holdClock';
import { Countdown } from './Countdown';

export interface LiveCountdownProps {
  /** The running hold: its seed from the server and when it was measured (see holdClock.ts). */
  clock: HoldClock;
  /** Called once when the time reaches zero. The hold's own timer also ends the hold; this is for the display. */
  onExpire?: () => void;
}

/**
 * The seat-hold `Countdown` (Figma 37:819) with a clock behind it. `Countdown` stays presentational; this is the
 * one place that ticks, so only this small pill re-renders each second and the seat map beside it does not.
 *
 * - Ticks on the second boundary (`nextTickDelayMs`), not on a fixed interval, so it neither drifts nor jitters.
 * - Time left comes from `remainingMs`, which never shows more than the hold has (clock changes and deep sleep
 *   included, see holdClock.ts). It is recomputed when the app returns to the foreground, because timers do
 *   not run reliably while a phone sleeps.
 * - A screen reader hears the time at 5:00, 2:00, 1:00 and 0:30 and when the hold ends, not every second.
 */
export function LiveCountdown({ clock, onExpire }: LiveCountdownProps) {
  const [seconds, setSeconds] = useState(() => secondsToShow(remainingMs(clock, readClock())));
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previous = secondsToShow(remainingMs(clock, readClock()));

    const tick = () => {
      const left = remainingMs(clock, readClock());
      const shown = secondsToShow(left);
      setSeconds(shown);

      const message = announcementFor(previous, shown);
      previous = shown;
      if (message) AccessibilityInfo.announceForAccessibility(message);

      if (left <= 0) {
        onExpireRef.current?.();
        return;
      }
      timer = setTimeout(tick, nextTickDelayMs(left));
    };

    tick();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      clearTimeout(timer);
      tick();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [clock]);

  return <Countdown secondsRemaining={seconds} />;
}
