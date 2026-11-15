import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { Text } from './Text';

export interface CardProps {
  title: string;
  body: string;
  /** The content slot, below the title and body. Optional. */
  children?: ReactNode;
}

/**
 * A raised surface for grouped content. Light mode shows height with `elevation/1`; dark mode shows
 * it with `surface/raised` and a hairline border (the shadow token is transparent there).
 */
export function Card({ title, body, children }: CardProps) {
  const { colors, elevation } = useTheme();
  const shadow = elevation['elevation/1'];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors['surface/raised'],
          borderColor: colors['border/default'],
          boxShadow: [
            {
              offsetX: shadow.offsetX,
              offsetY: shadow.offsetY,
              blurRadius: shadow.blur,
              spreadDistance: shadow.spread,
              color: shadow.color,
            },
          ],
        },
      ]}
    >
      <View style={styles.content}>
        <Text variant="label-lg" color="text/primary">
          {title}
        </Text>
        <Text variant="body" color="text/secondary">
          {body}
        </Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: primitives['space/4'],
    borderRadius: primitives['radius/lg'],
    borderWidth: primitives['border-width/default'],
  },
  content: {
    gap: primitives['space/2'],
    overflow: 'hidden',
  },
});
