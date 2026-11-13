import { BlurView, type BlurTint } from 'expo-blur';
import type { ComponentRef, RefObject } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { primitives, type ThemeMode } from '../tokens/tokens';
import { Icon } from './Icon';
import { NAV_ITEMS, navBarBottomOffset, resolveNavMaterial, type NavItemKey } from './navBarLogic';
import { Text } from './Text';

export interface NavBarProps {
  active: NavItemKey;
  /** `true` draws the Solid material. Glass is the default (COMPONENTS.md section 7). */
  reduceTransparency?: boolean;
  onNavigate: (item: NavItemKey) => void;
  /**
   * Android only: the BlurTargetView that holds the screens behind the bar. Android's backdrop blur
   * can only read from a target; without one the bar is drawn solid. Ignored on iOS. The NavBar must be
   * a SIBLING of that target, never inside it: a BlurView that is part of the view it blurs makes the
   * renderer recurse until it overflows its stack (a native crash).
   */
  blurTarget?: RefObject<ComponentRef<typeof View> | null>;
}

/**
 * Blur strength. expo-blur's `intensity` is not the same unit as Figma's `blur/nav`: on Android the
 * blur radius is intensity / 4, so this gives the 12 px radius Figma's 24 means; iOS reads it as a
 * 1-100 strength. Tuned by eye against the Figma Gallery frames.
 */
const BLUR_INTENSITY = primitives['blur/nav'] * 2;

/**
 * The thinnest built-in tint per mode, so the blur is mostly clear and `material/nav` (the Figma
 * tint) does the colouring. Every expo-blur tint adds a translucent layer of its own; this is the
 * lightest one.
 */
const BLUR_TINT: Record<ThemeMode, BlurTint> = {
  light: 'systemUltraThinMaterialLight',
  dark: 'systemUltraThinMaterialDark',
};

export function NavBar({ active, reduceTransparency = false, onNavigate, blurTarget }: NavBarProps) {
  const { colors, mode, elevation } = useTheme();
  const insets = useSafeAreaInsets();

  const material = resolveNavMaterial({
    reduceTransparency,
    os: Platform.OS,
    osVersion: Platform.Version,
    hasBlurTarget: blurTarget != null,
  });

  const shadow = elevation['elevation/3'];

  return (
    // The wrapper spans the screen width but lets touches through everywhere except the pill.
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: navBarBottomOffset(insets.bottom) }]}>
      <View
        style={[
          styles.pill,
          {
            boxShadow: [
              { offsetX: shadow.offsetX, offsetY: shadow.offsetY, blurRadius: shadow.blur, spreadDistance: shadow.spread, color: shadow.color },
            ],
          },
        ]}
      >
        {/* Material: clipped to the pill so neither the blur nor its tint spills past the rounded edge. */}
        <View pointerEvents="none" style={styles.materialClip}>
          {material === 'glass' ? (
            <>
              <BlurView
                blurTarget={blurTarget}
                blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
                intensity={BLUR_INTENSITY}
                tint={BLUR_TINT[mode]}
                style={StyleSheet.absoluteFill}
              />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors['material/nav'] }]} />
            </>
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors['surface/overlay'] }]} />
          )}
        </View>

        {NAV_ITEMS.map((item) => {
          const selected = item.key === active;
          const contentColor = selected ? 'text/on-primary' : 'text/primary';
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => onNavigate(item.key)}
              style={({ pressed }) => [
                styles.item,
                {
                  // Active = filled pill (shape + fill, never colour alone). Inactive items are clear.
                  backgroundColor: selected
                    ? colors['primary/default']
                    : pressed
                      ? colors['secondary/pressed']
                      : undefined,
                },
              ]}
            >
              <Icon name={item.icon} size="lg" color={contentColor} />
              <Text variant="caption" color={contentColor} numberOfLines={1} maxFontSizeMultiplier={NAV_LABEL_MAX_FONT_SCALE}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}

        {/* The hairline is drawn over the material, not as a real border, so it does not eat into the
            pill's 4 of padding (Figma strokes sit inside the frame: items stay 48 tall). */}
        <View pointerEvents="none" style={[styles.hairline, { borderColor: colors['border/default'] }]} />
      </View>
    </View>
  );
}

/** Labels grow with the system font size up to this, so the 56 pill never has to grow far. */
const NAV_LABEL_MAX_FONT_SCALE = 1.3;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: primitives['space/4'],
  },
  pill: {
    minHeight: primitives['size/nav-height'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/1'],
    padding: primitives['space/1'],
    borderRadius: primitives['radius/full'],
  },
  materialClip: {
    ...StyleSheet.absoluteFill,
    borderRadius: primitives['radius/full'],
    overflow: 'hidden',
  },
  hairline: {
    ...StyleSheet.absoluteFill,
    borderRadius: primitives['radius/full'],
    borderWidth: primitives['border-width/default'],
  },
  item: {
    flex: 1,
    minHeight: primitives['size/touch-min'],
    minWidth: primitives['size/touch-min'],
    paddingHorizontal: primitives['space/3'],
    paddingVertical: primitives['space/1'],
    borderRadius: primitives['radius/full'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
