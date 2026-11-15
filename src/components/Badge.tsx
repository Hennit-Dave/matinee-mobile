import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { BADGE_TONES, type BadgeTone } from './badgeLogic';
import { Text } from './Text';

export type { BadgeTone } from './badgeLogic';

export interface BadgeProps {
  tone?: BadgeTone;
  /** A short status word ("Confirming", "Cancelled"). The word carries the meaning, the tone only reinforces it. */
  label: string;
  accessibilityLabel?: string;
}

/** An outlined status label. Not interactive. */
export function Badge({ tone = 'neutral', label, accessibilityLabel }: BadgeProps) {
  const { colors } = useTheme();
  const spec = BADGE_TONES[tone];

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.badge, { borderColor: colors[spec.outline] }]}
    >
      <Text variant="caption" color={spec.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: primitives['space/2'],
    paddingVertical: primitives['space/1'],
    borderRadius: primitives['radius/sm'],
    borderWidth: primitives['border-width/default'],
  },
});
