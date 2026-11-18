import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { getClientId } from './clientIdNative';
import { readClock } from './holdClock';
import { requireBaseUrl } from './requireBaseUrl';
import { joinQueue, leaveQueue, pollQueue } from './waitingRoom';
import {
  createWaitingRoomController,
  type WaitingRoomController,
  type WaitingRoomState,
} from './waitingRoomMachine';

export interface UseWaitingRoomResult {
  state: WaitingRoomState;
  controller: WaitingRoomController;
}

export interface UseWaitingRoomOptions {
  /**
   * False when there is nothing to queue for (a deep link with an id that is not a showing): the room stays idle and
   * sends nothing, and the screen shows what it always showed for that.
   */
  enabled: boolean;
  /**
   * True while this screen is on top AND the app is in the foreground (`usePollActive`). The line is asked about only
   * then, and at once on return. A place survives 90 s of silence on the server (ADR 0017).
   */
  active: boolean;
}

/**
 * Binds one showing's waiting room (waitingRoomMachine.ts) to a screen. All the rules live in the controller; this only
 * - makes it with the real network, clocks, timers and random draw,
 * - re-renders the screen when it changes,
 * - joins when the screen opens and gives the place (or the pass) back when it goes away (back button, swipe, unmount), and
 * - tells it when the screen is paused or back.
 */
export function useWaitingRoom(showtimeId: string, { enabled, active }: UseWaitingRoomOptions): UseWaitingRoomResult {
  // One controller per showing, for as long as this screen is mounted. If React ever dropped this cached value, the old
  // controller's cleanup below would give its place back and a new one would join: benign, and the same thing a Fast
  // Refresh does in development.
  const controller = useMemo(
    () =>
      createWaitingRoomController({
        join: async () => joinQueue(showtimeId, await getClientId(), undefined, requireBaseUrl()),
        poll: async () => pollQueue(showtimeId, await getClientId(), undefined, requireBaseUrl()),
        leave: async () => leaveQueue(showtimeId, await getClientId(), undefined, requireBaseUrl()),
        now: readClock,
        schedule: (callback, delayMs) => {
          const timer = setTimeout(callback, delayMs);
          return () => clearTimeout(timer);
        },
        random: Math.random,
      }),
    [showtimeId]
  );

  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  useEffect(() => {
    if (!enabled) return;
    controller.attach();
    controller.start();
    return () => controller.detach();
  }, [controller, enabled]);

  useEffect(() => {
    controller.setActive(active);
  }, [controller, active]);

  return { state, controller };
}
