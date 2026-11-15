import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip } from '../../components';
import { primitives } from '../../tokens/tokens';
import { GalleryGroup, GalleryItem } from '../GalleryParts';
import { MOCK_DATES, MOCK_SHOWTIMES } from '../mocks';

const noop = () => {};

export function SelectionSection() {
  const [date, setDate] = useState<string>(MOCK_DATES[0]);
  const [time, setTime] = useState<string>(MOCK_SHOWTIMES[1]);

  return (
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
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: primitives['space/2'],
  },
});
