import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Seat, SeatLegend, SeatMap, Text } from '../../components';
import { SEAT_LEGEND_ITEMS, SEAT_VISUAL_STATES, toggleSeatSelection } from '../../components/seatMapLogic';
import { primitives } from '../../tokens/tokens';
import { GalleryGroup, GalleryItem, GalleryRow } from '../GalleryParts';
import {
  MOCK_PICKED,
  MOCK_ROOM_LARGE,
  MOCK_ROOM_LARGE_SEATS,
  MOCK_ROOM_SMALL,
  MOCK_ROOM_SMALL_SEATS,
  MOCK_ROOM_SOLD_OUT,
} from '../seatMocks';

/** A seat map that really picks: tap a seat when zoomed (the Overview zooms in instead). */
function InteractiveMap({
  rows,
  totalSeats,
  initial = [],
  initialZoomedSeatId,
}: {
  rows: typeof MOCK_ROOM_SMALL;
  totalSeats: number;
  initial?: readonly string[];
  initialZoomedSeatId?: string;
}) {
  const [picked, setPicked] = useState<readonly string[]>(initial);
  return (
    <View style={styles.map}>
      <SeatMap
        rows={rows}
        totalSeats={totalSeats}
        selectedIds={picked}
        initialZoomedSeatId={initialZoomedSeatId}
        onSelectSeat={(id) => setPicked((current) => toggleSeatSelection(current, id).next)}
      />
      <Text variant="caption" color="text/secondary">
        {`Picked: ${picked.length === 0 ? 'none' : picked.map((id) => id.replace('mock-', '').replace('-', '')).join(', ')}`}
      </Text>
    </View>
  );
}

export function SeatsSection() {
  return (
    <>
      <GalleryGroup
        name="Seat"
        note="One seat. Shape carries the state and colour only reinforces it: outline, tick, hatching, cross, circle with the wheelchair glyph. 36 square (an 8 gap gives a 44 pitch); the legend draws them at 24. Only the seat map uses a Seat on its own."
      >
        <GalleryItem label="all six looks at 36: available, selected, held, sold, wheelchair space, wheelchair space picked">
          <GalleryRow>
            {SEAT_VISUAL_STATES.map((state) => (
              <Seat key={state} state={state} />
            ))}
          </GalleryRow>
        </GalleryItem>
        <GalleryItem label="the same six at the legend's 24">
          <GalleryRow>
            {SEAT_VISUAL_STATES.map((state) => (
              <Seat key={state} state={state} size={primitives['size/icon-lg']} />
            ))}
          </GalleryRow>
        </GalleryItem>
      </GalleryGroup>

      <GalleryGroup
        name="SeatLegend"
        note={`The ${SEAT_LEGEND_ITEMS.length} seat looks with their names, always shown with the seat map. No props. Each entry is read out as its label.`}
      >
        <SeatLegend />
      </GalleryGroup>

      <GalleryGroup
        name="SeatMap"
        note="The room in three levels, drawn from the server's seats. Overview shows every seat (0.5x; 0.3x for a 300+ seat room) and a tap zooms in. Zoomed shows full-size seats you can tap, row letters, a mini-map, and Plus and Minus. Pinch and pan too: a pinch settles on the Overview, full size, or one step further. Drag inside a map to pan it; scroll this page from outside the map. Mock rooms, no network."
      >
        <GalleryItem label="Skeleton: placeholders in the Overview's layout while the room loads">
          <View style={styles.map}>
            <SeatMap loading />
          </View>
        </GalleryItem>

        <GalleryItem label="Overview, 126 seats (0.5x), D8 and D9 picked. Tap the room to zoom in.">
          <InteractiveMap rows={MOCK_ROOM_SMALL} totalSeats={MOCK_ROOM_SMALL_SEATS} initial={MOCK_PICKED} />
        </GalleryItem>

        <GalleryItem label="Overview 300+, 320 seats (0.3x): the IMAX room. Tap the room to zoom in.">
          <InteractiveMap rows={MOCK_ROOM_LARGE} totalSeats={MOCK_ROOM_LARGE_SEATS} initial={['mock-F-9', 'mock-F-10']} />
        </GalleryItem>

        <GalleryItem label="Zoomed, starting on D8: tap a free seat to pick it, tap a picked one to drop it. Plus and Minus step the zoom.">
          <InteractiveMap
            rows={MOCK_ROOM_SMALL}
            totalSeats={MOCK_ROOM_SMALL_SEATS}
            initial={MOCK_PICKED}
            initialZoomedSeatId="mock-D-8"
          />
        </GalleryItem>

        <GalleryItem label="Sold out: a full grid with every seat sold (a sold-out room is never an empty grid)">
          <InteractiveMap rows={MOCK_ROOM_SOLD_OUT} totalSeats={MOCK_ROOM_SMALL_SEATS} />
        </GalleryItem>
      </GalleryGroup>
    </>
  );
}

const styles = StyleSheet.create({
  map: {
    gap: primitives['space/2'],
  },
});
