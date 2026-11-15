import { useEffect, useState } from 'react';
import { Appearance, StyleSheet, View } from 'react-native';
import { Chip, Text } from '../components';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';

type ThemeChoice = 'system' | 'light' | 'dark';

const CHOICES: readonly { key: ThemeChoice; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

/**
 * Flips the whole app between light and dark so every component can be seen in both. It uses the
 * platform's own override (`Appearance.setColorScheme`), so no component or theme code changes,
 * and it hands control back to the device setting ('auto') when the gallery closes.
 */
export function ThemeToggle() {
  const { mode } = useTheme();
  const [choice, setChoice] = useState<ThemeChoice>('system');

  useEffect(() => {
    Appearance.setColorScheme(choice === 'system' ? 'auto' : choice);
  }, [choice]);

  useEffect(
    () => () => {
      Appearance.setColorScheme('auto');
    },
    []
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {CHOICES.map(({ key, label }) => (
          <Chip
            key={key}
            label={label}
            selected={choice === key}
            accessibilityLabel={`Theme: ${label}`}
            onPress={() => setChoice(key)}
          />
        ))}
      </View>
      <Text variant="caption" color="text/secondary" accessibilityLiveRegion="polite">
        {`Showing ${mode} mode`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: primitives['space/1'],
  },
  row: {
    flexDirection: 'row',
    gap: primitives['space/2'],
  },
});
