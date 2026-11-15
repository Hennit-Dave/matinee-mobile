import { BlurTargetView } from 'expo-blur';
import { useRef, useState, type ComponentRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, Button, NavBar, Text, type NavItemKey } from '../../components';
import { ANDROID_GLASS_ENABLED, navBarBottomOffset } from '../../components/navBarLogic';
import { useTheme } from '../../theme';
import { primitives } from '../../tokens/tokens';
import { GalleryGroup, GalleryItem } from '../GalleryParts';
import { MOCK_POSTERS } from '../posterImages';

const BACKDROP = [MOCK_POSTERS.red, MOCK_POSTERS.green, MOCK_POSTERS.cream, MOCK_POSTERS.dark] as const;
const ACTIVE_ITEMS: readonly NavItemKey[] = ['home', 'tickets', 'account'];

/** Same split as the tab layout: on Android the screens behind the bar are the blur target. */
const NavTarget = ANDROID_GLASS_ENABLED ? BlurTargetView : View;

/**
 * A NavBar over something colourful to blur. The bar is a SIBLING of the blur target, never inside
 * it (a BlurView inside the view it blurs crashes the Android renderer). Tapping an item here only
 * changes this demo's own active item.
 */
function NavBarDemo({ initial, solid }: { initial: NavItemKey; solid: boolean }) {
  const insets = useSafeAreaInsets();
  const blurTarget = useRef<ComponentRef<typeof View>>(null);
  const [active, setActive] = useState<NavItemKey>(initial);
  const { colors } = useTheme();

  const stageHeight =
    navBarBottomOffset(insets.bottom) + primitives['size/nav-height'] + primitives['space/4'];

  return (
    <View style={[styles.stage, { height: stageHeight, borderColor: colors['border/default'] }]}>
      <NavTarget ref={blurTarget} style={StyleSheet.absoluteFill}>
        <View style={styles.backdrop}>
          {BACKDROP.map((uri) => (
            <Image key={uri} source={{ uri }} resizeMode="cover" style={styles.backdropImage} />
          ))}
        </View>
      </NavTarget>
      <NavBar active={active} reduceTransparency={solid} onNavigate={setActive} blurTarget={blurTarget} />
    </View>
  );
}

type SheetKind = 'standard' | 'destructive' | null;

export function NavigationSection() {
  const [sheet, setSheet] = useState<SheetKind>(null);
  const close = () => setSheet(null);

  return (
    <>
      <GalleryGroup
        name="NavBar"
        note="3 active items × 2 materials. Glass is the default; Solid is the fallback for reduce-transparency or when blur can't be drawn (Android below API 31). The active item is a filled pill, never colour alone. Tap an item to change the demo's active item."
      >
        <GalleryItem label="Glass">
          <View style={styles.stack}>
            {ACTIVE_ITEMS.map((item) => (
              <NavBarDemo key={`glass-${item}`} initial={item} solid={false} />
            ))}
          </View>
        </GalleryItem>
        <GalleryItem label="Solid (reduceTransparency)">
          <View style={styles.stack}>
            {ACTIVE_ITEMS.map((item) => (
              <NavBarDemo key={`solid-${item}`} initial={item} solid />
            ))}
          </View>
        </GalleryItem>
      </GalleryGroup>

      <GalleryGroup
        name="BottomSheet"
        note="A modal sheet over a scrim. Closes by scrim tap, dragging the handle down, or the system back action. Open each pattern to see it."
      >
        <GalleryItem label="closed (the default); open a pattern:">
          <View style={styles.sheetButtons}>
            <Button variant="secondary" label="Open standard sheet" onPress={() => setSheet('standard')} />
            <Button variant="secondary" label="Open destructive sheet" onPress={() => setSheet('destructive')} />
          </View>
        </GalleryItem>
      </GalleryGroup>

      <BottomSheet visible={sheet === 'standard'} onClose={close} accessibilityLabel="Hold expired">
        <View style={styles.sheetBody}>
          <Text variant="title-lg" color="text/primary">
            Your hold expired
          </Text>
          <Text variant="body-lg" color="text/secondary">
            The seats were released after 10 minutes. Choose them again and we will hold them for you.
          </Text>
          <Button variant="primary" fullWidth label="Choose seats again" onPress={close} />
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === 'destructive'} onClose={close} accessibilityLabel="Sign out">
        <View style={styles.sheetBody}>
          <Text variant="title-lg" color="text/primary">
            Sign out?
          </Text>
          <Text variant="body-lg" color="text/secondary">
            You will need to sign in again to see your tickets. Saved tickets stay on this phone.
          </Text>
          <Button variant="primary" fullWidth label="Stay signed in" onPress={close} />
          <Button variant="secondary" fullWidth label="Sign out" onPress={close} />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: primitives['space/3'],
  },
  stage: {
    overflow: 'hidden',
    borderRadius: primitives['radius/lg'],
    borderWidth: primitives['border-width/default'],
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  backdropImage: {
    flex: 1,
    height: '100%',
  },
  sheetButtons: {
    gap: primitives['space/3'],
    alignItems: 'flex-start',
  },
  sheetBody: {
    gap: primitives['space/4'],
    paddingBottom: primitives['space/4'],
  },
});
