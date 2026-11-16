import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { countdownTone, formatCountdown, spokenCountdown } from './countdownLogic';
import { Text } from './Text';

export interface CountdownProps {
  /** Seconds left on the seat hold. The component draws them; it never counts down on its own. */
  secondsRemaining: number;
}

/**
 * The seat-hold countdown (Figma `Countdown`, 37:819). Calm: plain secondary text until 2:00. Urgent:
 * a filled urgent pill with heavier type for the last two minutes, the only place orange appears.
 * The time uses tabular figures so the pill does not jitter as the digits change.
 *
 * Presentational only. There is no live hold yet (the traffic slice owns it), so no screen mounts a
 * running countdown; the gallery shows both states.
 */
export function Countdown({ secondsRemaining }: CountdownProps) {
  const { colors } = useTheme();
  const tone = countdownTone(secondsRemaining);
  const time = formatCountdown(secondsRemaining);

  if (tone === 'urgent') {
    return (
      <View
        accessible
        accessibilityRole="timer"
        accessibilityLabel={spokenCountdown(secondsRemaining)}
        style={[styles.pill, { backgroundColor: colors['urgent/default'] }]}
      >
        <Text variant="label-lg" color="text/on-urgent" tabularNums>
          {time}
        </Text>
        <Text variant="label" color="text/on-urgent">
          left
        </Text>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={spokenCountdown(secondsRemaining)}
      style={styles.pill}
    >
      <Text variant="label" color="text/secondary" tabularNums>
        {time}
      </Text>
      <Text variant="label" color="text/secondary">
        left
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: primitives['size/chip-height'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: primitives['space/1'],
    paddingHorizontal: primitives['space/3'],
    borderRadius: primitives['radius/full'],
  },
});
