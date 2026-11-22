import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TmdbAttribution, useNavBarClearance } from '../../components';
import { primitives } from '../../tokens/tokens';
import { useTheme } from '../../theme';

/** Account: the Credits / TMDB attribution block (Req 1, RULES D1.1). No sign-in yet. */
export default function Account() {
  const { colors } = useTheme();
  // The clearance already includes the bottom safe-area inset, so only the top edge is applied here.
  const navClearance = useNavBarClearance();
  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors['surface/default'], paddingBottom: navClearance }]}
      edges={['top']}
    >
      <Text variant="title" color="text/primary" accessibilityRole="header">
        Account
      </Text>
      <View style={styles.attribution}>
        <TmdbAttribution />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: primitives['space/6'] },
  attribution: {
    marginTop: primitives['space/6'],
  },
});
