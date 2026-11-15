/**
 * Badge tones (COMPONENTS.md section 4, Figma `17:134`). Pure data, so the colour pairs can be
 * contrast-tested without React Native.
 */
export type BadgeTone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeToneSpec {
  /** Outline colour token. */
  outline: 'border/strong' | 'status/success' | 'status/warning' | 'status/error' | 'status/info';
  /** Label colour token. */
  label: 'text/secondary' | 'status/success' | 'status/warning' | 'status/error' | 'status/info';
}

export const BADGE_TONES: Record<BadgeTone, BadgeToneSpec> = {
  neutral: { outline: 'border/strong', label: 'text/secondary' },
  success: { outline: 'status/success', label: 'status/success' },
  warning: { outline: 'status/warning', label: 'status/warning' },
  error: { outline: 'status/error', label: 'status/error' },
  info: { outline: 'status/info', label: 'status/info' },
};
