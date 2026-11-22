import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, ListRow, Logo, Text, TmdbAttribution } from '../components';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';

const GITHUB_REPO_URL = 'https://github.com/Hennit-Dave/matinee-mobile';
const SUPPORT_URL = 'https://github.com/Hennit-Dave/matinee-mobile/issues';

/**
 * About Matinee (Figma 67:15734 light / 67:15692 dark): the stacked lockup, the version line, the link rows and
 * the TMDB attribution. No Settings, no Accessibility, no auth.
 */
export default function About() {
  const router = useRouter();
  const { colors } = useTheme();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as Href);
  };

  const version = Constants.expoConfig?.version ?? '';
  const build = Platform.OS === 'ios' ? Constants.expoConfig?.ios?.buildNumber : Constants.expoConfig?.android?.versionCode;
  const versionLine = build ? `Version ${version} (${build})` : `Version ${version}`;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'] }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={({ pressed }) => [styles.backButton, pressed ? { backgroundColor: colors['secondary/pressed'] } : undefined]}
        >
          <Icon name="chevron-left" size="md" color="text/primary" />
        </Pressable>
        <Text variant="title" color="text/primary" accessibilityRole="header">
          About Matinee
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.appBlock}>
          <Logo variant="mark" height={primitives['size/nav-height']} />
          <Text variant="display" color="text/primary" accessibilityRole="header" style={styles.wordmark}>
            Matinee
          </Text>
          <Text variant="body" color="text/secondary">
            {versionLine}
          </Text>
        </View>

        <View style={[styles.group, { backgroundColor: colors['surface/raised'], borderColor: colors['border/default'] }]}>
          <ListRow label="Open source licences" onPress={() => void Linking.openURL(GITHUB_REPO_URL)} />
          <ListRow label="Help and support" onPress={() => void Linking.openURL(SUPPORT_URL)} showDivider={false} />
        </View>

        <View style={styles.tmdb}>
          <Text variant="body" color="text/secondary">
            Film data and posters are provided by TMDB.
          </Text>
          <TmdbAttribution />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/2'],
    paddingHorizontal: primitives['space/4'],
    paddingTop: primitives['space/4'],
  },
  backButton: {
    width: primitives['size/touch-min'],
    height: primitives['size/touch-min'],
    borderRadius: primitives['radius/full'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: primitives['space/4'],
    gap: primitives['space/4'],
  },
  appBlock: {
    alignItems: 'center',
    paddingVertical: primitives['space/6'],
    gap: primitives['space/3'],
  },
  wordmark: {
    marginTop: primitives['space/1'],
  },
  group: {
    borderRadius: primitives['radius/lg'],
    borderWidth: primitives['border-width/default'],
    overflow: 'hidden',
  },
  tmdb: {
    gap: primitives['space/3'],
  },
});
