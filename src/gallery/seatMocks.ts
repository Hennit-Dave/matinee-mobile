import type { SeatKind, SeatStatus, ShowtimeSeatRow } from '../api/seats';

/**
 * Mock rooms for the gallery. No network and no randomness: the same room every time, so screenshots
 * are repeatable. Seats look like the server's: ids, row letters, kinds and statuses.
 */

export interface MockRoomOptions {
  /** Every seat sold: a genuinely sold-out room, which the server sends as a full grid, not an empty one. */
  allSold?: boolean;
}

/** A fixed scatter of sold and held seats, so every row has a mix without a random generator. */
function statusFor(rowIndex: number, seatIndex: number): SeatStatus {
  const mix = (rowIndex * 7 + seatIndex * 13) % 11;
  if (mix < 3) return 'sold';
  if ((rowIndex * 5 + seatIndex * 3) % 17 === 0) return 'held';
  return 'available';
}

export function buildMockRoom(rowCount: number, perRow: number, options: MockRoomOptions = {}): ShowtimeSeatRow[] {
  return Array.from({ length: rowCount }, (_, r) => {
    const row = String.fromCharCode(65 + r);
    const isBackRow = r === rowCount - 1;
    return {
      row,
      seats: Array.from({ length: perRow }, (_, i) => {
        const number = i + 1;
        const kind: SeatKind = isBackRow && (number === 1 || number === perRow) ? 'wheelchair' : 'standard';
        let status: SeatStatus = options.allSold ? 'sold' : statusFor(r, i);
        // Wheelchair spaces stay free, so the gallery shows their glyph as the Figma frames do.
        if (!options.allSold && kind === 'wheelchair') status = 'available';
        // Keep the seats the gallery picks (D8 and D9, as in the Figma frames) free to pick.
        if (!options.allSold && row === 'D' && (number === 8 || number === 9)) status = 'available';
        return { id: `mock-${row}-${number}`, row, number, kind, status };
      }),
    };
  });
}

/** 9 rows x 14 = 126 seats: the Figma Overview room (under 300 seats, drawn at 0.5x). */
export const MOCK_ROOM_SMALL = buildMockRoom(9, 14);
export const MOCK_ROOM_SMALL_SEATS = 126;

/** 16 rows x 20 = 320 seats: the IMAX load-test room (300+, drawn at 0.3x). */
export const MOCK_ROOM_LARGE = buildMockRoom(16, 20);
export const MOCK_ROOM_LARGE_SEATS = 320;

/** A sold-out room: a full grid with every seat sold. */
export const MOCK_ROOM_SOLD_OUT = buildMockRoom(9, 14, { allSold: true });

/** The seats the Figma frames show as "Yours". */
export const MOCK_PICKED = ['mock-D-8', 'mock-D-9'] as const;
