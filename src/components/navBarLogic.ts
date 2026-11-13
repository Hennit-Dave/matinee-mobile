import { primitives } from '../tokens/tokens';
import type { IconName } from './Icon';

/**
 * The NavBar's decisions, kept free of React Native so they can be unit-tested with `node --test`
 * (there is no RN renderer in this repo, ADR 0005): which item is active, which material to draw,
 * and how much room the floating pill takes at the bottom of a screen.
 */

export type NavItemKey = 'home' | 'tickets' | 'account';

export interface NavItemSpec {
  key: NavItemKey;
  /** Where the item goes. Route groups like `(tabs)` never appear in a URL path. */
  href: '/' | '/tickets' | '/account';
  label: string;
  icon: IconName;
}

/** Three items only (COMPONENTS.md section 7). Order is left to right. */
export const NAV_ITEMS: readonly NavItemSpec[] = [
  { key: 'home', href: '/', label: 'Home', icon: 'home' },
  { key: 'tickets', href: '/tickets', label: 'Tickets', icon: 'ticket' },
  { key: 'account', href: '/account', label: 'Account', icon: 'user' },
];

/**
 * The active item for the current URL path (`usePathname()`), or null when the path is not one of the
 * three tabs (for example a pushed Search screen, where the bar is covered anyway).
 */
export function activeNavItem(pathname: string): NavItemKey | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return NAV_ITEMS.find((item) => item.href === path)?.key ?? null;
}

// ---- Material -------------------------------------------------------------------------------

export type NavMaterial = 'glass' | 'solid';

/**
 * Android's real backdrop blur uses RenderEffect, which exists from API 31. Below that, expo-blur's
 * blur is either unavailable or slow, so the bar is drawn solid (a designed state, not a failure).
 */
export const ANDROID_MIN_BLUR_SDK = 31;

/**
 * Switch for Android glass. ON: real Android blur, with the NavBar drawn beside a BlurTargetView (see
 * `src/app/(tabs)/_layout.tsx`). Dave verified it smooth on a real Android 16 (API 36) phone; the
 * glass and Solid scroll recordings are attached to PR #16 (see `docs/evidence/glass-navbar/README.md`). An earlier measurement on an API 37 emulator showed glass markedly worse than solid
 * (about 92% janky frames in two of three warm runs, against about 69%), but that emulator was already
 * janky with Solid and is not representative of real hardware, so the result did not carry over.
 * Set this to false to draw the solid material on Android everywhere without touching anything else.
 */
export const ANDROID_GLASS_ENABLED = true;

export interface NavMaterialInput {
  /** iOS "Reduce Transparency". Android has no such system setting, so this is always false there. */
  reduceTransparency: boolean;
  os: string;
  /** `Platform.Version`: an API level number on Android, a version string on iOS. */
  osVersion: string | number;
  /** Android only: a BlurTargetView exists behind the bar for the blur to read from. */
  hasBlurTarget: boolean;
  /** Defaults to the app-wide switch above; tests pass it to cover both settings. */
  androidGlassEnabled?: boolean;
}

/** Glass by default; solid when the user asks for less transparency or blur cannot be drawn. */
export function resolveNavMaterial({
  reduceTransparency,
  os,
  osVersion,
  hasBlurTarget,
  androidGlassEnabled = ANDROID_GLASS_ENABLED,
}: NavMaterialInput): NavMaterial {
  if (reduceTransparency) return 'solid';
  if (os === 'ios') return 'glass';
  if (os === 'android') {
    // `Number(...) >= n` is false for NaN, so an unreadable version falls back to solid.
    return androidGlassEnabled && hasBlurTarget && Number(osVersion) >= ANDROID_MIN_BLUR_SDK ? 'glass' : 'solid';
  }
  return 'solid';
}

// ---- Space the pill takes ---------------------------------------------------------------------

/** Gap between the pill and the gesture area / bottom edge (Figma: "sits 16 above the gesture area"). */
export const NAV_BAR_BOTTOM_GAP = primitives['space/4'];

/** Distance from the bottom of the screen to the bottom edge of the pill. */
export function navBarBottomOffset(insetBottom: number): number {
  return insetBottom + NAV_BAR_BOTTOM_GAP;
}

/**
 * Bottom padding a scrolling screen needs so its last content stops above the pill: the safe-area
 * inset, the gap, the pill, and one more gap of breathing room. The extra gap also absorbs the pill
 * growing a little when the user's text size is large.
 */
export function navBarClearance(insetBottom: number): number {
  return navBarBottomOffset(insetBottom) + primitives['size/nav-height'] + NAV_BAR_BOTTOM_GAP;
}
