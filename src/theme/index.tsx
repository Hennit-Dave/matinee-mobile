import { useColorScheme } from 'react-native';
import { elevation, textStyles, type ThemeMode } from '../tokens/tokens';
import { colorsFor, type ColorTokens } from './colors';
import { resolveMode } from './resolveMode';

export { colorsFor, type ColorTokens } from './colors';
export { resolveMode } from './resolveMode';

interface Theme {
  mode: ThemeMode;
  colors: ColorTokens;
  text: typeof textStyles;
  elevation: (typeof elevation)[ThemeMode];
}

/** The app's one theme source today: the device's own light/dark setting. */
export function useTheme(): Theme {
  const deviceScheme = useColorScheme();
  const mode = resolveMode(deviceScheme);
  return {
    mode,
    colors: colorsFor(mode),
    text: textStyles,
    elevation: elevation[mode],
  };
}
