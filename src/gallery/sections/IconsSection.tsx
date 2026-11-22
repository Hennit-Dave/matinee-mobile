import { StyleSheet, View } from 'react-native';
import { Icon, Logo, Text, type IconName, type IconProps, type IconSize } from '../../components';
import { primitives } from '../../tokens/tokens';
import { GalleryGroup, GalleryItem, GalleryRow } from '../GalleryParts';

const ICON_NAMES: readonly IconName[] = [
  'search',
  'close',
  'info',
  'error',
  'success',
  'chevron-left',
  'chevron-right',
  'plus',
  'minus',
  'home',
  'ticket',
  'user',
];

const SIZES: readonly IconSize[] = ['sm', 'md', 'lg'];

const COLORS: readonly NonNullable<IconProps['color']>[] = [
  'text/primary',
  'text/secondary',
  'text/disabled',
  'status/error',
  'status/warning',
  'status/success',
  'status/info',
];

export function IconsSection() {
  return (
    <>
      <GalleryGroup
        name="Icon"
        note="12 icons, 3 sizes (sm 16, md 20, lg 24), coloured by semantic token. Pass accessibilityLabel when an icon stands alone."
      >
      <GalleryItem label="All icons at sm, md and lg">
        <View style={styles.grid}>
          {ICON_NAMES.map((name) => (
            <View key={name} style={styles.cell}>
              <View style={styles.sizes}>
                {SIZES.map((size) => (
                  <Icon key={size} name={name} size={size} accessibilityLabel={`${name} icon, ${size}`} />
                ))}
              </View>
              <Text variant="caption" color="text/secondary">
                {name}
              </Text>
            </View>
          ))}
        </View>
      </GalleryItem>

      <GalleryItem label="Colour tokens (the search icon, lg)">
        <GalleryRow>
          {COLORS.map((color) => (
            <View key={color} style={styles.cell}>
              <Icon name="search" size="lg" color={color} accessibilityLabel={`search icon in ${color}`} />
              <Text variant="caption" color="text/secondary">
                {color}
              </Text>
            </View>
          ))}
        </GalleryRow>
      </GalleryItem>
    </GalleryGroup>

    <GalleryGroup
      name="Logo"
      note="Three variants, recoloured by token: text/primary follows the theme, neutral/0 is always white (over the hero scrim)."
    >
      <GalleryItem label="Variants in text/primary">
        <GalleryRow>
          <Logo variant="lockup-horizontal" />
          <Logo variant="lockup-compact" />
          <Logo variant="mark" />
        </GalleryRow>
      </GalleryItem>

      <GalleryItem label="Mono-light (neutral/0) over a dark surface">
        <View style={styles.darkPanel}>
          <Logo variant="lockup-horizontal" color="neutral/0" />
        </View>
      </GalleryItem>
    </GalleryGroup>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: primitives['space/4'],
  },
  cell: {
    minWidth: primitives['space/16'],
    gap: primitives['space/2'],
  },
  sizes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/2'],
  },
  darkPanel: {
    alignSelf: 'flex-start',
    padding: primitives['space/4'],
    borderRadius: primitives['radius/md'],
    backgroundColor: primitives['neutral/1000'],
  },
});
