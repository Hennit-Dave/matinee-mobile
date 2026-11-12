import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { primitives } from '../../tokens/tokens';
import { useTheme } from '../../theme';

/** Placeholder only: no bookings yet (D4). Proves the Tickets route renders with tokens in both themes. */
export default function Tickets() {
  const { colors, text } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'] }]}>
      <Text style={[text['type/title'], { color: colors['text/primary'] }]}>Tickets</Text>
      <Text style={[text['type/body'], { color: colors['text/secondary'], marginTop: primitives['space/2'] }]}>
        Booked tickets and QR codes land here.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: primitives['space/6'] },
});
