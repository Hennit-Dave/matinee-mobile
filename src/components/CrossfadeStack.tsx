import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { primitives } from '../tokens/tokens';

export interface CrossfadeLayer {
  /** Stable identity of the slide. Reusing a key keeps the layer mounted, so images stay loaded. */
  key: string;
  node: ReactNode;
}

export interface CrossfadeStackProps {
  /** The slide that is (or is becoming) visible. Takes the layout space. */
  incoming: CrossfadeLayer;
  /** The slide that is leaving. Stays fully visible underneath until it is removed. */
  outgoing?: CrossfadeLayer | null;
  /** Instant swap, no animation. Pass the OS reduce-motion value. */
  reducedMotion?: boolean;
}

/**
 * Cross-dissolves between two slides. The incoming layer fades in on top of the outgoing one
 * (which stays opaque below), so the backdrop never dips to the surface colour mid-fade.
 * The outgoing layer ignores touches and is hidden from screen readers.
 *
 * Both roles use the same element type and key, so a slide that was incoming and becomes
 * outgoing is not remounted (its image does not reload).
 */
export function CrossfadeStack({ incoming, outgoing = null, reducedMotion = false }: CrossfadeStackProps) {
  const animate = Boolean(outgoing) && !reducedMotion;

  return (
    <View>
      {outgoing && !reducedMotion ? (
        <Animated.View
          key={outgoing.key}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.under}
        >
          {outgoing.node}
        </Animated.View>
      ) : null}
      <Animated.View
        key={incoming.key}
        entering={animate ? FadeIn.duration(primitives['duration/slow']) : undefined}
      >
        {incoming.node}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  under: {
    ...StyleSheet.absoluteFill,
  },
});
