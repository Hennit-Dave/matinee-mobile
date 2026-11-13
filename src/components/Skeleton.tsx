import { useEffect } from 'react';
import { type DimensionValue, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';

export type SkeletonShape = 'block' | 'text' | 'poster' | 'circle';

export interface SkeletonProps {
  shape: SkeletonShape;
  width?: DimensionValue;
  height?: number;
}

export function Skeleton({ shape, width, height }: SkeletonProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: primitives['duration/celebrate'] }),
      -1,
      true
    );
  }, [progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors['skeleton/base'], colors['skeleton/highlight']]
    ),
  }));

  const resolvedWidth: DimensionValue =
    width ??
    (shape === 'poster'
      ? primitives['size/poster-width']
      : shape === 'circle'
        ? primitives['space/12']
        : '100%');

  const resolvedHeight =
    height ??
    (shape === 'poster'
      ? primitives['size/poster-height']
      : shape === 'text'
        ? primitives['space/4']
        : primitives['space/12']);

  const borderRadius =
    shape === 'circle'
      ? primitives['radius/full']
      : shape === 'text'
        ? primitives['radius/sm']
        : primitives['radius/md'];

  if (reducedMotion) {
    return (
      <View
        accessible={false}
        style={{
          width: resolvedWidth,
          height: resolvedHeight,
          borderRadius,
          backgroundColor: colors['skeleton/base'],
        }}
      />
    );
  }

  return (
    <Animated.View
      accessible={false}
      style={[
        {
          width: resolvedWidth,
          height: resolvedHeight,
          borderRadius,
        },
        animatedStyle,
      ]}
    />
  );
}
