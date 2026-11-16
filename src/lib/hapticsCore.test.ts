import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHaptics, type HapticBackend } from './hapticsCore';

type Call = 'selection' | 'impactLight' | 'warning';

/** A backend that records what was asked of it. */
function recordingBackend(): { backend: HapticBackend; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    backend: {
      selection: () => {
        calls.push('selection');
      },
      impactLight: () => {
        calls.push('impactLight');
      },
      warning: () => {
        calls.push('warning');
      },
    },
  };
}

const EFFECTS: readonly Call[] = ['selection', 'impactLight', 'warning'];

test('each wrapper asks the backend for its own haptic, once, and nothing else', () => {
  for (const effect of EFFECTS) {
    const { backend, calls } = recordingBackend();
    createHaptics(backend)[effect]();
    assert.deepEqual(calls, [effect]);
  }
});

test('with no backend (the web, or no native module) every call quietly does nothing', () => {
  const haptics = createHaptics(null);
  for (const effect of EFFECTS) {
    assert.doesNotThrow(() => haptics[effect]());
    assert.equal(haptics[effect](), undefined);
  }
});

test('a backend that throws never reaches the caller', () => {
  const boom = () => {
    throw new Error('haptics exploded');
  };
  const haptics = createHaptics({ selection: boom, impactLight: boom, warning: boom });
  for (const effect of EFFECTS) assert.doesNotThrow(() => haptics[effect]());
});

test('a rejected promise (how expo-haptics reports a missing native module) is swallowed: no unhandled rejection', async () => {
  const unhandled: unknown[] = [];
  const listener = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', listener);
  try {
    const reject = () => Promise.reject(new Error('Haptics.selectionAsync is not available'));
    const haptics = createHaptics({ selection: reject, impactLight: reject, warning: reject });
    for (const effect of EFFECTS) haptics[effect]();
    // Give the runtime a few turns to report any rejection that nobody handled.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', listener);
  }
});

test('callers never get a promise back, so they cannot await it or forget to catch it', () => {
  const slow = () => new Promise<void>((resolve) => setTimeout(resolve, 1));
  const haptics = createHaptics({ selection: slow, impactLight: slow, warning: slow });
  for (const effect of EFFECTS) assert.equal(haptics[effect](), undefined);
});

test('a backend that returns nothing (a plain function) works too', () => {
  const { backend, calls } = recordingBackend();
  const haptics = createHaptics(backend);
  haptics.selection();
  haptics.warning();
  assert.deepEqual(calls, ['selection', 'warning']);
});

test('the backend keeps its own `this`', () => {
  const backend = {
    count: 0,
    selection() {
      this.count += 1;
    },
    impactLight() {},
    warning() {},
  };
  const haptics = createHaptics(backend);
  haptics.selection();
  haptics.selection();
  assert.equal(backend.count, 2);
});

test('one failing haptic does not stop the next from firing', () => {
  const { backend, calls } = recordingBackend();
  const haptics = createHaptics({
    ...backend,
    impactLight: () => {
      throw new Error('no');
    },
  });
  haptics.impactLight();
  haptics.warning();
  assert.deepEqual(calls, ['warning']);
});
