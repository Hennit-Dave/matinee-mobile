import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { primitives } from '../../tokens/tokens';
import { useTheme } from '../../theme';

/** Placeholder only: no sign-in yet. Proves the Account route renders with tokens in both themes. */
export default function Account() {
  const { colors, text } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'] }]}>
      <Text style={[text['type/title'], { color: colors['text/primary'] }]}>Account</Text>
      <Text style={[text['type/body'], { color: colors['text/secondary'], marginTop: primitives['space/2'] }]}>
        Sign-in and TMDB attribution land here.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: primitives['space/6'] },
});
