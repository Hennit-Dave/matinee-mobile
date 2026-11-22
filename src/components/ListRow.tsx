import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * A settings row (COMPONENTS.md section 4, Figma ListRow `66:3997`): a full-width tappable row with a label and a
 * chevron, grouped inside a bordered `surface/raised` container (a layout wrapper, not this component). The
 * bottom divider is drawn by this row and hidden on the last row of a group via `showDivider`.
 */

export interface ListRowProps {
  label: string;
  onPress: () => void;
  /** Content before the label (an Icon, a Badge, …). */
  leading?: ReactNode;
  /** Content after the label. Defaults to the chevron. */
  trailing?: ReactNode;
  /** The bottom hairline. The last row in a group passes `false`. */
  showDivider?: boolean;
}

export function ListRow({ label, onPress, leading, trailing, showDivider = true }: ListRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        showDivider ? { borderBottomColor: colors['border/default'], borderBottomWidth: primitives['border-width/default'] } : null,
        pressed ? { backgroundColor: colors['secondary/pressed'] } : null,
      ]}
    >
      {leading}
      <Text variant="label-lg" color="text/primary" style={styles.label}>
        {label}
      </Text>
      {trailing ?? <Icon name="chevron-right" size="lg" color="text/secondary" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/3'],
    // 56dp: the `size/nav-height` token, the one 56 value in the scale — a row is a comfortable touch target.
    minHeight: primitives['size/nav-height'],
    paddingHorizontal: primitives['space/4'],
    paddingVertical: primitives['space/2'],
  },
  label: {
    flex: 1,
  },
});
