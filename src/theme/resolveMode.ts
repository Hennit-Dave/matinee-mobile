import type { ThemeMode } from '../tokens/tokens';

/** The device's own appearance setting decides the mode; there is no account yet to hold a saved preference. */
export function resolveMode(deviceScheme: string | null | undefined): ThemeMode {
  return deviceScheme === 'dark' ? 'dark' : 'light';
}
