import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { primitives } from '../../tokens/tokens';
import { useTheme } from '../../theme';

/** Placeholder only: no movie data yet (D1). Proves the Home route renders with tokens in both themes. */
export default function Home() {
  const { colors, text } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'] }]}>
      <Text style={[text['type/display'], { color: colors['text/primary'] }]}>Matinee</Text>
      <Text style={[text['type/body'], { color: colors['text/secondary'], marginTop: primitives['space/2'] }]}>
        Home — movies and showtimes land here.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: primitives['space/6'] },
});
