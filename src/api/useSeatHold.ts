import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { getClientId } from './clientIdNative';
import { readClock } from './holdClock';
import { createHoldController, type HoldController, type HoldState } from './holdMachine';
import { acquireHold, releaseHold } from './holds';
import { requireBaseUrl } from './requireBaseUrl';

export interface UseSeatHoldResult {
  state: HoldState;
  controller: HoldController;
}

/**
 * Binds one showing's hold flow (holdMachine.ts) to a screen. All the rules live in the controller; this only
 * - makes it with the real network, clocks and timers,
 * - re-renders the screen when it changes,
 * - gives the seats back when the screen goes away (back button, swipe, unmount), and
 * - re-checks the countdown when the app returns to the foreground, because timers do not run reliably while a
 *   phone sleeps and a hold may have ended meanwhile.
 */
export function useSeatHold(showtimeId: string): UseSeatHoldResult {
  // One controller per showing, for as long as this screen is mounted. If React ever dropped this cached value,
  // the old controller's cleanup below would give its seats back and the screen would simply return to picking:
  // benign, and the same thing a Fast Refresh does in development.
  const controller = useMemo(
    () =>
      createHoldController({
        acquire: async (seatIds) => acquireHold(showtimeId, seatIds, await getClientId(), undefined, requireBaseUrl()),
        release: async (seatIds) => releaseHold(showtimeId, seatIds, await getClientId(), undefined, requireBaseUrl()),
        now: readClock,
        schedule: (callback, delayMs) => {
          const timer = setTimeout(callback, delayMs);
          return () => clearTimeout(timer);
        },
      }),
    [showtimeId]
  );

  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  useEffect(() => {
    controller.attach();
    return () => controller.detach();
  }, [controller]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') controller.checkExpiry();
    });
    return () => subscription.remove();
  }, [controller]);

  return { state, controller };
}
