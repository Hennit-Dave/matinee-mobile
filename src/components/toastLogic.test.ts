import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { semantic, type ThemeMode } from '../tokens/tokens';
import { MIN_GRAPHIC_CONTRAST, MIN_TEXT_CONTRAST, contrastRatio } from '../tokens/contrast';
import {
  TOAST_DURATION_MS,
  TOAST_MIN_DURATION_MS,
  TOAST_TONES,
  resolveToastDuration,
  scheduleToastDismiss,
  toSpokenToast,
  type ToastTone,
} from './toastLogic';

const MODES: ThemeMode[] = ['light', 'dark'];
const TONES = Object.keys(TOAST_TONES) as ToastTone[];

test('each tone has its own icon shape, so tone never relies on colour alone', () => {
  const icons = TONES.map((tone) => TOAST_TONES[tone].icon);
  assert.equal(new Set(icons).size, TONES.length);
  assert.deepEqual(icons.sort(), ['error', 'info', 'success']);
});

for (const mode of MODES) {
  test(`${mode} toast message text/primary on surface/overlay meets WCAG AA text contrast`, () => {
    const ratio = contrastRatio(semantic[mode]['text/primary'], semantic[mode]['surface/overlay']);
    assert.ok(ratio >= MIN_TEXT_CONTRAST, `${ratio.toFixed(2)}:1`);
  });

  for (const tone of TONES) {
    test(`${mode} toast icon (${tone}) on surface/overlay meets the 3:1 graphics contrast`, () => {
      const ratio = contrastRatio(semantic[mode][TOAST_TONES[tone].color], semantic[mode]['surface/overlay']);
      assert.ok(
        ratio >= MIN_GRAPHIC_CONTRAST,
        `${TOAST_TONES[tone].color} on surface/overlay (${mode}) is ${ratio.toFixed(2)}:1, below ${MIN_GRAPHIC_CONTRAST}:1`
      );
    });
  }
}

test('resolveToastDuration: short for a plain message, long for errors and toasts with an action', () => {
  assert.equal(resolveToastDuration({ tone: 'info', hasAction: false }), TOAST_DURATION_MS.short);
  assert.equal(resolveToastDuration({ tone: 'success', hasAction: false }), TOAST_DURATION_MS.short);
  assert.equal(resolveToastDuration({ tone: 'error', hasAction: false }), TOAST_DURATION_MS.long);
  assert.equal(resolveToastDuration({ tone: 'info', hasAction: true }), TOAST_DURATION_MS.long);
  assert.ok(TOAST_DURATION_MS.long > TOAST_DURATION_MS.short);
});

test('resolveToastDuration: an explicit duration is used but never shorter than the minimum', () => {
  assert.equal(resolveToastDuration({ tone: 'info', hasAction: false, duration: 9_000 }), 9_000);
  assert.equal(resolveToastDuration({ tone: 'info', hasAction: false, duration: 100 }), TOAST_MIN_DURATION_MS);
  assert.equal(resolveToastDuration({ tone: 'error', hasAction: true, duration: 2_500.9 }), 2_500);
  assert.equal(
    resolveToastDuration({ tone: 'info', hasAction: false, duration: Number.NaN }),
    TOAST_DURATION_MS.short,
    'a bad duration falls back to the default'
  );
});

test('toSpokenToast says the tone first, because screen readers do not see the icon shape', () => {
  assert.equal(toSpokenToast('error', 'Payment failed.'), 'Error. Payment failed.');
  assert.equal(toSpokenToast('info', 'Seats held for 10 minutes.'), 'Info. Seats held for 10 minutes.');
  assert.equal(toSpokenToast('success', 'Booking confirmed.'), 'Success. Booking confirmed.');
});

test('scheduleToastDismiss dismisses after the duration, once', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let dismissed = 0;
    scheduleToastDismiss(4_000, () => {
      dismissed += 1;
    });
    mock.timers.tick(3_999);
    assert.equal(dismissed, 0, 'still showing just before the duration');
    mock.timers.tick(1);
    assert.equal(dismissed, 1);
    mock.timers.tick(10_000);
    assert.equal(dismissed, 1, 'it fires once');
  } finally {
    mock.timers.reset();
  }
});

test('scheduleToastDismiss cancel stops the dismissal (a new toast replaces the old one)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let dismissed = 0;
    const cancel = scheduleToastDismiss(4_000, () => {
      dismissed += 1;
    });
    mock.timers.tick(2_000);
    cancel();
    mock.timers.tick(10_000);
    assert.equal(dismissed, 0);
  } finally {
    mock.timers.reset();
  }
});
