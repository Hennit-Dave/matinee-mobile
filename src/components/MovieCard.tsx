import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { Text } from './Text';

export type MovieCardLayout = 'poster' | 'poster-title' | 'list';

export interface MovieCardProps {
  layout: MovieCardLayout;
  title: string;
  meta?: string;
  posterUrl: string | null;
  onPress?: () => void;
}

export function MovieCard({ layout, title, meta, posterUrl, onPress }: MovieCardProps) {
  const { colors } = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(posterUrl) && !imageFailed;

  const accessibilityLabel = meta ? `${title}, ${meta}` : title;

  if (layout === 'list') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [
          styles.listCard,
          {
            backgroundColor: pressed ? colors['secondary/pressed'] : colors['surface/raised'],
            borderColor: colors['border/default'],
          },
        ]}
      >
        <View
          style={[
            styles.thumbFrame,
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
              <Text variant="caption" color="text/secondary" numberOfLines={2}>
                {title}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.listCopy}>
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.posterCard}
    >
      {({ pressed }) => (
        <>
          <View
            style={[
              styles.posterFrame,
              {
                backgroundColor: colors['skeleton/base'],
                borderColor: pressed ? colors['border/strong'] : colors['border/default'],
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
                <Text variant="label" color="text/secondary" numberOfLines={3}>
                  {title}
                </Text>
              </View>
            )}
          </View>

          {layout === 'poster-title' ? (
            <View style={styles.posterCopy}>
              <Text variant="label" color="text/primary" numberOfLines={2}>
                {title}
              </Text>
              {meta ? (
                <Text variant="caption" color="text/secondary" numberOfLines={1}>
                  {meta}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  posterCard: {
    width: primitives['size/poster-width'],
    minHeight: primitives['size/touch-min'],
  },
  posterFrame: {
    width: primitives['size/poster-width'],
    height: primitives['size/poster-height'],
    borderRadius: primitives['radius/md'],
    borderWidth: primitives['border-width/default'],
    overflow: 'hidden',
  },
  posterCopy: {
    marginTop: primitives['space/2'],
    gap: primitives['space/1'],
  },
  listCard: {
    minHeight: primitives['size/touch-min'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/3'],
    padding: primitives['space/3'],
    borderRadius: primitives['radius/md'],
    borderWidth: primitives['border-width/default'],
  },
  thumbFrame: {
    width: primitives['size/thumb-width'],
    height: primitives['size/thumb-height'],
    borderRadius: primitives['radius/sm'],
    borderWidth: primitives['border-width/default'],
    overflow: 'hidden',
  },
  listCopy: {
    flex: 1,
    gap: primitives['space/1'],
  },
  imageFill: {
    width: '100%',
    height: '100%',
  },
  fallbackPoster: {
    flex: 1,
    padding: primitives['space/2'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
