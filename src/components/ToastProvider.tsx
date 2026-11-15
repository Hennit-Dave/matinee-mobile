import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { primitives } from '../tokens/tokens';
import { navBarClearance } from './navBarLogic';
import { Toast } from './Toast';
import {
  resolveToastDuration,
  scheduleToastDismiss,
  toSpokenToast,
  type ToastAction,
  type ToastTone,
} from './toastLogic';

export interface ShowToastOptions {
  message: string;
  /** Default `info`. */
  tone?: ToastTone;
  /** An optional text action. Pressing it runs `onPress` and dismisses the toast. */
  action?: ToastAction;
  /** Milliseconds. Defaults by tone and action (see toastLogic); never below 2 s. */
  duration?: number;
  /**
   * Distance from the bottom of the screen to the bottom of the toast. A toast must never cover
   * the main button, so a screen with its own footer passes that footer's height. Defaults to just
   * above the floating NavBar.
   */
  bottomOffset?: number;
}

interface ToastApi {
  /** Shows a toast. A new toast replaces the one on screen and restarts the timer. */
  show: (options: ShowToastOptions) => void;
  dismiss: () => void;
}

interface ActiveToast extends ShowToastOptions {
  id: number;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Hosts one toast at a time above everything else and auto-dismisses it. Mount it once, inside
 * the SafeAreaProvider; call `useToast()` anywhere below it. Self-contained: no data model.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const reducedMotion = Boolean(useReducedMotion());
  const [active, setActive] = useState<ActiveToast | null>(null);
  // Kept after dismissal so the toast does not jump while it fades out.
  const [bottomOffset, setBottomOffset] = useState<number | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback(() => setActive(null), []);

  const show = useCallback((options: ShowToastOptions) => {
    nextId.current += 1;
    setBottomOffset(options.bottomOffset ?? null);
    setActive({ ...options, id: nextId.current });
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const tone = active.tone ?? 'info';
    // Android reads the live region below; iOS needs an explicit announcement.
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(toSpokenToast(tone, active.message));
    }
    return scheduleToastDismiss(
      resolveToastDuration({ tone, hasAction: Boolean(active.action), duration: active.duration }),
      dismiss
    );
  }, [active, dismiss]);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  const toastAction: ToastAction | undefined = active?.action
    ? {
        label: active.action.label,
        onPress: () => {
          active.action?.onPress();
          dismiss();
        },
      }
    : undefined;

  return (
    <ToastContext.Provider value={api}>
      <View style={styles.fill}>
        {children}
        <View
          pointerEvents="box-none"
          accessibilityLiveRegion="polite"
          style={[styles.host, { bottom: bottomOffset ?? navBarClearance(insets.bottom) }]}
        >
          {active ? (
            <Animated.View
              key={active.id}
              entering={reducedMotion ? undefined : FadeInDown.duration(primitives['duration/base'])}
              exiting={reducedMotion ? undefined : FadeOutDown.duration(primitives['duration/fast'])}
            >
              <Toast tone={active.tone} message={active.message} action={toastAction} />
            </Animated.View>
          ) : null}
        </View>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>.');
  return api;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: primitives['space/4'],
  },
});
