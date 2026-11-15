import { type Href, useRouter } from 'expo-router';
import { type ComponentRef, type ComponentType, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, Icon, Text } from '../components';
import { GallerySection } from '../gallery/GalleryParts';
import { GALLERY_SECTIONS, type GallerySectionId } from '../gallery/registry';
import { ButtonsSection } from '../gallery/sections/ButtonsSection';
import { CardsSection } from '../gallery/sections/CardsSection';
import { FeedbackSection } from '../gallery/sections/FeedbackSection';
import { IconsSection } from '../gallery/sections/IconsSection';
import { InputSection } from '../gallery/sections/InputSection';
import { MotionSection } from '../gallery/sections/MotionSection';
import { NavigationSection } from '../gallery/sections/NavigationSection';
import { PlannedSection } from '../gallery/sections/PlannedSection';
import { SelectionSection } from '../gallery/sections/SelectionSection';
import { TypographySection } from '../gallery/sections/TypographySection';
import { ThemeToggle } from '../gallery/ThemeToggle';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';

/** Typed as a Record over the registry's ids, so adding a section without rendering it fails to compile. */
const SECTION_BODIES: Record<GallerySectionId, ComponentType> = {
  typography: TypographySection,
  icons: IconsSection,
  buttons: ButtonsSection,
  cards: CardsSection,
  selection: SelectionSection,
  input: InputSection,
  feedback: FeedbackSection,
  navigation: NavigationSection,
  motion: MotionSection,
};

const PLANNED_ID = 'planned';

/**
 * Hidden component gallery (RULES.md D3.4): every component in every state, in light and dark, with
 * no network. Not linked from the app; open it by its path, `/gallery` (for example
 * `matinee://gallery`, or `exp://<host>:8081/--/gallery` in Expo Go).
 */
export default function Gallery() {
  const router = useRouter();
  const { colors } = useTheme();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Record<string, number>>({});
  /** The header is sticky, so a section scrolled to y = 0 would sit underneath it. */
  const headerHeight = useRef(0);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as Href);
  };

  const jumpTo = (id: string) => {
    const y = positions.current[id];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - headerHeight.current), animated: true });
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'] }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          onLayout={(event) => {
            headerHeight.current = event.nativeEvent.layout.height;
          }}
          style={[styles.header, { backgroundColor: colors['surface/default'] }]}
        >
          <View style={styles.titleRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={goBack}
              style={styles.back}
            >
              <Icon name="chevron-left" size="lg" />
            </Pressable>
            <View style={styles.titleCopy}>
              <Text variant="title-lg" color="text/primary" accessibilityRole="header">
                Component gallery
              </Text>
              <Text variant="caption" color="text/secondary">
                Every component in every state. No network needed.
              </Text>
            </View>
          </View>

          <ThemeToggle />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.jumpRow}
            accessibilityLabel="Jump to a section"
          >
            {GALLERY_SECTIONS.map((section) => (
              <Chip
                key={section.id}
                label={section.title}
                accessibilityLabel={`Jump to ${section.title}`}
                onPress={() => jumpTo(section.id)}
              />
            ))}
            <Chip label="Not built yet" accessibilityLabel="Jump to components not built yet" onPress={() => jumpTo(PLANNED_ID)} />
          </ScrollView>
        </View>

        {GALLERY_SECTIONS.map((section) => {
          const Body = SECTION_BODIES[section.id];
          return (
            <GallerySection
              key={section.id}
              title={section.title}
              docs={section.docs}
              onLayoutY={(y) => {
                positions.current[section.id] = y;
              }}
            >
              <Body />
            </GallerySection>
          );
        })}

        <GallerySection
          title="Not built yet"
          docs="Figma Gallery"
          onLayoutY={(y) => {
            positions.current[PLANNED_ID] = y;
          }}
        >
          <PlannedSection />
        </GallerySection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: primitives['space/16'],
    gap: primitives['space/8'],
  },
  header: {
    gap: primitives['space/3'],
    paddingHorizontal: primitives['space/4'],
    paddingBottom: primitives['space/3'],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/2'],
  },
  back: {
    width: primitives['size/touch-min'],
    height: primitives['size/touch-min'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCopy: {
    flex: 1,
    gap: primitives['space/1'],
  },
  jumpRow: {
    gap: primitives['space/2'],
  },
});
