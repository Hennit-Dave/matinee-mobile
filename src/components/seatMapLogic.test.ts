import { test } from 'node:test';
import assert from 'node:assert/strict';
import { primitives } from '../tokens/tokens';
import type { SeatKind, SeatStatus, ShowtimeSeat, ShowtimeSeatRow } from '../api/seats';
import {
  AISLE_WIDTH,
  GUTTER_LEFT,
  GUTTER_RIGHT,
  MAX_SEATS_PER_BOOKING,
  MINIMAP_COLUMNS,
  MINIMAP_ROWS,
  SEAT_GAP,
  SEAT_LEGEND_ITEMS,
  SEAT_PITCH,
  SEAT_SIZE,
  SEAT_VISUAL_STATES,
  aisleAfter,
  buildMapLayout,
  clampTranslate,
  composeSeatingSubtitle,
  focusTranslate,
  findLostPicks,
  findSeatPosition,
  hitTestSeat,
  initialMapView,
  isZoomedScale,
  minimapDots,
  nearestStop,
  overviewScaleFor,
  overviewWindow,
  parseCubicBezier,
  pruneUnavailable,
  rowTop,
  rowWidth,
  seatAccessibilityLabel,
  seatLeft,
  seatLeftInRow,
  seatName,
  seatVisualState,
  selectedSeatNames,
  selectionHaptic,
  stepStop,
  summarySeatsLine,
  takenSeatsMessage,
  toggleSeatSelection,
  visibleFraction,
  withOwnHold,
  zoomStops,
  zoomedWindow,
  zoomedWindowHeight,
} from './seatMapLogic';

/** A room of `rowCount` rows A.. of `perRow` seats. Seat ids are "A-1" style, so tests can name them. */
function room(
  rowCount: number,
  perRow: number,
  overrides: Record<string, { status?: SeatStatus; kind?: SeatKind }> = {}
): ShowtimeSeatRow[] {
  return Array.from({ length: rowCount }, (_, r) => {
    const row = String.fromCharCode(65 + r);
    const seats: ShowtimeSeat[] = Array.from({ length: perRow }, (_, i) => {
      const id = `${row}-${i + 1}`;
      return { id, row, number: i + 1, kind: overrides[id]?.kind ?? 'standard', status: overrides[id]?.status ?? 'available' };
    });
    return { row, seats };
  });
}

// ---- Geometry -------------------------------------------------------------------------------------

test('the seat is 36 with an 8 gap (a 44 pitch), straight from the tokens', () => {
  assert.equal(SEAT_SIZE, 36);
  assert.equal(SEAT_GAP, 8);
  assert.equal(SEAT_PITCH, 44);
});

test('the aisle sits after ceil(n / 2) seats', () => {
  assert.equal(aisleAfter(20), 10);
  assert.equal(aisleAfter(14), 7);
  assert.equal(aisleAfter(12), 6);
  assert.equal(aisleAfter(5), 3);
});

test('a row is its seats and one aisle with a gap between each pair', () => {
  assert.equal(rowWidth(14), 14 * 44 + AISLE_WIDTH);
  assert.equal(rowWidth(20), 920);
});

test('seats before the aisle sit on the 44 pitch; seats after it are pushed by the aisle and a gap', () => {
  // A 14-seat row: seat index 6 is the last before the aisle, 7 the first after.
  assert.equal(seatLeftInRow(14, 0), 0);
  assert.equal(seatLeftInRow(14, 6), 264);
  assert.equal(seatLeftInRow(14, 7), 7 * 44 + AISLE_WIDTH + SEAT_GAP);
  // Between the two seats beside the aisle: a gap, the aisle, a gap.
  const gapAcross = seatLeftInRow(14, 7) - (seatLeftInRow(14, 6) + SEAT_SIZE);
  assert.equal(gapAcross, SEAT_GAP + AISLE_WIDTH + SEAT_GAP);
  // The last seat ends exactly at the row's width.
  assert.equal(seatLeftInRow(14, 13) + SEAT_SIZE, rowWidth(14));
});

test('the layout of the 320-seat IMAX room (16 rows x 20) is 920 x 696', () => {
  const layout = buildMapLayout(room(16, 20));
  assert.equal(layout.contentWidth, 920);
  assert.equal(layout.contentHeight, 16 * 36 + 15 * 8);
  assert.equal(layout.rowLengths.length, 16);
});

test('an empty room has no size, and a short row is centred in the map', () => {
  assert.deepEqual(buildMapLayout([]), { rowLengths: [], contentWidth: 0, contentHeight: 0 });
  const rows = [room(1, 20)[0]!, room(1, 12)[0]!];
  const layout = buildMapLayout(rows);
  assert.equal(layout.contentWidth, rowWidth(20));
  assert.equal(seatLeft(layout, 0, 0), 0);
  assert.equal(seatLeft(layout, 1, 0), (rowWidth(20) - rowWidth(12)) / 2);
  assert.equal(rowTop(2), 88);
});

// ---- Overview scale: the Figma sizes -------------------------------------------------------------

test('a 14-seat row at the half-size Overview is exactly the 328 wide the Figma Overview draws', () => {
  const scale = overviewScaleFor(126, rowWidth(14), 328);
  assert.equal(scale, 0.5);
  assert.equal(rowWidth(14) * scale, 328);
  assert.equal(SEAT_SIZE * scale, 18, 'seats are 18, as in Overview');
  assert.equal(SEAT_GAP * scale, 4, 'gaps are 4');
  assert.equal(AISLE_WIDTH * scale, 20, 'the aisle is 20');
});

test('a 300+ seat room draws seats at 0.3x, which is 10.8, as in the Figma 300+ frame', () => {
  const scale = overviewScaleFor(320, rowWidth(20), 328);
  assert.equal(scale, 0.3);
  assert.ok(Math.abs(SEAT_SIZE * scale - 10.8) < 1e-9);
});

test('a room too wide for the half-size Overview shrinks until it fits, and never overflows', () => {
  const scale = overviewScaleFor(180, rowWidth(18), 328); // NFT1: 10 rows x 18, under 300 seats
  assert.ok(scale < 0.5);
  assert.ok(rowWidth(18) * scale <= 328 + 1e-9);
  assert.ok(Math.abs(rowWidth(18) * scale - 328) < 1e-9, 'it fills the window exactly');
});

test('overviewScaleFor falls back to the spec scale before the width is known', () => {
  assert.equal(overviewScaleFor(126, 0, 0), 0.5);
  assert.equal(overviewScaleFor(320, 920, 0), 0.3);
});

// ---- Zoom stops -----------------------------------------------------------------------------------

test('the map rests at three scales: the Overview, full-size seats, and one step further in', () => {
  assert.deepEqual(zoomStops(0.5), [0.5, 1, 1.5]);
  assert.deepEqual(zoomStops(0.3), [0.3, 1, 1.5]);
});

test('zoomed starts halfway between the Overview and full size', () => {
  assert.equal(isZoomedScale(0.74, 0.5), false);
  assert.equal(isZoomedScale(0.75, 0.5), true);
  assert.equal(isZoomedScale(0.64, 0.3), false);
  assert.equal(isZoomedScale(0.65, 0.3), true);
  assert.equal(isZoomedScale(1, 0.3), true);
});

test('a pinch settles on the nearest stop', () => {
  assert.equal(nearestStop(0.55, 0.5), 0.5);
  assert.equal(nearestStop(0.8, 0.5), 1);
  assert.equal(nearestStop(1.2, 0.5), 1);
  assert.equal(nearestStop(1.3, 0.5), 1.5);
  assert.equal(nearestStop(0.1, 0.3), 0.3);
});

test('Plus and Minus step along the stops and stay put at either end (Plus is never dead while zoomed)', () => {
  assert.equal(stepStop(0.5, 0.5, 'in'), 1);
  assert.equal(stepStop(1, 0.5, 'in'), 1.5);
  assert.equal(stepStop(1.5, 0.5, 'in'), 1.5, 'at the limit it stays');
  assert.equal(stepStop(1.5, 0.5, 'out'), 1);
  assert.equal(stepStop(1, 0.5, 'out'), 0.5);
  assert.equal(stepStop(0.5, 0.5, 'out'), 0.5, 'at the Overview it stays');
});

// ---- Pan limits -----------------------------------------------------------------------------------

test('a map smaller than its window is centred, and cannot be panned', () => {
  // 328 wide at scale 0.5 = 164 inside a 328 window: centred.
  assert.equal(clampTranslate(-50, 0.25, 656, 0, 328), (328 - 164) / 2);
  assert.equal(clampTranslate(999, 0.25, 656, 0, 328), (328 - 164) / 2);
});

test('a map larger than its window may not be dragged past its edges', () => {
  // 656 at scale 1 inside a 256 window that starts at 16: left edge max 16, right edge min 16 + 256 - 656.
  assert.equal(clampTranslate(500, 1, 656, 16, 256), 16);
  assert.equal(clampTranslate(-9999, 1, 656, 16, 256), 16 + 256 - 656);
  assert.equal(clampTranslate(-100, 1, 656, 16, 256), -100);
});

test('focusTranslate centres a map point in the window, then clamps at the edges', () => {
  // Point 328 of a 656-wide map at scale 1, in a 256 window starting at 16: translate = 16 + 128 - 328.
  assert.equal(focusTranslate(328, 1, 656, 16, 256), 16 + 128 - 328);
  // Near the left edge it clamps rather than showing empty space.
  assert.equal(focusTranslate(10, 1, 656, 16, 256), 16);
  // Near the right edge too.
  assert.equal(focusTranslate(650, 1, 656, 16, 256), 16 + 256 - 656);
});

test('the windows: Overview is the full width, zoomed leaves room for the row letters and the controls', () => {
  assert.deepEqual(overviewWindow(328), { start: 0, size: 328 });
  assert.equal(GUTTER_LEFT, 16);
  assert.equal(GUTTER_RIGHT, 56);
  // 328 - 16 - 56 = 256 = six seats and five gaps, as Figma's zoomed window.
  assert.deepEqual(zoomedWindow(328), { start: 16, size: 256 });
  assert.equal(256, 6 * SEAT_SIZE + 5 * SEAT_GAP);
  assert.equal(zoomedWindowHeight(696), 256);
  assert.equal(zoomedWindowHeight(100), 100, 'a room shorter than six rows is not padded');
});

test('visibleFraction reports which part of the map the window shows', () => {
  // Whole map visible when it fits.
  assert.deepEqual(visibleFraction(656, 0.5, 0, 0, 328), { start: 0, size: 1 });
  // Zoomed at scale 1, panned so the left edge of the map is at the window start: the first 256 of 656.
  const left = visibleFraction(656, 1, 16, 16, 256);
  assert.equal(left.start, 0);
  assert.ok(Math.abs(left.size - 256 / 656) < 1e-9);
  // Panned to the far right: the last 256.
  const right = visibleFraction(656, 1, 16 + 256 - 656, 16, 256);
  assert.ok(Math.abs(right.start - 400 / 656) < 1e-9);
  assert.ok(Math.abs(right.start + right.size - 1) < 1e-9);
});

// ---- Hit-testing ----------------------------------------------------------------------------------

test('a tap on a seat finds that seat', () => {
  const layout = buildMapLayout(room(10, 14));
  const centre = (r: number, i: number) => ({ x: seatLeft(layout, r, i) + SEAT_SIZE / 2, y: rowTop(r) + SEAT_SIZE / 2 });
  for (const [r, i] of [[0, 0], [3, 6], [3, 7], [9, 13], [5, 10]] as const) {
    const { x, y } = centre(r, i);
    assert.deepEqual(hitTestSeat(layout, x, y), { rowIndex: r, seatIndex: i }, `seat ${r},${i}`);
  }
});

test('in the gap between two seats the nearest centre wins', () => {
  const layout = buildMapLayout(room(2, 14));
  const gapY = rowTop(0) + SEAT_SIZE / 2;
  const leftEdge = seatLeft(layout, 0, 2) + SEAT_SIZE; // right edge of seat 2
  assert.equal(hitTestSeat(layout, leftEdge + 1, gapY)?.seatIndex, 2, 'just right of seat 2 is still seat 2');
  assert.equal(hitTestSeat(layout, leftEdge + SEAT_GAP - 1, gapY)?.seatIndex, 3, 'just left of seat 3 is seat 3');
});

test('a tap in the aisle, or outside the room, lands on nothing', () => {
  const layout = buildMapLayout(room(10, 14));
  const aisleCentreX = seatLeft(layout, 0, 6) + SEAT_SIZE + SEAT_GAP + AISLE_WIDTH / 2;
  assert.equal(hitTestSeat(layout, aisleCentreX, SEAT_SIZE / 2), null);
  assert.equal(hitTestSeat(layout, -30, SEAT_SIZE / 2), null);
  assert.equal(hitTestSeat(layout, layout.contentWidth + 30, SEAT_SIZE / 2), null);
  assert.equal(hitTestSeat(layout, 100, -30), null);
  assert.equal(hitTestSeat(layout, 100, layout.contentHeight + 30), null);
  assert.equal(hitTestSeat(buildMapLayout([]), 10, 10), null);
});

// ---- Seat looks -----------------------------------------------------------------------------------

test('every Figma seat look is reachable and distinct', () => {
  const looks = new Set<string>();
  looks.add(seatVisualState({ kind: 'standard', status: 'available' }, false));
  looks.add(seatVisualState({ kind: 'standard', status: 'available' }, true));
  looks.add(seatVisualState({ kind: 'standard', status: 'held' }, false));
  looks.add(seatVisualState({ kind: 'standard', status: 'sold' }, false));
  looks.add(seatVisualState({ kind: 'wheelchair', status: 'available' }, false));
  looks.add(seatVisualState({ kind: 'wheelchair', status: 'available' }, true));
  assert.deepEqual([...looks].sort(), [...SEAT_VISUAL_STATES].sort());
});

test('the legend shows every seat look exactly once, in the words Figma uses', () => {
  assert.deepEqual(
    [...SEAT_LEGEND_ITEMS.map((item) => item.state)].sort(),
    [...SEAT_VISUAL_STATES].sort()
  );
  assert.deepEqual(
    SEAT_LEGEND_ITEMS.map((item) => item.label),
    ['Available', 'Yours', 'Held', 'Sold', 'Wheelchair space', 'Wheelchair space, yours']
  );
});

test('selection only applies to an available seat: held and sold seats look held and sold whatever was picked', () => {
  assert.equal(seatVisualState({ kind: 'standard', status: 'sold' }, true), 'sold');
  assert.equal(seatVisualState({ kind: 'standard', status: 'held' }, true), 'held');
  assert.equal(seatVisualState({ kind: 'wheelchair', status: 'sold' }, false), 'sold');
  assert.equal(seatVisualState({ kind: 'wheelchair', status: 'held' }, false), 'held');
});

test('screen readers hear the row, the seat number, the kind, and the state', () => {
  const d8 = { row: 'D', number: 8, kind: 'standard' as const };
  assert.equal(seatAccessibilityLabel(d8, 'available'), 'Row D, seat 8, available');
  assert.equal(seatAccessibilityLabel(d8, 'selected'), 'Row D, seat 8, selected');
  assert.equal(seatAccessibilityLabel(d8, 'held'), 'Row D, seat 8, held by someone else');
  assert.equal(seatAccessibilityLabel(d8, 'sold'), 'Row D, seat 8, sold');
  const p1 = { row: 'P', number: 1, kind: 'wheelchair' as const };
  assert.equal(seatAccessibilityLabel(p1, 'accessible'), 'Row P, seat 1, wheelchair space, available');
  assert.equal(seatAccessibilityLabel(p1, 'accessible-selected'), 'Row P, seat 1, wheelchair space, selected');
  assert.equal(seatName(d8), 'D8');
});

// ---- Selection ------------------------------------------------------------------------------------

test('tapping a seat picks it, tapping it again drops it, and picks keep their order', () => {
  let selected: string[] = [];
  selected = toggleSeatSelection(selected, 'D-8').next;
  selected = toggleSeatSelection(selected, 'D-9').next;
  assert.deepEqual(selected, ['D-8', 'D-9']);
  const dropped = toggleSeatSelection(selected, 'D-8');
  assert.deepEqual(dropped.next, ['D-9']);
  assert.equal(dropped.limitReached, false);
});

test('the limit refuses a ninth seat, says so, and still lets you drop one', () => {
  assert.equal(MAX_SEATS_PER_BOOKING, 8);
  const full = Array.from({ length: 8 }, (_, i) => `A-${i + 1}`);
  const refused = toggleSeatSelection(full, 'B-1');
  assert.equal(refused.limitReached, true);
  assert.deepEqual(refused.next, full);
  assert.notEqual(refused.next, full, 'a copy, never the same array');
  assert.deepEqual(toggleSeatSelection(full, 'A-1').next.length, 7);
  assert.equal(toggleSeatSelection(full, 'B-1', 9).limitReached, false, 'the limit is a parameter');
});

test('haptics: a pick and a drop earn the selection tick, and only the cap earns the warning', () => {
  const picked = toggleSeatSelection([], 'D-8');
  assert.equal(selectionHaptic(picked), 'selection');
  assert.equal(selectionHaptic(toggleSeatSelection(picked.next, 'D-8')), 'selection', 'dropping a seat ticks too');
  const full = Array.from({ length: MAX_SEATS_PER_BOOKING }, (_, i) => `A-${i + 1}`);
  assert.equal(selectionHaptic(toggleSeatSelection(full, 'B-1')), 'warning', 'the ninth seat is refused with a warning');
  assert.equal(selectionHaptic(toggleSeatSelection(full, 'A-1')), 'selection', 'dropping from a full selection is a normal drop');
});

test('picks that are no longer available are dropped, in order', () => {
  const rows = room(2, 4, { 'A-2': { status: 'sold' }, 'B-1': { status: 'held' } });
  assert.deepEqual(pruneUnavailable(['A-1', 'A-2', 'B-1', 'B-2'], rows), ['A-1', 'B-2']);
  const same = ['A-1', 'B-2'];
  assert.equal(pruneUnavailable(same, rows), same, 'unchanged input is returned as is');
});

test('picked seats are named in room order, whatever order they were tapped in', () => {
  const rows = room(10, 12);
  assert.deepEqual(selectedSeatNames(rows, ['D-9', 'D-8', 'A-3']), ['A3', 'D8', 'D9']);
  assert.deepEqual(selectedSeatNames(rows, []), []);
});

test('the footer line says how many seats and which', () => {
  assert.equal(summarySeatsLine([]), 'No seats picked yet');
  assert.equal(summarySeatsLine(['D8']), '1 seat · D8');
  assert.equal(summarySeatsLine(['D8', 'D9']), '2 seats · D8, D9');
});

test('the header line is "Title · Sat 14, 20:00 · IMAX", and drops the title when there is none', () => {
  const parts = { startsAt: '2026-11-14T20:00:00.000Z', time: '20:00', format: 'IMAX' };
  assert.equal(composeSeatingSubtitle({ ...parts, title: 'The Lantern Road' }), 'The Lantern Road · Sat 14, 20:00 · IMAX');
  assert.equal(composeSeatingSubtitle({ ...parts, title: null }), 'Sat 14, 20:00 · IMAX');
  assert.equal(composeSeatingSubtitle({ ...parts }), 'Sat 14, 20:00 · IMAX');
  assert.equal(composeSeatingSubtitle({ ...parts, title: '   ' }), 'Sat 14, 20:00 · IMAX');
});

// ---- Mini-map -------------------------------------------------------------------------------------

test('the mini-map is 8 rows of 5 dots, and a dot is lit while any seat in its block can be picked', () => {
  const dots = minimapDots(room(16, 20));
  assert.equal(dots.length, MINIMAP_ROWS);
  assert.ok(dots.every((row) => row.length === MINIMAP_COLUMNS));
  assert.ok(dots.flat().every(Boolean), 'an empty room lights every block');

  const allSold = minimapDots(room(16, 20, Object.fromEntries(room(16, 20).flatMap((r) => r.seats.map((s) => [s.id, { status: 'sold' as const }])))));
  assert.ok(allSold.flat().every((lit) => !lit), 'a sold-out room lights nothing');
});

test('the mini-map block follows where the free seat is', () => {
  // Only seat A-1 (front row, far left) is free: only the top-left dot is lit.
  const overrides: Record<string, { status: SeatStatus }> = {};
  for (const row of room(10, 20)) for (const seat of row.seats) if (seat.id !== 'A-1') overrides[seat.id] = { status: 'sold' };
  const dots = minimapDots(room(10, 20, overrides));
  assert.equal(dots[0]![0], true);
  assert.equal(dots.flat().filter(Boolean).length, 1);
});

// ---- Easing ---------------------------------------------------------------------------------------

test('easing tokens parse to the four numbers Easing.bezier takes', () => {
  assert.deepEqual(parseCubicBezier('cubic-bezier(0.2, 0, 0, 1)'), [0.2, 0, 0, 1]);
  assert.deepEqual(parseCubicBezier(primitives['easing/standard']), [0.2, 0, 0, 1]);
  assert.deepEqual(parseCubicBezier(primitives['easing/exit']), [0.3, 0, 1, 1]);
  assert.throws(() => parseCubicBezier('ease-in-out'));
});

// ---- Starting view --------------------------------------------------------------------------------

test('a seat is found by id, with its row and place in the row', () => {
  const rows = room(10, 14);
  assert.deepEqual(findSeatPosition(rows, 'D-8'), { rowIndex: 3, seatIndex: 7 });
  assert.equal(findSeatPosition(rows, 'Z-99'), null);
});

test('the map starts as the whole-room Overview: smallest scale, centred, nothing zoomed', () => {
  const rows = room(10, 14);
  const layout = buildMapLayout(rows);
  const view = initialMapView(layout, rows, 328, 0.5);
  assert.equal(view.scale, 0.5);
  assert.equal(view.zoomed, false);
  assert.equal(view.tx, 0, 'a 14-seat row at 0.5 fills the 328 window exactly');
  assert.ok(view.ty >= 0 && view.ty < 1);
});

test('given a seat, the map starts zoomed with that seat in the middle of the zoomed window', () => {
  const rows = room(10, 14);
  const layout = buildMapLayout(rows);
  const view = initialMapView(layout, rows, 328, 0.5, 'D-8');
  assert.equal(view.scale, 1);
  assert.equal(view.zoomed, true);
  // D8 is on screen: its centre sits inside the zoomed window [16, 272] and the window height.
  const centreX = seatLeft(layout, 3, 7) + SEAT_SIZE / 2;
  const centreY = rowTop(3) + SEAT_SIZE / 2;
  const screenX = view.tx + centreX;
  const screenY = view.ty + centreY;
  assert.ok(screenX > 16 && screenX < 16 + 256, `x ${screenX}`);
  assert.ok(screenY > 0 && screenY < 256, `y ${screenY}`);
});

test('an unknown seat id falls back to the Overview', () => {
  const rows = room(10, 14);
  const layout = buildMapLayout(rows);
  assert.equal(initialMapView(layout, rows, 328, 0.5, 'nope').zoomed, false);
});

// ---- Holding and contention (traffic slice 5b) ----------------------------------------------------

test('findLostPicks names the picks that another user took, in the order they were picked', () => {
  const rows = room(2, 3, { 'A-2': { status: 'held' }, 'B-1': { status: 'sold' } });
  assert.deepEqual(findLostPicks(['B-1', 'A-1', 'A-2'], rows), ['B-1', 'A-2']);
});

test('findLostPicks: nothing lost when every pick is still available, or when nothing is picked', () => {
  const rows = room(2, 3);
  assert.deepEqual(findLostPicks(['A-1', 'B-3'], rows), []);
  assert.deepEqual(findLostPicks([], rows), []);
});

test('findLostPicks: a pick that is no longer in the room at all is lost too', () => {
  assert.deepEqual(findLostPicks(['Z-9'], room(1, 3)), ['Z-9']);
});

test('withOwnHold shows the caller\'s own held seats as available, so the selection draws them as "Yours"', () => {
  const rows = room(2, 3, { 'A-1': { status: 'held' }, 'A-2': { status: 'held' }, 'B-3': { status: 'held' } });
  const shown = withOwnHold(rows, ['A-1', 'A-2']);
  const status = (id: string) => shown.flatMap((r) => r.seats).find((s) => s.id === id)!.status;
  assert.equal(status('A-1'), 'available');
  assert.equal(status('A-2'), 'available');
  assert.equal(status('B-3'), 'held', 'someone else\'s hold is still drawn as held');
});

test('withOwnHold never turns a SOLD seat back into an available one, and leaves available ones alone', () => {
  const rows = room(1, 3, { 'A-1': { status: 'sold' } });
  assert.equal(withOwnHold(rows, ['A-1', 'A-2']), rows, 'nothing to change: the same rows come back');
  assert.equal(rows[0]!.seats[0]!.status, 'sold');
});

test('withOwnHold keeps untouched rows as the SAME objects, so the memoized map does not redraw them', () => {
  const rows = room(3, 3, { 'B-2': { status: 'held' } });
  const shown = withOwnHold(rows, ['B-2']);
  assert.notEqual(shown, rows);
  assert.equal(shown[0], rows[0]);
  assert.notEqual(shown[1], rows[1]);
  assert.equal(shown[2], rows[2]);
  assert.equal(withOwnHold(rows, []), rows, 'no own seats: the same array');
});

test('withOwnHold does not change the rows it was given', () => {
  const rows = room(1, 2, { 'A-1': { status: 'held' } });
  withOwnHold(rows, ['A-1']);
  assert.equal(rows[0]!.seats[0]!.status, 'held');
});

test('takenSeatsMessage names the seat (Figma 57:7594 wording), or lists several, or falls back', () => {
  assert.equal(takenSeatsMessage(['D8']), 'Seat D8 was just taken. Pick another.');
  assert.equal(takenSeatsMessage(['D8', 'D9']), 'Seats D8, D9 were just taken. Pick others.');
  assert.equal(takenSeatsMessage([]), 'Some of your seats were just taken. Pick others.');
});
