import { StyleSheet, View } from 'react-native';
import { primitives } from '../tokens/tokens';
import { Seat } from './Seat';
import { SEAT_LEGEND_ITEMS } from './seatMapLogic';
import { Text } from './Text';

/**
 * The seat looks with their names, always shown with the seat map (Figma `SeatMap/Legend`, 19:59): six
 * entries in two columns. No props. Each entry is one spoken line; the swatch is decorative.
 */
export function SeatLegend() {
  return (
    <View style={styles.legend}>
      {SEAT_LEGEND_ITEMS.map((item) => (
        <View key={item.state} accessible accessibilityLabel={item.label} style={styles.item}>
          <Seat state={item.state} size={primitives['size/icon-lg']} />
          <Text variant="caption" color="text/secondary" style={styles.label}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: primitives['space/4'],
    rowGap: primitives['space/2'],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: primitives['space/2'],
    flexGrow: 1,
    flexBasis: '40%',
  },
  label: {
    flex: 1,
  },
});
