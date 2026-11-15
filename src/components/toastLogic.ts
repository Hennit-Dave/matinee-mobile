/**
 * Toast decisions (COMPONENTS.md section 6, Figma `18:94`): which icon and colour each tone uses,
 * and how long a toast stays. Pure, so it is unit-tested without React Native.
 */
export type ToastTone = 'info' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastToneSpec {
  /** Icon shape. Each tone has its own, so tone never relies on colour alone. */
  icon: 'info' | 'success' | 'error';
  color: 'status/info' | 'status/success' | 'status/error';
  /** Spoken before the message, because screen readers do not see the icon shape. */
  spokenPrefix: string;
}

export const TOAST_TONES: Record<ToastTone, ToastToneSpec> = {
  info: { icon: 'info', color: 'status/info', spokenPrefix: 'Info' },
  success: { icon: 'success', color: 'status/success', spokenPrefix: 'Success' },
  error: { icon: 'error', color: 'status/error', spokenPrefix: 'Error' },
};

export const TOAST_DURATION_MS = {
  /** A plain message. */
  short: 4_000,
  /** Errors, and toasts with an action: the person needs time to read and decide. */
  long: 6_000,
} as const;

/** An explicit `duration` is never shorter than this. */
export const TOAST_MIN_DURATION_MS = 2_000;

export function resolveToastDuration(params: {
  tone: ToastTone;
  hasAction: boolean;
  duration?: number;
}): number {
  if (params.duration !== undefined && Number.isFinite(params.duration)) {
    return Math.max(TOAST_MIN_DURATION_MS, Math.trunc(params.duration));
  }
  return params.tone === 'error' || params.hasAction ? TOAST_DURATION_MS.long : TOAST_DURATION_MS.short;
}

export function toSpokenToast(tone: ToastTone, message: string): string {
  return `${TOAST_TONES[tone].spokenPrefix}. ${message}`;
}

/** Calls `onDismiss` after `durationMs`. The returned function cancels it. */
export function scheduleToastDismiss(durationMs: number, onDismiss: () => void): () => void {
  const handle = setTimeout(onDismiss, durationMs);
  return () => clearTimeout(handle);
}
