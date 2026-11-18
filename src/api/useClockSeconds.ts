import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { nextTickDelayMs, readClock, remainingMs, secondsToShow, type HoldClock } from './holdClock';

/**
 * Whole seconds left on `clock`, ticking on the second boundary, or 0 with no clock. The same clock rules as the seat-hold
 * countdown (holdClock.ts): seeded from a DURATION, never longer than it should be after a long sleep or a changed phone
 * clock, rounded up so the display reaches 0 exactly when the time is up, and recomputed when the app returns to the
 * foreground because timers do not run reliably while a phone sleeps.
 *
 * `onElapsed` is called once per clock, when it reaches zero (the seat screen retries then; the waiting room's own
 * machine retries by itself and passes none).
 */
export function useClockSeconds(clock: HoldClock | null, onElapsed?: () => void): number {
  const [seconds, setSeconds] = useState(() => (clock ? secondsToShow(remainingMs(clock, readClock())) : 0));
  const onElapsedRef = useRef(onElapsed);
  useEffect(() => {
    onElapsedRef.current = onElapsed;
  });

  useEffect(() => {
    if (!clock) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fired = false;

    const tick = () => {
      const left = remainingMs(clock, readClock());
      setSeconds(secondsToShow(left));
      if (left <= 0) {
        if (!fired) {
          fired = true;
          onElapsedRef.current?.();
        }
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

  // With no clock there is nothing to count, whatever the last clock left behind.
  return clock ? seconds : 0;
}
