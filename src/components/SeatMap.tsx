import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { countSeats, type ShowtimeSeatRow } from '../api/seats';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { Icon, type IconName } from './Icon';
import { Seat } from './Seat';
import {
  AISLE_WIDTH,
  GUTTER_LEFT,
  GUTTER_RIGHT,
  MAX_ZOOM_SCALE,
  MINIMAP_COLUMNS,
  MINIMAP_ROWS,
  SEAT_GAP,
  SEAT_PITCH,
  SEAT_SIZE,
  ZOOMED_SCALE,
  aisleAfter,
  buildMapLayout,
  clamp,
  clampTranslate,
  focusTranslate,
  hitTestSeat,
  initialMapView,
  isSeatSelectable,
  isZoomedScale,
  minimapDots,
  nearestStop,
  overviewScaleFor,
  overviewWindow,
  parseCubicBezier,
  rowWidth,
  seatAccessibilityLabel,
  seatVisualState,
  stepStop,
  visibleFraction,
  zoomStops,
  zoomedWindow,
  zoomedWindowHeight,
} from './seatMapLogic';
import { Text } from './Text';

export interface SeatMapProps {
  /** The room, from the server. Omit (or pass `loading`) to draw the Skeleton level. */
  rows?: readonly ShowtimeSeatRow[];
  /** The screen's capacity from the server; it picks the Overview scale (a 300+ seat room is drawn smaller). */
  totalSeats?: number;
  /** Seat ids the user has picked. Held and sold seats ignore this: the server's state wins. */
  selectedIds?: readonly string[];
  /** Called when a seat is tapped while zoomed. The screen owns the selection (and its limit). */
  onSelectSeat?: (seatId: string) => void;
  loading?: boolean;
  /** Start zoomed in on this seat instead of at the whole-room Overview (the gallery uses it). */
  initialZoomedSeatId?: string;
}

const NO_SELECTION: readonly string[] = [];

// ---- Rows (memoized) ------------------------------------------------------------------------------

interface SeatRowViewProps {
  row: ShowtimeSeatRow;
  /** Which seat numbers in this row are picked, as "8,9". A string, so an unchanged row compares equal. */
  pickedNumbers: string;
  onActivate: (seatId: string) => void;
}

/**
 * One row of the room. Memoized on its own row and the numbers picked in it, so picking a seat
 * re-renders one row (and, inside it, one seat) rather than the whole map.
 */
const SeatRowView = memo(function SeatRowView({ row, pickedNumbers, onActivate }: SeatRowViewProps) {
  const picked = pickedNumbers ? pickedNumbers.split(',') : [];
  const aisleIndex = aisleAfter(row.seats.length);
  const children: ReactElement[] = [];
  row.seats.forEach((seat, index) => {
    if (index === aisleIndex) children.push(<View key="aisle" style={styles.aisle} />);
    const state = seatVisualState(seat, picked.includes(String(seat.number)));
    children.push(
      <Seat
        key={seat.id}
        seatId={seat.id}
        state={state}
        accessibilityLabel={seatAccessibilityLabel(seat, state)}
        onActivate={onActivate}
      />
    );
  });
  if (aisleIndex >= row.seats.length) children.push(<View key="aisle" style={styles.aisle} />);
  return <View style={styles.row}>{children}</View>;
});

function ScreenArc() {
  const { colors } = useTheme();
  return (
    <View style={styles.screen} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={[styles.arc, { backgroundColor: colors['border/strong'] }]} />
      <Text variant="caption" color="text/secondary">
        Screen
      </Text>
    </View>
  );
}

// ---- Zoomed level chrome --------------------------------------------------------------------------

/**
 * A row letter, kept level with its row at every zoom: its position comes from the same scale and
 * translation as the seats, but the letter itself is never scaled.
 */
const RowLabel = memo(function RowLabel({
  row,
  index,
  scale,
  ty,
}: {
  row: string;
  index: number;
  scale: SharedValue<number>;
  ty: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.get() + (index * SEAT_PITCH + SEAT_SIZE / 2) * scale.get() - SEAT_SIZE / 2 }],
  }));
  return (
    <Animated.View style={[styles.label, style]}>
      <Text variant="caption" color="text/secondary">
        {row}
      </Text>
    </Animated.View>
  );
});

const MINIMAP_DOT = primitives['space/1'];
const MINIMAP_DOTS_WIDTH = MINIMAP_COLUMNS * MINIMAP_DOT + (MINIMAP_COLUMNS - 1) * MINIMAP_DOT;
const MINIMAP_DOTS_HEIGHT = MINIMAP_ROWS * MINIMAP_DOT + (MINIMAP_ROWS - 1) * MINIMAP_DOT;

interface MiniMapProps {
  dots: boolean[][];
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  winStart: SharedValue<number>;
  winSize: SharedValue<number>;
  winHeight: SharedValue<number>;
  contentWidth: number;
  contentHeight: number;
}

/** The mini-map: a dot per block of the room, and a box marking the part the window shows. */
function MiniMap({ dots, scale, tx, ty, winStart, winSize, winHeight, contentWidth, contentHeight }: MiniMapProps) {
  const { colors } = useTheme();
  const viewportStyle = useAnimatedStyle(() => {
    const across = visibleFraction(contentWidth, scale.get(), tx.get(), winStart.get(), winSize.get());
    const down = visibleFraction(contentHeight, scale.get(), ty.get(), 0, winHeight.get());
    return {
      left: MINIMAP_DOT + across.start * MINIMAP_DOTS_WIDTH,
      top: MINIMAP_DOT + down.start * MINIMAP_DOTS_HEIGHT,
      width: across.size * MINIMAP_DOTS_WIDTH,
      height: down.size * MINIMAP_DOTS_HEIGHT,
    };
  });

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.minimap, { backgroundColor: colors['surface/raised'], borderColor: colors['border/default'] }]}
    >
      <View style={styles.minimapDots}>
        {dots.map((rowDots, r) => (
          <View key={r} style={styles.minimapRow}>
            {rowDots.map((lit, c) => (
              <View
                key={c}
                style={[styles.minimapDot, { backgroundColor: lit ? colors['seat/available'] : colors['border/default'] }]}
              />
            ))}
          </View>
        ))}
      </View>
      <Animated.View style={[styles.minimapViewport, { borderColor: colors['text/primary'] }, viewportStyle]} />
    </View>
  );
}

function ZoomButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.zoomButton, { backgroundColor: colors['surface/overlay'], borderColor: colors['border/default'] }]}
    >
      <Icon name={icon} size="lg" color={disabled ? 'text/disabled' : 'text/primary'} />
    </Pressable>
  );
}

// ---- The map --------------------------------------------------------------------------------------

interface SeatMapReadyProps extends Omit<SeatMapProps, 'loading' | 'rows'> {
  rows: readonly ShowtimeSeatRow[];
  width: number;
}

function SeatMapReady({
  rows,
  width,
  totalSeats,
  selectedIds = NO_SELECTION,
  onSelectSeat,
  initialZoomedSeatId,
}: SeatMapReadyProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();

  const layout = useMemo(() => buildMapLayout(rows), [rows]);
  const { contentWidth, contentHeight } = layout;
  const minScale = overviewScaleFor(totalSeats ?? countSeats(rows), contentWidth, width);
  const overviewHeight = Math.ceil(contentHeight * minScale);
  const zoomedHeight = zoomedWindowHeight(contentHeight);
  const zoomedGlow = (minScale + ZOOMED_SCALE) / 2;

  // The view the map starts in. `key={width}` in the wrapper restarts it if the width changes.
  const [initial] = useState(() => initialMapView(layout, rows, width, minScale, initialZoomedSeatId));
  const [zoomed, setZoomed] = useState(initial.zoomed);
  const [stop, setStop] = useState(() => (initial.zoomed ? 1 : 0));
  const zoomedRef = useRef(zoomed);
  useEffect(() => {
    zoomedRef.current = zoomed;
  }, [zoomed]);

  // The whole map is one layer, moved and scaled on the UI thread: a gesture re-renders no React.
  const scale = useSharedValue(initial.scale);
  const tx = useSharedValue(initial.tx);
  const ty = useSharedValue(initial.ty);
  const startScale = useSharedValue(initial.scale);
  const startTx = useSharedValue(initial.tx);
  const startTy = useSharedValue(initial.ty);
  const firstWindow = initial.zoomed ? zoomedWindow(width) : overviewWindow(width);
  const winStart = useSharedValue(firstWindow.start);
  const winSize = useSharedValue(firstWindow.size);
  const winHeight = useSharedValue(initial.zoomed ? zoomedHeight : overviewHeight);

  const latest = useRef({ rows, layout, onSelectSeat });
  useEffect(() => {
    latest.current = { rows, layout, onSelectSeat };
  }, [rows, layout, onSelectSeat]);

  /** Switches the window between the full-width Overview and the zoomed one (room for letters and controls). */
  const applyZoomed = useCallback(
    (next: boolean) => {
      const window = next ? zoomedWindow(width) : overviewWindow(width);
      winStart.set(window.start);
      winSize.set(window.size);
      winHeight.set(next ? zoomedHeight : overviewHeight);
      setZoomed(next);
    },
    [overviewHeight, width, winHeight, winSize, winStart, zoomedHeight]
  );

  const easing = useMemo(() => Easing.bezier(...parseCubicBezier(primitives['easing/standard'])), []);

  /** Animates to a resting scale with `focus` (a map point) in the middle of the window. */
  const flyTo = useCallback(
    (target: number, focus: { x: number; y: number }) => {
      const nextZoomed = isZoomedScale(target, minScale);
      const window = nextZoomed ? zoomedWindow(width) : overviewWindow(width);
      const height = nextZoomed ? zoomedHeight : overviewHeight;
      const nextTx = focusTranslate(focus.x, target, contentWidth, window.start, window.size);
      const nextTy = focusTranslate(focus.y, target, contentHeight, 0, height);
      setStop(zoomStops(minScale).indexOf(target));

      // Zooming in needs the taller viewport straight away; zooming out gives it back once it has shrunk.
      if (nextZoomed) applyZoomed(true);
      const config = { duration: reducedMotion ? 0 : primitives['duration/base'], easing };
      scale.set(withTiming(target, config));
      tx.set(withTiming(nextTx, config));
      ty.set(
        withTiming(nextTy, config, (finished) => {
          'worklet';
          if (finished && !nextZoomed) runOnJS(applyZoomed)(false);
        })
      );
    },
    [applyZoomed, contentHeight, contentWidth, easing, minScale, overviewHeight, reducedMotion, scale, tx, ty, width, zoomedHeight]
  );

  /** The map point at the middle of the window right now: what Plus, Minus and a pinch keep in place. */
  const windowCentre = useCallback(() => {
    const window = zoomedRef.current ? zoomedWindow(width) : overviewWindow(width);
    const height = zoomedRef.current ? zoomedHeight : overviewHeight;
    return {
      x: (window.start + window.size / 2 - tx.get()) / scale.get(),
      y: (height / 2 - ty.get()) / scale.get(),
    };
  }, [overviewHeight, scale, tx, ty, width, zoomedHeight]);

  const zoomStep = useCallback(
    (direction: 'in' | 'out') => {
      const target = stepStop(scale.get(), minScale, direction);
      flyTo(target, windowCentre());
    },
    [flyTo, minScale, scale, windowCentre]
  );

  const settle = useCallback(
    (target: number) => {
      flyTo(target, windowCentre());
    },
    [flyTo, windowCentre]
  );

  const handleTap = useCallback(
    (x: number, y: number) => {
      const s = scale.get();
      const mapX = (x - tx.get()) / s;
      const mapY = (y - ty.get()) / s;

      if (!zoomedRef.current) {
        // The Overview is not tappable seat by seat: a tap zooms in on that part of the room.
        flyTo(ZOOMED_SCALE, { x: mapX, y: mapY });
        return;
      }
      const window = zoomedWindow(width);
      if (x < window.start || x > window.start + window.size) return; // under the row letters or the controls
      const { rows: currentRows, layout: currentLayout, onSelectSeat: select } = latest.current;
      const hit = hitTestSeat(currentLayout, mapX, mapY);
      if (!hit) return;
      const seat = currentRows[hit.rowIndex]?.seats[hit.seatIndex];
      if (seat && isSeatSelectable(seat)) select?.(seat.id);
    },
    [flyTo, scale, tx, ty, width]
  );

  const pan = usePanGesture({
    // Only while zoomed: in the Overview the whole room fits, so there is nothing to pan, and a pan
    // handler there would swallow the drags a parent list needs in order to scroll.
    enabled: zoomed,
    minDistance: primitives['space/2'],
    onUpdate: (event) => {
      'worklet';
      if (event.numberOfPointers > 1) return; // two fingers are a pinch, which moves the map itself
      tx.set(clampTranslate(tx.get() + event.changeX, scale.get(), contentWidth, winStart.get(), winSize.get()));
      ty.set(clampTranslate(ty.get() + event.changeY, scale.get(), contentHeight, 0, winHeight.get()));
    },
  });

  const pinch = usePinchGesture({
    onActivate: () => {
      'worklet';
      cancelAnimation(scale);
      cancelAnimation(tx);
      cancelAnimation(ty);
      startScale.set(scale.get());
      startTx.set(tx.get());
      startTy.set(ty.get());
    },
    onUpdate: (event) => {
      'worklet';
      const next = clamp(startScale.get() * event.scale, minScale, MAX_ZOOM_SCALE);
      const ratio = next / startScale.get();
      // Keep the part of the map under the fingers where it is.
      const nextTx = event.focalX - (event.focalX - startTx.get()) * ratio;
      const nextTy = event.focalY - (event.focalY - startTy.get()) * ratio;
      scale.set(next);
      tx.set(clampTranslate(nextTx, next, contentWidth, winStart.get(), winSize.get()));
      ty.set(clampTranslate(nextTy, next, contentHeight, 0, winHeight.get()));
    },
    onDeactivate: () => {
      'worklet';
      // A pinch settles on the nearest resting scale: the Overview, full-size seats, or one step further.
      runOnJS(settle)(nearestStop(scale.get(), minScale));
    },
  });

  const tap = useTapGesture({
    runOnJS: true,
    onActivate: (event) => {
      handleTap(event.x, event.y);
    },
  });

  const gesture = useCompetingGestures(tap, useSimultaneousGestures(pan, pinch));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scale.get(), [zoomedGlow, ZOOMED_SCALE], [0, 1], Extrapolation.CLAMP),
  }));

  // Which seat numbers are picked in each row, as one string per row (see SeatRowView).
  const pickedByRow = useMemo(() => {
    const byRow = new Map<string, number[]>();
    const picked = new Set(selectedIds);
    if (picked.size > 0) {
      for (const row of rows) {
        for (const seat of row.seats) {
          if (picked.has(seat.id)) byRow.set(row.row, [...(byRow.get(row.row) ?? []), seat.number]);
        }
      }
    }
    return new Map([...byRow].map(([row, numbers]) => [row, numbers.join(',')] as const));
  }, [rows, selectedIds]);

  const handleActivate = useCallback(
    (seatId: string) => {
      latest.current.onSelectSeat?.(seatId);
    },
    []
  );

  const dots = useMemo(() => minimapDots(rows), [rows]);
  const available = useMemo(
    () => rows.reduce((total, row) => total + row.seats.filter(isSeatSelectable).length, 0),
    [rows]
  );

  const viewportHeight = zoomed ? zoomedHeight : overviewHeight;
  const hiddenWhenOverview = zoomed ? 'auto' : 'no-hide-descendants';

  return (
    <View style={styles.root}>
      <ScreenArc />
      <View style={[styles.viewport, { width, height: viewportHeight }]}>
        <GestureDetector gesture={gesture}>
          <View
            collapsable={false}
            style={styles.fill}
            accessible={!zoomed}
            accessibilityRole={zoomed ? undefined : 'button'}
            accessibilityLabel={
              zoomed ? undefined : `Seat map, ${available} of ${countSeats(rows)} seats available. Double tap to zoom in.`
            }
            accessibilityActions={zoomed ? undefined : ZOOM_IN_ACTION}
            onAccessibilityAction={zoomed ? undefined : () => zoomStep('in')}
            onAccessibilityTap={zoomed ? undefined : () => zoomStep('in')}
          >
            <Animated.View
              importantForAccessibility={hiddenWhenOverview}
              accessibilityElementsHidden={!zoomed}
              style={[styles.content, { width: contentWidth, height: contentHeight }, contentStyle]}
            >
              {rows.map((row) => (
                <SeatRowView
                  key={row.row}
                  row={row}
                  pickedNumbers={pickedByRow.get(row.row) ?? ''}
                  onActivate={handleActivate}
                />
              ))}
            </Animated.View>
          </View>
        </GestureDetector>

        {zoomed ? (
          <>
            {/* Row letters: left of the seats, moving up and down with them. Opaque, so seats do not show under them. */}
            <Animated.View
              pointerEvents="none"
              style={[styles.gutterLeft, { backgroundColor: colors['surface/default'] }, chromeStyle]}
            >
              {rows.map((row, index) => (
                <RowLabel key={row.row} row={row.row} index={index} scale={scale} ty={ty} />
              ))}
            </Animated.View>

            {/* Mini-map and zoom buttons: right of the seats. */}
            <Animated.View
              pointerEvents="box-none"
              style={[styles.gutterRight, { backgroundColor: colors['surface/default'] }, chromeStyle]}
            >
              <MiniMap
                dots={dots}
                scale={scale}
                tx={tx}
                ty={ty}
                winStart={winStart}
                winSize={winSize}
                winHeight={winHeight}
                contentWidth={contentWidth}
                contentHeight={contentHeight}
              />
              <ZoomButton icon="plus" label="Zoom in" disabled={stop >= zoomStops(minScale).length - 1} onPress={() => zoomStep('in')} />
              <ZoomButton icon="minus" label="Zoom out" onPress={() => zoomStep('out')} />
            </Animated.View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const ZOOM_IN_ACTION = [{ name: 'activate', label: 'Zoom in' }];

// ---- Skeleton level -------------------------------------------------------------------------------

const SKELETON_ROWS = 10;
const SKELETON_PER_ROW = 14;

const SkeletonBlock = memo(function SkeletonBlock({ progress, size }: { progress: SharedValue<number>; size: number }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [colors['skeleton/base'], colors['skeleton/highlight']]),
  }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: primitives['radius/sm'] }, style]} />;
});

/** The Skeleton level (Figma `SeatMap` Level=Skeleton): the Overview's layout in placeholder blocks. */
function SeatMapSkeleton({ width }: { width: number }) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      progress.set(0);
      return;
    }
    progress.set(withRepeat(withTiming(1, { duration: primitives['duration/celebrate'] }), -1, true));
  }, [progress, reducedMotion]);

  const scale = overviewScaleFor(SKELETON_ROWS * SKELETON_PER_ROW, rowWidth(SKELETON_PER_ROW), width);
  const size = SEAT_SIZE * scale;
  const gap = SEAT_GAP * scale;
  const aisle = AISLE_WIDTH * scale;
  const half = SKELETON_PER_ROW / 2;

  const block = (key: string) =>
    reducedMotion ? (
      <View key={key} style={{ width: size, height: size, borderRadius: primitives['radius/sm'], backgroundColor: colors['skeleton/base'] }} />
    ) : (
      <SkeletonBlock key={key} progress={progress} size={size} />
    );

  return (
    <View accessible accessibilityLabel="Loading seat map" accessibilityState={{ busy: true }} style={styles.root}>
      <View style={styles.screen}>
        <View style={[styles.arc, { backgroundColor: colors['skeleton/base'] }]} />
        <View style={[styles.arcLabel, { backgroundColor: colors['skeleton/base'] }]} />
      </View>
      <View style={[styles.skeletonRows, { gap }]}>
        {Array.from({ length: SKELETON_ROWS }, (_, r) => (
          <View key={r} style={[styles.skeletonRow, { gap }]}>
            {Array.from({ length: half }, (_, c) => block(`l${c}`))}
            <View style={{ width: aisle }} />
            {Array.from({ length: half }, (_, c) => block(`r${c}`))}
          </View>
        ))}
      </View>
    </View>
  );
}

// ---- Public component -----------------------------------------------------------------------------

/**
 * The seat map: the whole room at a glance, zoomable to full-size, tappable seats (Figma `SeatMap`,
 * 54:4988; ADR 0014).
 *
 * - **Overview**: every seat on one screen at 0.5× (0.3× for a 300+ seat room). Seats are not tappable
 *   one by one: a tap zooms in on that part of the room.
 * - **Zoomed**: full-size seats you can tap, row letters, a mini-map, and Plus and Minus. Pinch and pan
 *   move the map; a pinch settles on the Overview, full size, or one step further in.
 * - **Skeleton**: placeholders in the Overview's layout while the room loads.
 *
 * It draws what the server says. Seat state comes from `rows`; the map never decides availability, and
 * never does money maths. Selection is the screen's: this component reports taps and draws picks.
 */
export function SeatMap(props: SeatMapProps) {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(Math.floor(event.nativeEvent.layout.width));
  }, []);

  let body = null;
  if (width > 0) {
    body =
      props.loading || !props.rows ? (
        <SeatMapSkeleton width={width} />
      ) : (
        <SeatMapReady key={width} {...props} rows={props.rows} width={width} />
      );
  }
  return (
    <View onLayout={onLayout} style={styles.wrapper}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  root: {
    gap: primitives['space/4'],
    alignItems: 'center',
  },
  screen: {
    width: '100%',
    alignItems: 'center',
    gap: primitives['space/1'],
  },
  arc: {
    width: '72%',
    height: primitives['space/2'],
    borderRadius: primitives['radius/full'],
  },
  arcLabel: {
    width: primitives['space/10'],
    height: primitives['space/3'],
    borderRadius: primitives['radius/sm'],
  },
  viewport: {
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    gap: SEAT_GAP,
    transformOrigin: 'left top',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SEAT_GAP,
  },
  aisle: {
    width: AISLE_WIDTH,
    height: SEAT_SIZE,
  },
  gutterLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: GUTTER_LEFT,
    overflow: 'hidden',
  },
  label: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: primitives['space/3'],
    height: SEAT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gutterRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: GUTTER_RIGHT,
    paddingLeft: primitives['space/2'],
    alignItems: 'center',
    gap: primitives['space/2'],
  },
  minimap: {
    width: primitives['size/touch-min'],
    height: primitives['size/touch-min'] + primitives['space/6'],
    padding: primitives['space/1'],
    borderWidth: primitives['border-width/default'],
    borderRadius: primitives['radius/sm'],
    overflow: 'hidden',
  },
  minimapDots: {
    gap: MINIMAP_DOT,
  },
  minimapRow: {
    flexDirection: 'row',
    gap: MINIMAP_DOT,
  },
  minimapDot: {
    width: MINIMAP_DOT,
    height: MINIMAP_DOT,
  },
  minimapViewport: {
    position: 'absolute',
    borderWidth: primitives['border-width/strong'],
    borderRadius: primitives['radius/sm'],
  },
  zoomButton: {
    width: primitives['size/touch-min'],
    height: primitives['size/touch-min'],
    borderRadius: primitives['radius/full'],
    borderWidth: primitives['border-width/default'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonRows: {
    alignItems: 'center',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
