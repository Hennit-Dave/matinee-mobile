/**
 * The safety behaviour of the app's haptics, free of React Native and `expo-haptics` so it can be
 * unit-tested with `node --test` (there is no RN renderer in this repo, ADR 0005). The binding to
 * `expo-haptics` is in `haptics.ts`; screens import that, never this file.
 */

/** What a haptic backend has to offer. `expo-haptics` is the real one; tests pass fakes. */
export interface HapticBackend {
  /** A light tick for "a selection changed". */
  selection(): Promise<void> | void;
  /** A light tap, like a small control being pressed. */
  impactLight(): Promise<void> | void;
  /** A "that didn't work" buzz, for a refused action. */
  warning(): Promise<void> | void;
  /** A "that worked" pulse, for a moment the person was waiting for (a turn in the waiting room). */
  success(): Promise<void> | void;
}

/**
 * The app's haptics. Every call is fire-and-forget: it returns nothing (never a promise) and never
 * throws, so calling one can never crash a render, an event handler, or a test.
 */
export interface Haptics {
  selection(): void;
  impactLight(): void;
  warning(): void;
  success(): void;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

const ignore = () => {};

/**
 * Wraps a backend so that an unsupported device (`null`), a thrown error, and a rejected promise
 * (which is how `expo-haptics` reports a missing native module) all end the same way: no feedback,
 * no crash, no unhandled rejection. Missing haptics is always better than a broken screen.
 */
export function createHaptics(backend: HapticBackend | null): Haptics {
  const run =
    (effect: keyof HapticBackend) =>
    (): void => {
      if (!backend) return;
      try {
        const result = backend[effect]();
        if (isThenable(result)) result.then(undefined, ignore);
      } catch {
        // swallowed on purpose
      }
    };

  return {
    selection: run('selection'),
    impactLight: run('impactLight'),
    warning: run('warning'),
    success: run('success'),
  };
}
