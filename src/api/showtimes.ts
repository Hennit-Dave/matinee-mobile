import { readApiBaseUrl } from './config';
import {
  MAX_MOVIE_ID,
  MovieApiError,
  fetchApiJson,
  isServerOverloadedError,
  type CacheStatus,
} from './movies';

/**
 * Mirrors matinee-server/src/showtimes/showtime.ts.
 * Any contract change lands in a matinee-server PR first.
 */
export interface ShowtimeSlot {
  id: string;
  startsAt: string;
  /** UTC HH:MM (24-hour, e.g. "19:30") for tabular-numeral Chip labels. */
  time: string;
  screenId: string;
  screenName: string;
  format: string;
  totalSeats: number;
  priceCents: number;
  /** Server-formatted display price (e.g. "$15.50") so the app never computes money. */
  priceFormatted: string;
}

export interface CinemaDateSchedule {
  /** UTC YYYY-MM-DD */
  date: string;
  showtimes: ShowtimeSlot[];
}

export interface CinemaShowtimes {
  cinemaId: string;
  cinemaName: string;
  cinemaAddress: string;
  dates: CinemaDateSchedule[];
}

export interface MovieShowtimesResponse {
  movieId: number;
  cinemas: CinemaShowtimes[];
}

export interface ShowtimesFetchResult {
  data: MovieShowtimesResponse;
  cache: CacheStatus | null;
}

export function buildMovieShowtimesUrl(baseUrl: string, id: number): string {
  if (!Number.isInteger(id) || id < 1 || id > MAX_MOVIE_ID) {
    throw new MovieApiError('Invalid movie id.', {
      status: 400,
      kind: 'validation_failed',
      retryable: false,
    });
  }
  return `${baseUrl}/movies/${id}/showtimes`;
}

function isMovieShowtimesResponse(value: unknown): value is MovieShowtimesResponse {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.movieId === 'number' && Array.isArray(record.cinemas);
}

export async function fetchMovieShowtimes(
  id: number,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<ShowtimesFetchResult> {
  return fetchApiJson(buildMovieShowtimesUrl(baseUrl, id), isMovieShowtimesResponse, signal);
}

export type ShowtimesViewStatus = 'loading' | 'ready' | 'empty' | 'server_overloaded' | 'error';

export function resolveShowtimesViewStatus(params: {
  enabled: boolean;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  result: ShowtimesFetchResult | undefined;
}): ShowtimesViewStatus {
  if (!params.enabled) return 'error';
  if (params.isPending && !params.result) return 'loading';

  if (params.result) {
    const hasAnyShowtime = params.result.data.cinemas.some((cinema) =>
      cinema.dates.some((date) => date.showtimes.length > 0)
    );
    return hasAnyShowtime ? 'ready' : 'empty';
  }

  if (params.isError) {
    return isServerOverloadedError(params.error) ? 'server_overloaded' : 'error';
  }

  return 'empty';
}
