import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Button, CrossfadeStack, Text } from '../../components';
import { useTheme } from '../../theme';
import { primitives } from '../../tokens/tokens';
import { GalleryGroup, GalleryItem } from '../GalleryParts';
import { MOCK_META, MOCK_TITLES } from '../mocks';
import { MOCK_POSTERS } from '../posterImages';

const SLIDES = [
  { key: 'red', title: MOCK_TITLES.regular, meta: MOCK_META.regular, poster: MOCK_POSTERS.red },
  { key: 'green', title: MOCK_TITLES.short, meta: MOCK_META.year, poster: MOCK_POSTERS.green },
] as const;

const SETTLE_MS = primitives['duration/slow'] + primitives['duration/fast'];
const SLIDE_HEIGHT = primitives['size/poster-height'];

type SlideIndex = 0 | 1;

function Slide({ index }: { index: SlideIndex }) {
  const slide = SLIDES[index];
  const { colors } = useTheme();
  return (
    <View style={[styles.slide, { borderColor: colors['border/default'] }]}>
      <Image source={{ uri: slide.poster }} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <View style={[styles.slideCopy, { backgroundColor: colors['surface/overlay'] }]}>
        <Text variant="title" color="text/primary">
          {slide.title}
        </Text>
        <Text variant="caption" color="text/secondary">
          {slide.meta}
        </Text>
      </View>
    </View>
  );
}

export function MotionSection() {
  const reducedMotion = Boolean(useReducedMotion());
  const [index, setIndex] = useState<SlideIndex>(0);
  const [previous, setPrevious] = useState<SlideIndex | null>(null);

  // The outgoing slide stays mounted until the fade has finished, then the caller removes it
  // (Home does the same in useHeroCycle).
  useEffect(() => {
    if (previous === null) return undefined;
    const handle = setTimeout(() => setPrevious(null), SETTLE_MS);
    return () => clearTimeout(handle);
  }, [previous]);

  const swap = () => {
    setPrevious(index);
    setIndex((current) => (current === 0 ? 1 : 0));
  };

  return (
    <GalleryGroup
      name="CrossfadeStack"
      note={`Cross-dissolves between two slides: the incoming slide fades in over the outgoing one (duration/slow). With OS reduce-motion on, the swap is instant. Reduce-motion is ${
        reducedMotion ? 'ON' : 'off'
      } right now.`}
    >
      <GalleryItem label="press to swap slides">
        <View style={styles.stack}>
          <View style={styles.stage}>
            <CrossfadeStack
              reducedMotion={reducedMotion}
              incoming={{ key: SLIDES[index].key, node: <Slide index={index} /> }}
              outgoing={
                previous !== null ? { key: SLIDES[previous].key, node: <Slide index={previous} /> } : null
              }
            />
          </View>
          <Button variant="secondary" label="Swap slide" onPress={swap} />
        </View>
      </GalleryItem>
    </GalleryGroup>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: primitives['space/3'],
    alignItems: 'flex-start',
  },
  stage: {
    alignSelf: 'stretch',
    height: SLIDE_HEIGHT,
  },
  slide: {
    width: '100%',
    height: SLIDE_HEIGHT,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: primitives['radius/lg'],
    borderWidth: primitives['border-width/default'],
  },
  slideCopy: {
    padding: primitives['space/3'],
    gap: primitives['space/1'],
  },
});
