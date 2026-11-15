import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  note?: string;
  tabularNums?: boolean;
  accessibilityLabel?: string;
  onPress?: () => void;
}

/**
 * Compact pill selector for showtime dates and time slots.
 * Visually 32px tall inside a >= 48px touch target.
 */
export function Chip({
  label,
  selected = false,
  disabled = false,
  note,
  tabularNums = false,
  accessibilityLabel,
  onPress,
}: ChipProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (note ? `${label}, ${note}` : label)}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.touchTarget}
    >
      {({ pressed }) => {
        const backgroundColor = selected
          ? pressed
            ? colors['primary/pressed']
            : colors['primary/default']
          : pressed && !disabled
            ? colors['secondary/pressed']
            : 'transparent';

        const borderColor = selected
          ? undefined
          : disabled
            ? colors['border/default']
            : colors['border/strong'];

        const labelColor = selected
          ? ('text/on-primary' as const)
          : disabled
            ? ('text/disabled' as const)
            : ('text/primary' as const);

        return (
          <View
            style={[
              styles.pill,
              {
                backgroundColor,
                borderColor,
                borderWidth: borderColor ? primitives['border-width/default'] : 0,
              },
            ]}
          >
            <Text
              variant="label"
              color={labelColor}
              tabularNums={tabularNums}
              style={disabled ? styles.strikethrough : undefined}
            >
              {label}
            </Text>
            {note ? (
              <Text variant="caption" color="text/secondary">
                {note}
              </Text>
            ) : null}
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    paddingVertical: primitives['space/2'],
    justifyContent: 'center',
  },
  pill: {
    minHeight: primitives['size/chip-height'],
    minWidth: primitives['size/touch-min'],
    borderRadius: primitives['radius/full'],
    paddingHorizontal: primitives['space/4'],
    paddingVertical: primitives['space/1'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: primitives['space/2'],
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
});
