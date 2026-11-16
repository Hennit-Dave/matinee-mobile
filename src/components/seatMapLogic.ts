import { primitives } from '../tokens/tokens';
import { formatShortDateLabel } from '../api/movieDetailHelpers';
import type { ShowtimeSeat, ShowtimeSeatRow } from '../api/seats';

/**
 * The seat map's decisions, free of React Native so they can be unit-tested with `node --test` (there is
 * no RN renderer in this repo, ADR 0005): the seat look for each state, the layout of a room, how zoom
 * and pan are clamped, which seat a tap lands on, what the footer says. Functions marked 'worklet' also
 * run on the UI thread inside the gesture handlers, so they touch only their arguments.
 *
 * The geometry follows the Figma `SeatMap` (54:4988) and `SeatMap/Seat` (19:58) components.
 */

// ---- Geometry -------------------------------------------------------------------------------------

export const SEAT_SIZE = primitives['size/seat'];
export const SEAT_GAP = primitives['size/seat-gap'];
/** Distance from one seat's left edge to the next one's. */
export const SEAT_PITCH = SEAT_SIZE + SEAT_GAP;
/**
 * Width of the centre aisle at zoomed scale. It is twice the aisle Figma draws at 0.5× (20), so the
 * Overview of a 14-seat row is exactly as drawn. The aisle is not in the data: it sits after seat
 * `ceil(n / 2)` of every row (ADR 0014).
 */
export const AISLE_WIDTH = primitives['space/10'];
/** From the right edge of the last seat before the aisle to the first seat after it. */
const AISLE_STEP = AISLE_WIDTH + SEAT_GAP;

/** The Overview draws seats at half size ("0.5× seats" in the Figma description), a 300+ seat room at 0.3×. */
export const OVERVIEW_SCALE = 0.5;
export const LARGE_ROOM_OVERVIEW_SCALE = 0.3;
export const LARGE_ROOM_SEATS = 300;
export const ZOOMED_SCALE = 1;
/** Plus takes a zoomed map one step further, so it is never a dead control. Seats are 54 at this scale. */
export const MAX_ZOOM_SCALE = 1.5;

/** Zoomed shows six rows (Figma: 6 × 36 plus 5 × 8 = 256). */
export const ZOOM_WINDOW_ROWS = 6;

/** Room for the row letters left of the seats (12 wide, 4 gap) and the controls to the right (8 gap, 48 wide). */
export const GUTTER_LEFT = primitives['space/3'] + primitives['space/1'];
export const GUTTER_RIGHT = primitives['space/2'] + primitives['size/touch-min'];

/** A UI guard only: the server owns the real limit. */
export const MAX_SEATS_PER_BOOKING = 8;

export interface MapLayout {
  rowLengths: readonly number[];
  contentWidth: number;
  contentHeight: number;
}

export function aisleAfter(rowLength: number): number {
  return Math.ceil(rowLength / 2);
}

/** A row of `rowLength` seats plus the aisle: `rowLength + 1` children with a gap between each pair. */
export function rowWidth(rowLength: number): number {
  return rowLength * SEAT_PITCH + AISLE_WIDTH;
}

/** Left edge of a seat inside its own row (before the row is centred in the map). */
export function seatLeftInRow(rowLength: number, seatIndex: number): number {
  return seatIndex * SEAT_PITCH + (seatIndex >= aisleAfter(rowLength) ? AISLE_STEP : 0);
}

export function buildMapLayout(rows: readonly ShowtimeSeatRow[]): MapLayout {
  const rowLengths = rows.map((row) => row.seats.length);
  const contentWidth = rowLengths.reduce((widest, length) => Math.max(widest, rowWidth(length)), 0);
  const contentHeight = rows.length > 0 ? rows.length * SEAT_PITCH - SEAT_GAP : 0;
  return { rowLengths, contentWidth, contentHeight };
}

/** Left edge of a seat in map coordinates (rows are centred in the map). */
export function seatLeft(layout: MapLayout, rowIndex: number, seatIndex: number): number {
  const length = layout.rowLengths[rowIndex] ?? 0;
  return (layout.contentWidth - rowWidth(length)) / 2 + seatLeftInRow(length, seatIndex);
}

export function rowTop(rowIndex: number): number {
  return rowIndex * SEAT_PITCH;
}

export interface SeatPosition {
  rowIndex: number;
  seatIndex: number;
}

/**
 * Which seat a point lands on, in map coordinates (before any zoom). The nearest seat centre wins
 * (COMPONENTS.md: "the nearest seat centre wins"), as long as the point is within half a seat pitch of
 * it. A point in the aisle, or past the edge of the room, lands on nothing.
 */
export function hitTestSeat(layout: MapLayout, x: number, y: number): SeatPosition | null {
  const rowCount = layout.rowLengths.length;
  if (rowCount === 0) return null;

  const half = SEAT_PITCH / 2;
  const rowIndex = Math.round((y - SEAT_SIZE / 2) / SEAT_PITCH);
  if (rowIndex < 0 || rowIndex >= rowCount) return null;
  if (Math.abs(y - (rowTop(rowIndex) + SEAT_SIZE / 2)) > half) return null;

  const length = layout.rowLengths[rowIndex] ?? 0;
  let best: SeatPosition | null = null;
  let bestDistance = Infinity;
  for (let seatIndex = 0; seatIndex < length; seatIndex++) {
    const distance = Math.abs(x - (seatLeft(layout, rowIndex, seatIndex) + SEAT_SIZE / 2));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { rowIndex, seatIndex };
    }
  }
  return best && bestDistance <= half ? best : null;
}

// ---- What a seat looks like -----------------------------------------------------------------------

/** The six looks in Figma `SeatMap/Seat`: shape carries the state, colour only reinforces it. */
export type SeatVisualState = 'available' | 'selected' | 'held' | 'sold' | 'accessible' | 'accessible-selected';

export const SEAT_VISUAL_STATES: readonly SeatVisualState[] = [
  'available',
  'selected',
  'held',
  'sold',
  'accessible',
  'accessible-selected',
];

/**
 * The look of one seat. Selection (client state) only applies to a seat the server says is available:
 * a seat that is held or sold is drawn as such, whatever the user had picked. Figma draws held and sold
 * the same for every kind of seat (there is no held or sold wheelchair look).
 */
export function seatVisualState(seat: Pick<ShowtimeSeat, 'kind' | 'status'>, selected: boolean): SeatVisualState {
  if (seat.status === 'sold') return 'sold';
  if (seat.status === 'held') return 'held';
  const wheelchair = seat.kind === 'wheelchair';
  if (selected) return wheelchair ? 'accessible-selected' : 'selected';
  return wheelchair ? 'accessible' : 'available';
}

/** The legend, in the order and words of Figma `SeatMap/Legend` (19:59): one entry per seat look. */
export const SEAT_LEGEND_ITEMS: readonly { state: SeatVisualState; label: string }[] = [
  { state: 'available', label: 'Available' },
  { state: 'selected', label: 'Yours' },
  { state: 'held', label: 'Held' },
  { state: 'sold', label: 'Sold' },
  { state: 'accessible', label: 'Wheelchair space' },
  { state: 'accessible-selected', label: 'Wheelchair space, yours' },
];

export function isSeatSelectable(seat: Pick<ShowtimeSeat, 'status'>): boolean {
  return seat.status === 'available';
}

/** "D8". */
export function seatName(seat: Pick<ShowtimeSeat, 'row' | 'number'>): string {
  return `${seat.row}${seat.number}`;
}

/** "Row D, seat 8, available" (COMPONENTS.md: announce row, number and state). */
export function seatAccessibilityLabel(seat: Pick<ShowtimeSeat, 'row' | 'number' | 'kind'>, state: SeatVisualState): string {
  const parts = [`Row ${seat.row}, seat ${seat.number}`];
  if (seat.kind === 'wheelchair') parts.push('wheelchair space');
  if (state === 'selected' || state === 'accessible-selected') parts.push('selected');
  else if (state === 'held') parts.push('held by someone else');
  else if (state === 'sold') parts.push('sold');
  else parts.push('available');
  return parts.join(', ');
}

// ---- Selection ------------------------------------------------------------------------------------

export interface SelectionChange {
  next: string[];
  /** True when the pick was refused because the limit is reached. */
  limitReached: boolean;
}

export function toggleSeatSelection(
  selected: readonly string[],
  seatId: string,
  max: number = MAX_SEATS_PER_BOOKING
): SelectionChange {
  if (selected.includes(seatId)) {
    return { next: selected.filter((id) => id !== seatId), limitReached: false };
  }
  if (selected.length >= max) return { next: [...selected], limitReached: true };
  return { next: [...selected, seatId], limitReached: false };
}

export type SelectionHaptic = 'selection' | 'warning';

/**
 * Which haptic a tap on a seat earns: a light selection tick for a pick or a drop, and a warning when
 * the seat cap refuses a pick. A tap that changes nothing (a sold seat, the Overview zooming) never
 * reaches here, so it earns none.
 */
export function selectionHaptic(change: SelectionChange): SelectionHaptic {
  return change.limitReached ? 'warning' : 'selection';
}

/** Drops picks that are no longer available (for example after a refresh), keeping the order. */
export function pruneUnavailable(selected: readonly string[], rows: readonly ShowtimeSeatRow[]): string[] {
  const available = new Set<string>();
  for (const row of rows) {
    for (const seat of row.seats) {
      if (isSeatSelectable(seat)) available.add(seat.id);
    }
  }
  const kept = selected.filter((id) => available.has(id));
  return kept.length === selected.length ? (selected as string[]) : kept;
}

/** The picked seats' names in room order (row A first, left to right), whatever order they were picked in. */
export function selectedSeatNames(rows: readonly ShowtimeSeatRow[], selectedIds: readonly string[]): string[] {
  if (selectedIds.length === 0) return [];
  const picked = new Set(selectedIds);
  const names: string[] = [];
  for (const row of rows) {
    for (const seat of row.seats) {
      if (picked.has(seat.id)) names.push(seatName(seat));
    }
  }
  return names;
}

/** The footer's first line: "2 seats · D8, D9". The price on the second line is the server's string. */
export function summarySeatsLine(names: readonly string[]): string {
  if (names.length === 0) return 'No seats picked yet';
  return `${names.length} ${names.length === 1 ? 'seat' : 'seats'} · ${names.join(', ')}`;
}

/** The screen header's second line: "The Lantern Road · Sat 14, 20:00 · IMAX" (the title is optional). */
export function composeSeatingSubtitle(parts: { title?: string | null; startsAt: string; time: string; format: string }): string {
  const day = formatShortDateLabel(parts.startsAt.slice(0, 10));
  const when = `${day}, ${parts.time}`;
  return [parts.title?.trim() || null, when, parts.format].filter((part): part is string => Boolean(part)).join(' · ');
}

// ---- Zoom and pan ---------------------------------------------------------------------------------

/**
 * The scale of the whole-room Overview: half-size seats, 0.3× for a 300+ seat room (Figma), shrunk
 * further if the room is too wide to fit the window at that size.
 */
export function overviewScaleFor(totalSeats: number, contentWidth: number, windowWidth: number): number {
  const spec = totalSeats >= LARGE_ROOM_SEATS ? LARGE_ROOM_OVERVIEW_SCALE : OVERVIEW_SCALE;
  if (contentWidth <= 0 || windowWidth <= 0) return spec;
  return Math.min(spec, windowWidth / contentWidth);
}

/** The three scales the map rests at: the Overview, zoomed (full-size seats), and one step further in. */
export function zoomStops(minScale: number): readonly number[] {
  return [minScale, ZOOMED_SCALE, MAX_ZOOM_SCALE];
}

/** Zoomed (seats tappable, row letters and controls shown) from halfway between the Overview and full size. */
export function isZoomedScale(scale: number, minScale: number): boolean {
  'worklet';
  return scale >= (minScale + ZOOMED_SCALE) / 2;
}

/** The resting scale nearest to where a pinch ended. */
export function nearestStop(scale: number, minScale: number): number {
  'worklet';
  const stops = [minScale, ZOOMED_SCALE, MAX_ZOOM_SCALE];
  let best = stops[0]!;
  let bestDistance = Math.abs(scale - best);
  for (let i = 1; i < stops.length; i++) {
    const distance = Math.abs(scale - stops[i]!);
    if (distance < bestDistance) {
      best = stops[i]!;
      bestDistance = distance;
    }
  }
  return best;
}

/** The stop after `scale` going in (Plus) or out (Minus); stays put at either end. */
export function stepStop(scale: number, minScale: number, direction: 'in' | 'out'): number {
  const stops = zoomStops(minScale);
  const epsilon = 0.001;
  if (direction === 'in') return stops.find((stop) => stop > scale + epsilon) ?? scale;
  return [...stops].reverse().find((stop) => stop < scale - epsilon) ?? scale;
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/**
 * Keeps the map inside its window. When the scaled map is smaller than the window on this axis it is
 * centred; otherwise its edges may not move past the window's edges.
 */
export function clampTranslate(
  translate: number,
  scale: number,
  contentSize: number,
  windowStart: number,
  windowSize: number
): number {
  'worklet';
  const scaled = contentSize * scale;
  if (scaled <= windowSize) return windowStart + (windowSize - scaled) / 2;
  return Math.min(windowStart, Math.max(windowStart + windowSize - scaled, translate));
}

/** The translation that puts map coordinate `focus` in the middle of the window (clamped). */
export function focusTranslate(
  focus: number,
  scale: number,
  contentSize: number,
  windowStart: number,
  windowSize: number
): number {
  'worklet';
  return clampTranslate(windowStart + windowSize / 2 - focus * scale, scale, contentSize, windowStart, windowSize);
}

export interface MapWindow {
  start: number;
  size: number;
}

export function overviewWindow(width: number): MapWindow {
  return { start: 0, size: width };
}

/** Zoomed leaves room for the row letters and the controls. */
export function zoomedWindow(width: number): MapWindow {
  return { start: GUTTER_LEFT, size: Math.max(0, width - GUTTER_LEFT - GUTTER_RIGHT) };
}

export function zoomedWindowHeight(contentHeight: number): number {
  return Math.min(contentHeight, ZOOM_WINDOW_ROWS * SEAT_PITCH - SEAT_GAP);
}

/** The visible part of the map as fractions (0 to 1) of its size on one axis. */
export function visibleFraction(
  contentSize: number,
  scale: number,
  translate: number,
  windowStart: number,
  windowSize: number
): { start: number; size: number } {
  'worklet';
  const scaled = contentSize * scale;
  if (scaled <= 0) return { start: 0, size: 1 };
  const start = clamp((windowStart - translate) / scaled, 0, 1);
  const size = clamp(windowSize / scaled, 0, 1 - start);
  return { start, size };
}

export function findSeatPosition(rows: readonly ShowtimeSeatRow[], seatId: string): SeatPosition | null {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const seatIndex = rows[rowIndex]!.seats.findIndex((seat) => seat.id === seatId);
    if (seatIndex >= 0) return { rowIndex, seatIndex };
  }
  return null;
}

export interface MapView {
  scale: number;
  tx: number;
  ty: number;
  zoomed: boolean;
}

/**
 * Where the map starts: the whole-room Overview, or (when given a seat) zoomed in with that seat in the
 * middle of the window. The gallery uses the second form to show the zoomed level without a gesture.
 */
export function initialMapView(
  layout: MapLayout,
  rows: readonly ShowtimeSeatRow[],
  width: number,
  minScale: number,
  zoomedSeatId?: string
): MapView {
  const found = zoomedSeatId ? findSeatPosition(rows, zoomedSeatId) : null;
  if (found) {
    const window = zoomedWindow(width);
    const height = zoomedWindowHeight(layout.contentHeight);
    const centreX = seatLeft(layout, found.rowIndex, found.seatIndex) + SEAT_SIZE / 2;
    const centreY = rowTop(found.rowIndex) + SEAT_SIZE / 2;
    return {
      scale: ZOOMED_SCALE,
      tx: focusTranslate(centreX, ZOOMED_SCALE, layout.contentWidth, window.start, window.size),
      ty: focusTranslate(centreY, ZOOMED_SCALE, layout.contentHeight, 0, height),
      zoomed: true,
    };
  }
  const window = overviewWindow(width);
  const height = Math.ceil(layout.contentHeight * minScale);
  return {
    scale: minScale,
    tx: clampTranslate(0, minScale, layout.contentWidth, window.start, window.size),
    ty: clampTranslate(0, minScale, layout.contentHeight, 0, height),
    zoomed: false,
  };
}

// ---- Mini-map -------------------------------------------------------------------------------------

export const MINIMAP_COLUMNS = 5;
export const MINIMAP_ROWS = 8;

/**
 * The mini-map's dots, `MINIMAP_ROWS` x `MINIMAP_COLUMNS`: each stands for a block of the room and is
 * `true` when any seat in that block can still be picked.
 */
export function minimapDots(rows: readonly ShowtimeSeatRow[]): boolean[][] {
  const dots = Array.from({ length: MINIMAP_ROWS }, () => Array.from({ length: MINIMAP_COLUMNS }, () => false));
  rows.forEach((row, rowIndex) => {
    const blockRow = Math.min(MINIMAP_ROWS - 1, Math.floor((rowIndex / rows.length) * MINIMAP_ROWS));
    row.seats.forEach((seat, seatIndex) => {
      if (!isSeatSelectable(seat)) return;
      const blockColumn = Math.min(MINIMAP_COLUMNS - 1, Math.floor((seatIndex / row.seats.length) * MINIMAP_COLUMNS));
      dots[blockRow]![blockColumn] = true;
    });
  });
  return dots;
}

// ---- Motion ---------------------------------------------------------------------------------------

/** `"cubic-bezier(0.2, 0, 0, 1)"` (the form of the easing tokens) to the four numbers Easing.bezier takes. */
export function parseCubicBezier(value: string): [number, number, number, number] {
  const match = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/.exec(value);
  if (!match) throw new Error(`Not a cubic-bezier easing: "${value}"`);
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
}
