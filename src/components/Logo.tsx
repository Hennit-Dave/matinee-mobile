import { SvgXml } from 'react-native-svg';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { LOGO_COMPACT_SVG, LOGO_HERO_SVG, LOGO_MARK_SVG } from './logoAssets';

/**
 * The Matinee logo (Figma Brand page, file 76VKO0l9gGt5YMNYtH8yvM — Logo/Mark and Logo/Lockup).
 * Drawn from the exported SVG vectors with react-native-svg; the fill is applied at render time from tokens so the
 * one artwork recolours per surface: `neutral/0` (white) over the Home hero scrim, `text/primary` on light/dark
 * surfaces. No new tokens.
 */

export type LogoVariant = 'lockup-horizontal' | 'lockup-compact' | 'mark';
export type LogoColor = 'neutral/0' | 'text/primary';

const SVG_BY_VARIANT: Record<LogoVariant, string> = {
  'lockup-horizontal': LOGO_HERO_SVG,
  'lockup-compact': LOGO_COMPACT_SVG,
  mark: LOGO_MARK_SVG,
};

// The exported SVG canvas sizes; `height` scales and width follows the aspect ratio.
const NATURAL: Record<LogoVariant, { width: number; height: number }> = {
  'lockup-horizontal': { width: 164, height: 40 },
  'lockup-compact': { width: 115, height: 32 },
  mark: { width: 40, height: 40 },
};

export interface LogoProps {
  variant?: LogoVariant;
  /** `neutral/0` is always white; `text/primary` follows the theme. */
  color?: LogoColor;
  /** Logo height in dp; the width scales to keep the exported aspect ratio. Defaults to the SVG's natural size. */
  height?: number;
  accessibilityLabel?: string;
}

export function Logo({ variant = 'lockup-horizontal', color = 'text/primary', height, accessibilityLabel = 'Matinee' }: LogoProps) {
  const { colors } = useTheme();
  const fill = color === 'neutral/0' ? primitives['neutral/0'] : colors['text/primary'];
  // The exported SVGs bake their fill in (white on the hero, #131314 on the compact). Replace it with the token.
  const xml = SVG_BY_VARIANT[variant]
    .replaceAll('fill="white"', `fill="${fill}"`)
    .replaceAll('fill="#131314"', `fill="${fill}"`);
  const h = height ?? NATURAL[variant].height;
  const w = Math.round((NATURAL[variant].width / NATURAL[variant].height) * h);
  return <SvgXml xml={xml} width={w} height={h} accessibilityLabel={accessibilityLabel} accessible />;
}
