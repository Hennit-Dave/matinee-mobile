import { clientIdHeaders, isClientId } from './clientId';
import { readApiBaseUrl } from './config';

/**
 * Mirrors matinee-server/src/movies/movie.ts.
 * Any contract change lands in a matinee-server PR first.
 */
export const OVERVIEW_MAX_LENGTH = 200;
export const DETAIL_OVERVIEW_MAX_LENGTH = 2_000;
export const MAX_PAGE = 500;
export const MAX_QUERY_LENGTH = 100;
export const MAX_MOVIE_ID = 2_147_483_647;

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

export interface MovieDetail {
  id: number;
  title: string;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  year: number | null;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  genres: string[];
  rating: number | null;
  tagline: string | null;
  certification: string | null;
  language: string | null;
  director: string | null;
  cast: string[];
}

/**
 * Mirrors matinee-server/src/http/errors.ts.
 *
 * `rate_limited` is a 429 (ADR 0016): the caller made too many requests to a limited route (hold, booking, search,
 * seat map) and must wait. The wait is in the `Retry-After` header, in whole seconds, not in the body. The limiter
 * runs BEFORE the route's own work, so a 429 means the request was not processed at all.
 */
export type ApiErrorCode =
  | 'not_found'
  | 'validation_failed'
  | 'invalid_json'
  | 'payload_too_large'
  | 'internal_error'
  | 'service_unavailable'
  | 'upstream_unavailable'
  | 'seat_taken'
  | 'seat_not_held'
  | 'holds_unavailable'
  | 'rate_limited';

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
    /** Only on `seat_taken` and `seat_not_held`: which seats the refusal is about (ADR 0015). */
    seatIds?: string[];
  };
}

export type CacheStatus = 'hit' | 'miss' | 'stale';

export interface MoviesFetchResult {
  data: MoviesPage;
  cache: CacheStatus | null;
}

export interface MovieDetailFetchResult {
  data: MovieDetail;
  cache: CacheStatus | null;
}

export interface Genre {
  id: number;
  name: string;
}

export interface GenresResponse {
  genres: Genre[];
}

export interface GenresFetchResult {
  data: GenresResponse;
  cache: CacheStatus | null;
}

export function buildMovieDetailUrl(baseUrl: string, id: number): string {
  if (!Number.isInteger(id) || id < 1 || id > MAX_MOVIE_ID) {
    throw new MovieApiError('Invalid movie id.', {
      status: 400,
      kind: 'validation_failed',
      retryable: false,
    });
  }
  return `${baseUrl}/movies/${id}`;
}

export type MovieErrorKind = ApiErrorCode | 'network_error' | 'invalid_response';

export class MovieApiError extends Error {
  readonly status: number;
  readonly kind: MovieErrorKind;
  readonly requestId?: string;
  readonly retryable: boolean;
  /** The seats a `seat_taken` / `seat_not_held` refusal names. Absent otherwise. */
  readonly seatIds?: string[];
  /** The server's `Retry-After`, in whole seconds, when it sent one. */
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    options: {
      status: number;
      kind: MovieErrorKind;
      requestId?: string;
      retryable?: boolean;
      seatIds?: string[];
      retryAfterSeconds?: number;
    }
  ) {
    super(message);
    this.name = 'MovieApiError';
    this.status = options.status;
    this.kind = options.kind;
    this.requestId = options.requestId;
    this.seatIds = options.seatIds;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.retryable =
      options.retryable ??
      (options.status === 503 ||
        options.status === 429 ||
        options.kind === 'rate_limited' ||
        options.kind === 'upstream_unavailable' ||
        options.kind === 'service_unavailable' ||
        options.kind === 'network_error');
  }
}

/** The server said "too many requests" (429 `rate_limited`). Nothing was processed; wait `Retry-After`, then ask again. */
export function isRateLimitedError(error: unknown): error is MovieApiError {
  return error instanceof MovieApiError && error.kind === 'rate_limited';
}

/**
 * How long the server asked the caller to wait, in milliseconds, or `fallbackMs` when it sent no (usable)
 * `Retry-After`. Bounded already: `parseRetryAfter` caps what a header can ask for.
 */
export function retryAfterMs(error: MovieApiError, fallbackMs: number): number {
  return error.retryAfterSeconds === undefined ? fallbackMs : error.retryAfterSeconds * 1000;
}

/** Mirrors server normaliseQuery: trim, collapse whitespace, lowercase. */
export function normaliseSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function buildNowPlayingUrl(baseUrl: string, page = 1): string {
  const safePage = Math.max(1, Math.min(MAX_PAGE, Math.trunc(page)));
  return `${baseUrl}/movies/now-playing?page=${safePage}`;
}

/** Mirrors server PopularQuerySchema: page 1..500. */
export function buildPopularMoviesUrl(baseUrl: string, page = 1): string {
  const safePage = Math.max(1, Math.min(MAX_PAGE, Math.trunc(page)));
  return `${baseUrl}/movies/popular?page=${safePage}`;
}

export function buildSearchMoviesUrl(baseUrl: string, query: string, page = 1): string {
  const normalised = normaliseSearchQuery(query).slice(0, MAX_QUERY_LENGTH);
  const safePage = Math.max(1, Math.min(MAX_PAGE, Math.trunc(page)));
  const params = new URLSearchParams({ q: normalised, page: String(safePage) });
  return `${baseUrl}/movies/search?${params.toString()}`;
}

export function buildGenresUrl(baseUrl: string): string {
  return `${baseUrl}/genres`;
}

export function buildDiscoverMoviesUrl(baseUrl: string, genreId: number, page = 1): string {
  if (!Number.isInteger(genreId) || genreId < 1 || genreId > MAX_MOVIE_ID) {
    throw new MovieApiError('Invalid genre id.', {
      status: 400,
      kind: 'validation_failed',
      retryable: false,
    });
  }
  const safePage = Math.max(1, Math.min(MAX_PAGE, Math.trunc(page)));
  return `${baseUrl}/movies/discover?genreId=${genreId}&page=${safePage}`;
}

function parseCacheHeader(header: string | null): CacheStatus | null {
  if (!header) return null;
  const lower = header.toLowerCase();
  if (lower === 'hit' || lower === 'miss' || lower === 'stale') return lower;
  return null;
}

/** The longest `Retry-After` the app will honour. A header is input from the network, so it is bounded. */
export const MAX_RETRY_AFTER_SECONDS = 60;

/** `Retry-After` in whole seconds. The HTTP-date form is not used by this server, so it is ignored. */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header || !/^\d{1,6}$/.test(header.trim())) return undefined;
  return Math.min(Number(header.trim()), MAX_RETRY_AFTER_SECONDS);
}

/** Only an array of strings counts; anything else is dropped rather than guessed at. */
function readSeatIds(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? (value as string[]) : undefined;
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

function isMovieDetail(value: unknown): value is MovieDetail {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'number' &&
    typeof record.title === 'string' &&
    Array.isArray(record.genres) &&
    Array.isArray(record.cast)
  );
}

function isGenre(value: unknown): value is Genre {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'number' && typeof record.name === 'string';
}

function isGenresResponse(value: unknown): value is GenresResponse {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.genres) && record.genres.every(isGenre);
}

/**
 * What a call needs beyond a plain GET: the seat-hold routes are POST and DELETE with a JSON body, and every
 * one carries `X-Client-Id`. Omitted, the call is the GET it always was.
 */
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  headers?: Record<string, string>;
  /** Sent as JSON. */
  body?: unknown;
}

export async function fetchApiJson<T>(
  url: string,
  guard: (value: unknown) => value is T,
  signal?: AbortSignal,
  request: ApiRequestOptions = {}
): Promise<{ data: T; cache: CacheStatus | null }> {
  const hasBody = request.body !== undefined;
  const init: RequestInit = { signal };
  if (request.method) init.method = request.method;
  if (request.headers || hasBody) {
    init.headers = { ...(hasBody ? { 'Content-Type': 'application/json' } : {}), ...request.headers };
  }
  if (hasBody) init.body = JSON.stringify(request.body);

  let res: Response;
  try {
    res = await fetch(url, init);
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
      // A 429 whose body cannot be read is still "wait and ask again". It is NOT called `rate_limited`: without the
      // server's envelope we cannot tell our limiter from something in front of it, so a hold treats it as unclear.
      retryable: res.status === 503 || res.status === 429,
    });
  }

  if (!res.ok) {
    if (isApiErrorBody(body)) {
      throw new MovieApiError(body.error.message, {
        status: res.status,
        kind: body.error.code,
        requestId: body.error.requestId,
        seatIds: readSeatIds(body.error.seatIds),
        retryAfterSeconds: parseRetryAfter(res.headers.get('Retry-After')),
      });
    }
    throw new MovieApiError('Movie request failed.', {
      status: res.status,
      kind: res.status === 503 ? 'service_unavailable' : 'internal_error',
    });
  }

  if (!guard(body)) {
    throw new MovieApiError('Response did not match the expected shape.', {
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
  return fetchApiJson(buildNowPlayingUrl(baseUrl, page), isMoviesPage, signal);
}

export async function fetchPopularMovies(
  page = 1,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<MoviesFetchResult> {
  return fetchApiJson(buildPopularMoviesUrl(baseUrl, page), isMoviesPage, signal);
}

/**
 * `clientId` is the install id (clientId.ts). Search does not need one, but with it the server also counts the
 * install's own searches (the per-user limit, ADR 0016); without it only the address is counted. An id that is not
 * a UUID is NOT sent: the server answers a malformed one with a 400, and search must never break over a header
 * that is optional.
 */
export async function fetchSearchMovies(
  query: string,
  page = 1,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl(),
  clientId?: string
): Promise<MoviesFetchResult> {
  const normalised = normaliseSearchQuery(query);
  if (!normalised) {
    throw new MovieApiError('Search query cannot be empty.', {
      status: 400,
      kind: 'validation_failed',
      retryable: false,
    });
  }
  const headers = isClientId(clientId) ? clientIdHeaders(clientId) : undefined;
  return fetchApiJson(
    buildSearchMoviesUrl(baseUrl, normalised, page),
    isMoviesPage,
    signal,
    headers ? { headers } : {}
  );
}

export async function fetchMovieDetail(
  id: number,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<MovieDetailFetchResult> {
  return fetchApiJson(buildMovieDetailUrl(baseUrl, id), isMovieDetail, signal);
}

export async function fetchGenres(
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<GenresFetchResult> {
  return fetchApiJson(buildGenresUrl(baseUrl), isGenresResponse, signal);
}

export async function fetchDiscoverMovies(
  genreId: number,
  page = 1,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<MoviesFetchResult> {
  return fetchApiJson(buildDiscoverMoviesUrl(baseUrl, genreId, page), isMoviesPage, signal);
}

export function isServerOverloadedError(error: unknown): boolean {
  return (
    error instanceof MovieApiError &&
    (error.status === 503 ||
      error.kind === 'upstream_unavailable' ||
      error.kind === 'service_unavailable')
  );
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
    return isServerOverloadedError(params.error) ? 'server_overloaded' : 'error';
  }

  return 'empty';
}

export type MovieDetailViewStatus =
  | 'loading'
  | 'ready'
  | 'offline_saved_data'
  | 'server_overloaded'
  | 'not_found'
  | 'error';

export function resolveMovieDetailViewStatus(params: {
  enabled: boolean;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  result: MovieDetailFetchResult | undefined;
}): MovieDetailViewStatus {
  if (!params.enabled) return 'error';
  if (params.isPending && !params.result) return 'loading';

  if (params.result) {
    if (params.isError || params.result.cache === 'stale') {
      return 'offline_saved_data';
    }
    return 'ready';
  }

  if (params.isError) {
    if (
      params.error instanceof MovieApiError &&
      (params.error.status === 404 || params.error.kind === 'not_found')
    ) {
      return 'not_found';
    }
    return isServerOverloadedError(params.error) ? 'server_overloaded' : 'error';
  }

  return 'error';
}

export function formatMovieMeta(movie: Pick<Movie, 'year' | 'overview'>): string {
  if (movie.year && movie.overview) return `${movie.year} · ${movie.overview}`;
  if (movie.year) return String(movie.year);
  if (movie.overview) return movie.overview;
  return '';
}
