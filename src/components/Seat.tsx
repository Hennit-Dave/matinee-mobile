import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { SEAT_SIZE, type SeatVisualState } from './seatMapLogic';

export type SeatState = SeatVisualState;

export interface SeatProps {
  state: SeatState;
  /** Outer size. The map draws seats at 36 and scales the whole room; the legend draws them at 24. */
  size?: number;
  /**
   * Make the seat a screen-reader element. Only the map passes these: a legend swatch is decorative
   * (its label sits beside it), so it passes none and stays out of the accessibility tree.
   */
  seatId?: string;
  accessibilityLabel?: string;
  /** Run when a screen reader activates the seat. Touch taps are handled by the map as a whole. */
  onActivate?: (seatId: string) => void;
}

// The marks are the Figma `SeatMap/Seat` (19:58) artwork, drawn in the seat's own 36 x 36 space and
// scaled with the seat. Stroke is the strong border width, as in the design.
const MARK_BOX = `0 0 ${SEAT_SIZE} ${SEAT_SIZE}`;
const STROKE = primitives['border-width/strong'];
const TICK = 'M10 18.5L15.5 24L26 12.5';
const CROSS = ['M12 12L24 24', 'M24 12L12 24'] as const;
const HATCH = [
  'M-6 12L12 -6',
  'M-6 24L24 -6',
  'M-6 36L36 -6',
  'M0 42L42 0',
  'M12 42L42 12',
  'M24 42L42 24',
] as const;
// The wheelchair glyph, placed as in the design (its own box, offset inside the seat).
const GLYPH_OFFSET = 'translate(8.914 8)';
const GLYPH = [
  'M6.08692 3C6.08692 3.53043 6.29764 4.03914 6.67271 4.41421C7.04778 4.78929 7.55649 5 8.08692 5C8.61736 5 9.12606 4.78929 9.50114 4.41421C9.87621 4.03914 10.0869 3.53043 10.0869 3C10.0869 2.46957 9.87621 1.96086 9.50114 1.58579C9.12606 1.21071 8.61736 1 8.08692 1C7.55649 1 7.04778 1.21071 6.67271 1.58579C6.29764 1.96086 6.08692 2.46957 6.08692 3Z',
  'M8.08692 5V13H12.0869L16.0869 18',
  'M8.08692 9H13.0869',
  'M4.08692 9.5C3.37042 9.79672 2.73276 10.2561 2.22435 10.8417C1.71594 11.4273 1.35072 12.1231 1.15757 12.8742C0.964412 13.6253 0.948617 14.411 1.11143 15.1692C1.27424 15.9275 1.61119 16.6374 2.09566 17.243C2.58012 17.8486 3.1988 18.3332 3.9028 18.6585C4.60681 18.9837 5.37682 19.1408 6.15198 19.1172C6.92714 19.0937 7.68619 18.8901 8.36912 18.5226C9.05206 18.1552 9.64015 17.6339 10.0869 17',
] as const;

function Mark({ size, offset, children }: { size: number; offset: number; children: ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={MARK_BOX}
      style={[styles.mark, { top: -offset, left: -offset }]}
      pointerEvents="none"
    >
      {children}
    </Svg>
  );
}

/** The tick pops in when a seat is picked (Reanimated), unless the user asked for less motion. */
function SelectedMark({ size, offset, color }: { size: number; offset: number; color: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <Animated.View
      pointerEvents="none"
      style={styles.markLayer}
      entering={reducedMotion ? undefined : ZoomIn.duration(primitives['duration/fast'])}
    >
      <Mark size={size} offset={offset}>
        <Path d={TICK} stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Mark>
    </Animated.View>
  );
}

/**
 * One seat. Shape carries the state and colour only reinforces it: an outline (available), a filled
 * square with a tick (selected), hatching (held by someone else), a cross (sold), a circle with the
 * wheelchair glyph (wheelchair space), a filled circle with a tick (wheelchair space, picked).
 *
 * Wrapped in `React.memo` and given only primitive props, so picking one seat re-renders that seat and
 * not the other 319 (ADR 0014).
 */
function SeatView({ state, size = SEAT_SIZE, seatId, accessibilityLabel, onActivate }: SeatProps) {
  const { colors } = useTheme();
  const accessible = accessibilityLabel !== undefined;

  let shape: ViewStyle;
  switch (state) {
    case 'selected':
      shape = { backgroundColor: colors['seat/selected'], borderRadius: primitives['radius/sm'] };
      break;
    case 'held':
      shape = { backgroundColor: colors['seat/held'], borderRadius: primitives['radius/sm'], overflow: 'hidden' };
      break;
    case 'sold':
      shape = { backgroundColor: colors['seat/sold'], borderRadius: primitives['radius/sm'] };
      break;
    case 'accessible':
      shape = {
        borderWidth: primitives['border-width/strong'],
        borderColor: colors['seat/accessible'],
        borderRadius: primitives['radius/full'],
      };
      break;
    case 'accessible-selected':
      shape = { backgroundColor: colors['seat/selected'], borderRadius: primitives['radius/full'] };
      break;
    default:
      shape = {
        borderWidth: primitives['border-width/strong'],
        borderColor: colors['seat/available'],
        borderRadius: primitives['radius/sm'],
      };
  }

  // A bordered seat draws its mark over the border box too, as Figma does (the mark is inset by -2).
  const bordered = state === 'available' || state === 'accessible';
  const markOffset = bordered ? primitives['border-width/strong'] : 0;

  return (
    <View
      accessible={accessible}
      accessibilityRole={accessible ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessible ? { selected: state === 'selected' || state === 'accessible-selected' } : undefined}
      accessibilityActions={accessible ? ACTIVATE_ACTION : undefined}
      onAccessibilityAction={accessible ? () => seatId !== undefined && onActivate?.(seatId) : undefined}
      onAccessibilityTap={accessible ? () => seatId !== undefined && onActivate?.(seatId) : undefined}
      style={[{ width: size, height: size }, shape]}
    >
      {state === 'selected' || state === 'accessible-selected' ? (
        <SelectedMark size={size} offset={markOffset} color={colors['seat/selected-mark']} />
      ) : null}

      {state === 'sold' ? (
        <Mark size={size} offset={markOffset}>
          {CROSS.map((d) => (
            <Path key={d} d={d} stroke={colors['seat/sold-mark']} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
          ))}
        </Mark>
      ) : null}

      {state === 'held' ? (
        <Mark size={size} offset={markOffset}>
          {HATCH.map((d) => (
            <Path key={d} d={d} stroke={colors['surface/default']} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
          ))}
        </Mark>
      ) : null}

      {state === 'accessible' ? (
        <Mark size={size} offset={markOffset}>
          <G transform={GLYPH_OFFSET}>
            {GLYPH.map((d) => (
              <Path
                key={d}
                d={d}
                stroke={colors['seat/accessible']}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </G>
        </Mark>
      ) : null}
    </View>
  );
}

const ACTIVATE_ACTION = [{ name: 'activate' }];

export const Seat = memo(SeatView);

const styles = StyleSheet.create({
  mark: {
    position: 'absolute',
  },
  markLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
