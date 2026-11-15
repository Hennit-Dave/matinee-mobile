import { StyleSheet, View } from 'react-native';
import { Text, type TextProps, type TextVariant } from '../../components';
import { useTheme } from '../../theme';
import { primitives } from '../../tokens/tokens';
import { GalleryGroup, GalleryItem } from '../GalleryParts';

const TYPE_SCALE: readonly { variant: TextVariant; sample: string; family: string }[] = [
  { variant: 'display', sample: 'The Lantern Road', family: 'Newsreader' },
  { variant: 'title-lg', sample: 'Choose your seats', family: 'Newsreader' },
  { variant: 'title', sample: 'Now playing', family: 'Inter 600' },
  { variant: 'body-lg', sample: 'Pick a showtime that suits you.', family: 'Inter' },
  { variant: 'body', sample: 'Drama · 2h 14m · Now playing', family: 'Inter' },
  { variant: 'label-lg', sample: 'See showtimes', family: 'Inter 600' },
  { variant: 'label', sample: 'Film title', family: 'Inter 500' },
  { variant: 'caption', sample: 'Prices include the service fee', family: 'Inter' },
  { variant: 'numeral', sample: '7', family: 'Newsreader' },
];

const TEXT_COLORS: readonly NonNullable<TextProps['color']>[] = [
  'text/primary',
  'text/secondary',
  'text/disabled',
];

const STATUS_COLORS: readonly NonNullable<TextProps['color']>[] = [
  'status/error',
  'status/warning',
  'status/success',
  'status/info',
];

export function TypographySection() {
  const { colors } = useTheme();

  return (
    <GalleryGroup
      name="Text"
      note="9 variants. Newsreader for display, title-lg and numeral; Inter for the rest. Text grows with the system font size."
    >
      {TYPE_SCALE.map(({ variant, sample, family }) => (
        <GalleryItem key={variant} label={`${variant} · ${family}`}>
          <Text variant={variant}>{sample}</Text>
        </GalleryItem>
      ))}

      <GalleryItem label="Colour: text/primary, text/secondary, text/disabled">
        <View style={styles.stack}>
          {TEXT_COLORS.map((color) => (
            <Text key={color} variant="body" color={color}>
              {color}
            </Text>
          ))}
        </View>
      </GalleryItem>

      <GalleryItem label="Colour: status/*">
        <View style={styles.stack}>
          {STATUS_COLORS.map((color) => (
            <Text key={color} variant="body" color={color}>
              {color}
            </Text>
          ))}
        </View>
      </GalleryItem>

      <GalleryItem label="Colour: on-primary, on-secondary, on-urgent (each on its own fill)">
        <View style={styles.stack}>
          <View style={[styles.fill, { backgroundColor: colors['primary/default'] }]}>
            <Text variant="label-lg" color="text/on-primary">
              text/on-primary on primary/default
            </Text>
          </View>
          <View style={[styles.fill, { backgroundColor: colors['secondary/default'] }]}>
            <Text variant="label-lg" color="text/on-secondary">
              text/on-secondary on secondary/default
            </Text>
          </View>
          <View style={[styles.fill, { backgroundColor: colors['urgent/default'] }]}>
            <Text variant="label-lg" color="text/on-urgent">
              text/on-urgent on urgent/default
            </Text>
          </View>
        </View>
      </GalleryItem>

      <GalleryItem label="Tabular figures (tabularNums): showtimes and countdowns line up">
        <View style={styles.stack}>
          <Text variant="title" tabularNums>
            19:30 · 20:15 · 21:45
          </Text>
          <Text variant="title" tabularNums>
            11:11 · 10:00 · 9:58
          </Text>
        </View>
      </GalleryItem>
    </GalleryGroup>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: primitives['space/2'],
  },
  fill: {
    paddingHorizontal: primitives['space/4'],
    paddingVertical: primitives['space/3'],
    borderRadius: primitives['radius/md'],
  },
});
