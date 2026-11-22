import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListRow, Text, useNavBarClearance } from '../../components';
import { primitives } from '../../tokens/tokens';
import { useTheme } from '../../theme';

/** Account: a hub linking to About Matinee. No sign-in, no profile header. */
export default function Account() {
  const router = useRouter();
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
      <View style={[styles.group, { backgroundColor: colors['surface/raised'], borderColor: colors['border/default'] }]}>
        <ListRow label="About Matinee" onPress={() => router.push('/about' as Href)} showDivider={false} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: primitives['space/6'] },
  group: {
    marginTop: primitives['space/6'],
    borderRadius: primitives['radius/lg'],
    borderWidth: primitives['border-width/default'],
    overflow: 'hidden',
  },
});
