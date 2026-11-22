import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { Text } from './Text';
import { TMDB_LOGO_SVG } from './tmdbLogo';

/**
 * TMDB attribution (Req 1 / RULES D1.1). TMDB's API terms require their logo, the fixed disclaimer, and a link
 * back to themoviedb.org. The logo is the official, unmodified asset (its gradient and aspect ratio are preserved)
 * and is never recoloured per theme — it sits on its own surface chip so it stays legible in light and dark. The
 * service is referred to only as "TMDB" / "The Movie Database".
 */

const TMDB_URL = 'https://www.themoviedb.org';
/** Body/caption scale: clearly smaller and less prominent than the Matinee mark. */
const TMDB_LOGO_HEIGHT = 20;
/** The official viewBox aspect (273.42 x 35.52); width scales to keep it exact. */
const TMDB_LOGO_ASPECT = 273.42 / 35.52;
const TMDB_DISCLAIMER = 'This product uses the TMDB API but is not endorsed or certified by TMDB.';

export function TmdbAttribution() {
  const { colors } = useTheme();
  const width = Math.round(TMDB_LOGO_HEIGHT * TMDB_LOGO_ASPECT);
  const openTmdb = () => void Linking.openURL(TMDB_URL);

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="The Movie Database"
        accessibilityHint="Opens the TMDB website"
        onPress={openTmdb}
        style={({ pressed }) => [
          styles.logoChip,
          { backgroundColor: colors['surface/raised'], borderColor: colors['border/default'] },
          pressed ? styles.pressed : null,
        ]}
      >
        <SvgXml xml={TMDB_LOGO_SVG} width={width} height={TMDB_LOGO_HEIGHT} />
      </Pressable>
      <Text variant="caption" color="text/secondary">
        {TMDB_DISCLAIMER}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    gap: primitives['space/3'],
  },
  logoChip: {
    alignSelf: 'flex-start',
    minHeight: primitives['size/touch-min'],
    justifyContent: 'center',
    paddingHorizontal: primitives['space/3'],
    borderRadius: primitives['radius/md'],
    borderWidth: primitives['border-width/default'],
  },
  pressed: {
    opacity: 0.6,
  },
});
