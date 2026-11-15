import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { Text } from './Text';

export interface SearchResultRowProps {
  title: string;
  meta?: string;
  posterUrl: string | null;
  onPress?: () => void;
}

/**
 * Compact vertical search/discover row: 64x96 poster thumbnail on the left,
 * title (`label-lg`) and meta (`body`) on the right.
 */
export function SearchResultRow({ title, meta, posterUrl, onPress }: SearchResultRowProps) {
  const { colors } = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(posterUrl) && !imageFailed;
  const accessibilityLabel = meta ? `${title}, ${meta}` : title;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : undefined]}
    >
      <View
        style={[
          styles.posterFrame,
          {
            backgroundColor: colors['skeleton/base'],
            borderColor: colors['border/default'],
          },
        ]}
      >
        {showImage ? (
          <Image
            source={{ uri: posterUrl! }}
            accessibilityLabel={title}
            style={styles.imageFill}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={styles.fallbackPoster}>
            <Text variant="caption" color="text/secondary" numberOfLines={3}>
              {title}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.copy}>
        <Text variant="label-lg" color="text/primary" numberOfLines={2}>
          {title}
        </Text>
        {meta ? (
          <Text variant="body" color="text/secondary" numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: primitives['size/touch-min'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/3'],
  },
  pressed: {
    opacity: 0.75,
  },
  posterFrame: {
    width: primitives['size/thumb-width'],
    height: primitives['size/thumb-height'],
    borderRadius: primitives['radius/sm'],
    borderWidth: primitives['border-width/default'],
    overflow: 'hidden',
  },
  imageFill: {
    width: '100%',
    height: '100%',
  },
  fallbackPoster: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: primitives['space/1'],
  },
  copy: {
    flex: 1,
    gap: primitives['space/1'],
  },
});
