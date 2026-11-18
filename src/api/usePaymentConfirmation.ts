import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { getClientId } from './clientIdNative';
import { fetchOrderStatus } from './orderStatus';
import {
  createPaymentConfirmationController,
  type PaymentConfirmationController,
  type PaymentConfirmationState,
} from './paymentConfirmationMachine';
import { requireBaseUrl } from './requireBaseUrl';

export interface UsePaymentConfirmationResult {
  state: PaymentConfirmationState;
  controller: PaymentConfirmationController;
}

/**
 * Binds one order's confirmation poll (paymentConfirmationMachine.ts) to the checkout screen. All the rules
 * live in the controller; this only makes it with the real network and timers, re-renders the screen when it
 * changes, and stops asking when the screen goes away.
 */
export function usePaymentConfirmation(): UsePaymentConfirmationResult {
  const controller = useMemo(
    () =>
      createPaymentConfirmationController({
        poll: async (reference) => fetchOrderStatus(reference, await getClientId(), undefined, requireBaseUrl()),
        schedule: (callback, delayMs) => {
          const timer = setTimeout(callback, delayMs);
          return () => clearTimeout(timer);
        },
        now: Date.now,
      }),
    []
  );

  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  useEffect(() => {
    controller.attach();
    return () => controller.detach();
  }, [controller]);

  return { state, controller };
}
