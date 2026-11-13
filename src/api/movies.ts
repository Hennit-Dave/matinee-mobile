import { readApiBaseUrl } from './config';

/**
 * Mirrors matinee-server/src/movies/movie.ts.
 * Any contract change lands in a matinee-server PR first.
 */
export const OVERVIEW_MAX_LENGTH = 200;
export const MAX_PAGE = 500;
export const MAX_QUERY_LENGTH = 100;

export interface Movie {
  id: number;
  title: string;
  posterUrl: string | null;
  year: number | null;
  overview: string | null;
}

export interface MoviesPage {
  movies: Movie[];
  page: number;
  totalPages: number;
  totalResults: number;
}

/**
 * Mirrors matinee-server/src/http/errors.ts.
 */
export type ApiErrorCode =
  | 'not_found'
  | 'validation_failed'
  | 'invalid_json'
  | 'payload_too_large'
  | 'internal_error'
  | 'service_unavailable'
  | 'upstream_unavailable';

export interface ApiErrorDetail {
  path: string;
  code: string;
  min?: number;
  max?: number;
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details?: ApiErrorDetail[];
  };
}

export type CacheStatus = 'hit' | 'miss' | 'stale';

export interface MoviesFetchResult {
  data: MoviesPage;
  cache: CacheStatus | null;
}

export type MovieErrorKind = ApiErrorCode | 'network_error' | 'invalid_response';

export class MovieApiError extends Error {
  readonly status: number;
  readonly kind: MovieErrorKind;
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { status: number; kind: MovieErrorKind; requestId?: string; retryable?: boolean }
  ) {
    super(message);
    this.name = 'MovieApiError';
    this.status = options.status;
    this.kind = options.kind;
    this.requestId = options.requestId;
    this.retryable =
      options.retryable ??
      (options.status === 503 ||
        options.kind === 'upstream_unavailable' ||
        options.kind === 'service_unavailable' ||
        options.kind === 'network_error');
  }
}

/** Mirrors server normaliseQuery: trim, collapse whitespace, lowercase. */
export function normaliseSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function buildNowPlayingUrl(baseUrl: string, page = 1): string {
  const safePage = Math.max(1, Math.min(MAX_PAGE, Math.trunc(page)));
  return `${baseUrl}/movies/now-playing?page=${safePage}`;
}

export function buildSearchMoviesUrl(baseUrl: string, query: string, page = 1): string {
  const normalised = normaliseSearchQuery(query).slice(0, MAX_QUERY_LENGTH);
  const safePage = Math.max(1, Math.min(MAX_PAGE, Math.trunc(page)));
  const params = new URLSearchParams({ q: normalised, page: String(safePage) });
  return `${baseUrl}/movies/search?${params.toString()}`;
}

function parseCacheHeader(header: string | null): CacheStatus | null {
  if (!header) return null;
  const lower = header.toLowerCase();
  if (lower === 'hit' || lower === 'miss' || lower === 'stale') return lower;
  return null;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const err = (value as { error?: unknown }).error;
  if (typeof err !== 'object' || err === null) return false;
  const record = err as Record<string, unknown>;
  return typeof record.code === 'string' && typeof record.message === 'string' && typeof record.requestId === 'string';
}

function isMoviesPage(value: unknown): value is MoviesPage {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.movies) &&
    typeof record.page === 'number' &&
    typeof record.totalPages === 'number' &&
    typeof record.totalResults === 'number'
  );
}

async function fetchMoviesJson(url: string, signal?: AbortSignal): Promise<MoviesFetchResult> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new MovieApiError('Could not reach the Matinee server.', {
      status: 0,
      kind: 'network_error',
      retryable: true,
    });
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new MovieApiError('Received an unreadable response from the server.', {
      status: res.status,
      kind: res.status === 503 ? 'service_unavailable' : 'invalid_response',
      retryable: res.status === 503,
    });
  }

  if (!res.ok) {
    if (isApiErrorBody(body)) {
      throw new MovieApiError(body.error.message, {
        status: res.status,
        kind: body.error.code,
        requestId: body.error.requestId,
      });
    }
    throw new MovieApiError('Movie request failed.', {
      status: res.status,
      kind: res.status === 503 ? 'service_unavailable' : 'internal_error',
    });
  }

  if (!isMoviesPage(body)) {
    throw new MovieApiError('Movie response did not match the expected shape.', {
      status: res.status,
      kind: 'invalid_response',
      retryable: false,
    });
  }

  return {
    data: body,
    cache: parseCacheHeader(res.headers.get('X-Cache')),
  };
}

export async function fetchNowPlayingMovies(
  page = 1,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<MoviesFetchResult> {
  return fetchMoviesJson(buildNowPlayingUrl(baseUrl, page), signal);
}

export async function fetchSearchMovies(
  query: string,
  page = 1,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<MoviesFetchResult> {
  const normalised = normaliseSearchQuery(query);
  if (!normalised) {
    throw new MovieApiError('Search query cannot be empty.', {
      status: 400,
      kind: 'validation_failed',
      retryable: false,
    });
  }
  return fetchMoviesJson(buildSearchMoviesUrl(baseUrl, normalised, page), signal);
}

export type MoviesViewStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'offline_saved_data'
  | 'server_overloaded'
  | 'error';

export function resolveMoviesViewStatus(params: {
  enabled: boolean;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  result: MoviesFetchResult | undefined;
}): MoviesViewStatus {
  if (!params.enabled) return 'idle';
  if (params.isPending && !params.result) return 'loading';

  if (params.result) {
    if (params.isError || params.result.cache === 'stale') {
      return params.result.data.movies.length > 0 ? 'offline_saved_data' : 'empty';
    }
    return params.result.data.movies.length > 0 ? 'ready' : 'empty';
  }

  if (params.isError) {
    if (
      params.error instanceof MovieApiError &&
      (params.error.status === 503 ||
        params.error.kind === 'upstream_unavailable' ||
        params.error.kind === 'service_unavailable')
    ) {
      return 'server_overloaded';
    }
    return 'error';
  }

  return 'empty';
}

export function formatMovieMeta(movie: Pick<Movie, 'year' | 'overview'>): string {
  if (movie.year && movie.overview) return `${movie.year} · ${movie.overview}`;
  if (movie.year) return String(movie.year);
  if (movie.overview) return movie.overview;
  return '';
}
