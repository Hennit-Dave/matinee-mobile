import type { OrderStatusResponse, OrderTicket } from './orderStatus';

/**
 * The confirmation poll for one order, with no React in it so it is unit-tested with `node --test` (no React
 * Native renderer here). The PaymentSheet saying "success" is NOT a booking — the server confirms only on its
 * verified webhook, so the app polls `GET /orders/:reference` until the order resolves, then hands the screen a
 * terminal state.
 *
 *   checking ──succeeded──▶ succeeded (→ the ticket)
 *      │  └─refunded──────▶ refunded  (the hold lapsed: seats released, payment refunded)
 *      │  └─failed────────▶ failed    (payment did not go through)
 *      └─deadline passed─▶ unconfirmed ("still confirming" — retry() re-enters checking)
 *
 * A failed poll is tolerated (the endpoint is shed-exempt and generous; a dropped packet must not end the flow):
 * it just asks again at the next interval. Only the overall deadline ends it, and `retry()` restarts it.
 */

export type PaymentConfirmationPhase = 'checking' | 'succeeded' | 'refunded' | 'failed' | 'unconfirmed';

export interface PaymentConfirmationState {
  phase: PaymentConfirmationPhase;
  /** The order being confirmed. */
  reference: string;
  /** `succeeded` only: the ticket the screen hands on. */
  ticket: OrderTicket | null;
  /** `refunded` only: why the money came back, for the screen's copy. */
  refundReason: string | null;
}

export interface PaymentConfirmationDeps {
  /** `GET /orders/:reference`. Throws a `MovieApiError` on a refusal or a failure. */
  poll(reference: string): Promise<OrderStatusResponse>;
  /** Runs `callback` after `delayMs`; returns a function that cancels it. */
  schedule(callback: () => void, delayMs: number): () => void;
  /** Milliseconds since the epoch. */
  now(): number;
}

export interface PaymentConfirmationController {
  getState(): PaymentConfirmationState;
  subscribe(listener: () => void): () => void;
  /** Begin polling an order. Ignored unless idle/unconfirmed. */
  start(reference: string): void;
  /** From `unconfirmed`: give it another window of polling. */
  retry(): void;
  /** The screen is going away: stop asking. Reversible with `attach`. */
  detach(): void;
  attach(): void;
}

export const CONFIRM_POLL_INTERVAL_MS = 2_000;
export const CONFIRM_TIMEOUT_MS = 60_000;

const IDLE: PaymentConfirmationState = { phase: 'checking', reference: '', ticket: null, refundReason: null };

export function createPaymentConfirmationController(deps: PaymentConfirmationDeps): PaymentConfirmationController {
  let state: PaymentConfirmationState = IDLE;
  let attached = true;
  let deadline = 0;
  let cancelTimer: (() => void) | null = null;
  const listeners = new Set<() => void>();

  function setState(next: PaymentConfirmationState): void {
    state = next;
    for (const listener of [...listeners]) listener();
  }

  function clearTimer(): void {
    cancelTimer?.();
    cancelTimer = null;
  }

  function terminal(): boolean {
    return state.phase === 'succeeded' || state.phase === 'refunded' || state.phase === 'failed';
  }

  function schedulePoll(): void {
    clearTimer();
    cancelTimer = deps.schedule(poll, CONFIRM_POLL_INTERVAL_MS);
  }

  async function poll(): Promise<void> {
    cancelTimer = null;
    if (!attached || terminal()) return;
    if (deps.now() >= deadline) {
      setState({ ...state, phase: 'unconfirmed' });
      return;
    }

    let answer: OrderStatusResponse;
    try {
      answer = await deps.poll(state.reference);
    } catch {
      // Tolerated: a dropped packet or a blip just means "ask again shortly". The deadline still bounds it.
      if (!attached) return;
      schedulePoll();
      return;
    }
    if (!attached) return;

    if (answer.status === 'succeeded') {
      setState({ phase: 'succeeded', reference: state.reference, ticket: answer.ticket ?? null, refundReason: null });
    } else if (answer.status === 'refunded') {
      setState({ phase: 'refunded', reference: state.reference, ticket: null, refundReason: answer.refundReason ?? null });
    } else if (answer.status === 'failed') {
      setState({ phase: 'failed', reference: state.reference, ticket: null, refundReason: null });
    } else {
      schedulePoll(); // requires_payment (or an unknown status): keep asking.
    }
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    start(reference) {
      if (!attached) return;
      clearTimer();
      deadline = deps.now() + CONFIRM_TIMEOUT_MS;
      state = { ...IDLE, reference };
      void poll();
    },

    retry() {
      if (!attached || state.phase !== 'unconfirmed') return;
      clearTimer();
      deadline = deps.now() + CONFIRM_TIMEOUT_MS;
      setState({ ...state, phase: 'checking' });
      void poll();
    },

    detach() {
      if (!attached) return;
      attached = false;
      clearTimer();
      state = IDLE;
    },

    attach() {
      attached = true;
    },
  };
}
