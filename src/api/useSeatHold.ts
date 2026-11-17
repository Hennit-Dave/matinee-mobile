import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { getClientId } from './clientIdNative';
import { readClock } from './holdClock';
import { createHoldController, type HoldController, type HoldState } from './holdMachine';
import { acquireHold, releaseHold } from './holds';
import { MovieApiError } from './movies';
import { safeReadBaseUrl } from './useMovies';

/** The base URL, or an error the controller reads as "refused, nothing held" (a missing setting is not a hold). */
function requireBaseUrl(): string {
  const { baseUrl, configError } = safeReadBaseUrl();
  if (baseUrl === null) {
    throw new MovieApiError(configError?.message ?? 'The API address is not set.', {
      status: 0,
      kind: 'validation_failed',
      retryable: false,
    });
  }
  return baseUrl;
}

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
