import type { MovieDetail } from './movies';
import type { CinemaShowtimes, ShowtimeSlot } from './showtimes';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Formats whole minutes into `"2h 14m"` (or `"45m"` / `"2h"`). Returns null when unknown or <= 0. */
export function formatRuntime(runtimeMinutes: number | null | undefined): string | null {
  if (!runtimeMinutes || runtimeMinutes <= 0) return null;
  const hours = Math.floor(runtimeMinutes / 60);
  const minutes = runtimeMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

/** Formats canonical `YYYY-MM-DD` into `"7 November 2026"`. Returns null if invalid. */
export function formatReleaseDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const month = MONTH_NAMES[monthIndex];
  if (!month || day < 1 || day > 31) return null;
  return `${day} ${month} ${year}`;
}

/**
 * Composes the Movie Detail hero meta line (`"Drama · 2h 14m · 15 · English"`), omitting any
 * null/missing parts.
 */
export function composeMovieMetaLine(
  detail: Pick<MovieDetail, 'genres' | 'runtimeMinutes' | 'certification' | 'language'>
): string {
  const parts = [
    detail.genres[0] ?? null,
    formatRuntime(detail.runtimeMinutes),
    detail.certification,
    detail.language,
  ].filter((part): part is string => Boolean(part && part.trim()));
  return parts.join(' · ');
}

function parseUtcDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** Formats `YYYY-MM-DD` into `"Today Wed 11"` when matching `todayIso` or `"Thu 12"` otherwise. */
export function formatDateChipLabel(isoDate: string, todayIso: string): string {
  const parsed = parseUtcDate(isoDate);
  if (!parsed) return isoDate;
  const weekday = SHORT_WEEKDAYS[parsed.getUTCDay()];
  const day = parsed.getUTCDate();
  return isoDate === todayIso ? `Today ${weekday} ${day}` : `${weekday} ${day}`;
}

/** Formats `YYYY-MM-DD` for headings/empty states without `"Today"` prefix (e.g. `"Sun 15"`). */
export function formatShortDateLabel(isoDate: string): string {
  const parsed = parseUtcDate(isoDate);
  if (!parsed) return isoDate;
  const weekday = SHORT_WEEKDAYS[parsed.getUTCDay()];
  const day = parsed.getUTCDate();
  return `${weekday} ${day}`;
}

export interface ShowtimeDatesSummary {
  /** Sorted distinct `YYYY-MM-DD` dates present in the response. */
  dates: string[];
  /** Dates that have at least one showtime slot. */
  hasShowtimesDates: Set<string>;
  /** First/nearest date that has showtimes, or `dates[0]` if none, or null if `dates` is empty. */
  defaultDate: string | null;
}

/** Extracts sorted distinct dates, the non-empty date set, and the default selected date. */
export function extractShowtimeDates(cinemas: readonly CinemaShowtimes[]): ShowtimeDatesSummary {
  const allDates = new Set<string>();
  const hasShowtimesDates = new Set<string>();

  for (const cinema of cinemas) {
    for (const dateEntry of cinema.dates) {
      allDates.add(dateEntry.date);
      if (dateEntry.showtimes.length > 0) {
        hasShowtimesDates.add(dateEntry.date);
      }
    }
  }

  const dates = Array.from(allDates).sort();
  const defaultDate = dates.find((d) => hasShowtimesDates.has(d)) ?? dates[0] ?? null;

  return { dates, hasShowtimesDates, defaultDate };
}

/**
 * Finds the nearest date in `hasShowtimesDates` to `selectedDate` (preferring an earlier or equal
 * distance date in chronological order), or null when `hasShowtimesDates` is empty.
 */
export function findNearestDateWithShowtimes(
  selectedDate: string,
  hasShowtimesDates: ReadonlySet<string>
): string | null {
  if (hasShowtimesDates.size === 0) return null;
  const target = parseUtcDate(selectedDate)?.getTime();
  const candidates = Array.from(hasShowtimesDates).sort();
  if (target === undefined) return candidates[0] ?? null;

  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const time = parseUtcDate(candidate)?.getTime();
    if (time === undefined) continue;
    const distance = Math.abs(time - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  return best;
}

export interface CinemaFormatGroup {
  format: string;
  slots: ShowtimeSlot[];
}

export interface CinemaShowtimesForDate {
  cinemaId: string;
  cinemaName: string;
  cinemaAddress: string;
  formats: CinemaFormatGroup[];
}

/**
 * Groups the selected date's showtimes into `cinema -> format -> slots`, preserving cinema and
 * slot order from the server and omitting cinemas with no screenings on `selectedDate`.
 */
export function groupDateShowtimesByCinemaAndFormat(
  cinemas: readonly CinemaShowtimes[],
  selectedDate: string
): CinemaShowtimesForDate[] {
  const result: CinemaShowtimesForDate[] = [];

  for (const cinema of cinemas) {
    const dateSchedule = cinema.dates.find((d) => d.date === selectedDate);
    if (!dateSchedule || dateSchedule.showtimes.length === 0) continue;

    const formatMap = new Map<string, ShowtimeSlot[]>();
    for (const slot of dateSchedule.showtimes) {
      let slots = formatMap.get(slot.format);
      if (!slots) {
        slots = [];
        formatMap.set(slot.format, slots);
      }
      slots.push(slot);
    }

    result.push({
      cinemaId: cinema.cinemaId,
      cinemaName: cinema.cinemaName,
      cinemaAddress: cinema.cinemaAddress,
      formats: Array.from(formatMap.entries()).map(([format, slots]) => ({ format, slots })),
    });
  }

  return result;
}
