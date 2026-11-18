import * as ExpoHaptics from 'expo-haptics';
import { Platform } from 'react-native';
import { createHaptics, type HapticBackend } from './hapticsCore';

/**
 * The one place the app produces haptic feedback. Screens call these four and never `expo-haptics`
 * directly:
 *
 *     import * as haptics from '../lib/haptics';
 *     haptics.selection();
 *
 * - `selection()`: a light tick when a selection changes (a seat picked or dropped).
 * - `impactLight()`: a light tap for a small control being pressed.
 * - `warning()`: a buzz for an action that was refused (the seat cap).
 * - `success()`: a pulse for a moment the person was waiting for (their turn in the waiting room).
 *
 * Each is fire-and-forget and safe: it does nothing on the web, does nothing where the native module is
 * missing (an old dev build), and swallows any error, so it can never crash a render, a handler or a
 * test. Use it for deliberate moments only: never on scroll, pan, pinch or render.
 *
 * Android needs no setup (the library declares the VIBRATE permission itself).
 */
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

const expoBackend: HapticBackend | null = isNative
  ? {
      selection: () => ExpoHaptics.selectionAsync(),
      impactLight: () => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light),
      warning: () => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning),
      success: () => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success),
    }
  : null;

const haptics = createHaptics(expoBackend);

export const selection = haptics.selection;
export const impactLight = haptics.impactLight;
export const warning = haptics.warning;
export const success = haptics.success;
