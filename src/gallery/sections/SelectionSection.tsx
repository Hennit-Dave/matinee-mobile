import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge, Chip, Icon, ListRow, Text } from '../../components';
import { primitives } from '../../tokens/tokens';
import { useTheme } from '../../theme';
import { GalleryGroup, GalleryItem } from '../GalleryParts';
import { MOCK_DATES, MOCK_SHOWTIMES, MOCK_TITLES } from '../mocks';

const noop = () => {};

export function SelectionSection() {
  const { colors } = useTheme();
  const [date, setDate] = useState<string>(MOCK_DATES[0]);
  const [time, setTime] = useState<string>(MOCK_SHOWTIMES[1]);

  return (
    <>
      <GalleryGroup
        name="Chip"
        note="Pill selector for dates and showtimes: 32 tall inside a 48 touch target. Selected is told apart by fill, not colour alone."
      >
        <GalleryItem label="default, selected, disabled with a note">
          <View style={styles.row}>
            <Chip label={MOCK_SHOWTIMES[0]} tabularNums onPress={noop} />
            <Chip label={MOCK_SHOWTIMES[1]} tabularNums selected onPress={noop} />
            <Chip label={MOCK_SHOWTIMES[3]} tabularNums disabled note="Sold out" onPress={noop} />
          </View>
        </GalleryItem>

        <GalleryItem label="interactive: dates (tap to select)">
          <View style={styles.row}>
            {MOCK_DATES.map((label) => (
              <Chip key={label} label={label} selected={date === label} onPress={() => setDate(label)} />
            ))}
          </View>
        </GalleryItem>

        <GalleryItem label="interactive: showtimes with one sold out (tabular figures)">
          <View style={styles.row}>
            {MOCK_SHOWTIMES.map((label) => {
              const soldOut = label === MOCK_SHOWTIMES[3];
              return (
                <Chip
                  key={label}
                  label={label}
                  tabularNums
                  selected={time === label}
                  disabled={soldOut}
                  note={soldOut ? 'Sold out' : undefined}
                  onPress={() => setTime(label)}
                />
              );
            })}
          </View>
        </GalleryItem>
      </GalleryGroup>

      <GalleryGroup
        name="Badge"
        note="A short status word in an outline. The word carries the meaning; the tone only reinforces it. 5 tones. Not interactive."
      >
        <GalleryItem label="neutral, success, warning, error, info">
          <View style={styles.row}>
            <Badge tone="neutral" label="Used" />
            <Badge tone="success" label="Confirmed" />
            <Badge tone="warning" label="Confirming" />
            <Badge tone="error" label="Cancelled" />
            <Badge tone="info" label="Refunded" />
          </View>
        </GalleryItem>

        <GalleryItem label="default tone is neutral; a longer label">
          <View style={styles.row}>
            <Badge label="Standard" />
            <Badge tone="warning" label="Waiting for payment" />
          </View>
        </GalleryItem>

        <GalleryItem label="beside a title, as on a ticket">
          <View style={styles.titleRow}>
            <Text variant="label-lg" color="text/primary">
              {MOCK_TITLES.regular}
            </Text>
            <Badge tone="success" label="Confirmed" />
          </View>
        </GalleryItem>
      </GalleryGroup>

      <GalleryGroup
        name="ListRow"
        note="A settings row, grouped in a bordered surface/raised container; the bottom hairline is hidden on the last row."
      >
        <GalleryItem label="a group with dividers and chevrons">
          <View style={[styles.listGroup, { backgroundColor: colors['surface/raised'], borderColor: colors['border/default'] }]}>
            <ListRow label="About Matinee" onPress={noop} />
            <ListRow label="Open source licences" onPress={noop} />
            <ListRow label="Help and support" onPress={noop} showDivider={false} />
          </View>
        </GalleryItem>

        <GalleryItem label="a leading icon">
          <View style={[styles.listGroup, { backgroundColor: colors['surface/raised'], borderColor: colors['border/default'] }]}>
            <ListRow label="Notifications" leading={<Icon name="info" size="lg" color="text/secondary" />} onPress={noop} showDivider={false} />
          </View>
        </GalleryItem>
      </GalleryGroup>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: primitives['space/2'],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/3'],
  },
  listGroup: {
    borderRadius: primitives['radius/lg'],
    borderWidth: primitives['border-width/default'],
    overflow: 'hidden',
  },
});
