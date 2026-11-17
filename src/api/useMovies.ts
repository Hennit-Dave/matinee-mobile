import { useQuery } from '@tanstack/react-query';
import { getClientId } from './clientIdNative';
import { readApiBaseUrl } from './config';
import {
  fetchDiscoverMovies,
  fetchGenres,
  fetchMovieDetail,
  fetchNowPlayingMovies,
  fetchPopularMovies,
  fetchSearchMovies,
  normaliseSearchQuery,
  resolveMovieDetailViewStatus,
  resolveMoviesViewStatus,
  type Genre,
  type MovieDetail,
  type MovieDetailViewStatus,
  type MoviesFetchResult,
  type MoviesViewStatus,
} from './movies';
import { SEARCH_RETRY_OPTIONS, isWaitingOnRateLimit } from './searchHelpers';

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;

export function safeReadBaseUrl(): { baseUrl: string | null; configError: Error | null } {
  try {
    return { baseUrl: readApiBaseUrl(), configError: null };
  } catch (err) {
    return {
      baseUrl: null,
      configError: err instanceof Error ? err : new Error('Could not read EXPO_PUBLIC_API_URL.'),
    };
  }
}

export interface UseMoviesResult {
  status: MoviesViewStatus;
  movies: MoviesFetchResult['data']['movies'];
  page: number;
  totalPages: number;
  totalResults: number;
  error: Error | null;
  isFetching: boolean;
  refetch: () => void;
}

function toUseMoviesResult(
  enabled: boolean,
  query: {
    data: MoviesFetchResult | undefined;
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
    error: unknown;
    refetch: () => Promise<unknown>;
  },
  configError: Error | null
): UseMoviesResult {
  const effectiveError = configError ?? (query.error instanceof Error ? query.error : null);
  const isError = configError !== null || query.isError;
  const status = resolveMoviesViewStatus({
    enabled,
    isPending: query.isPending,
    isError,
    error: effectiveError,
    result: query.data,
  });

  return {
    status,
    movies: query.data?.data.movies ?? [],
    page: query.data?.data.page ?? 1,
    totalPages: query.data?.data.totalPages ?? 0,
    totalResults: query.data?.data.totalResults ?? 0,
    error: effectiveError,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    },
  };
}

export function useNowPlayingMovies(page = 1): UseMoviesResult {
  const { baseUrl, configError } = safeReadBaseUrl();
  const enabled = baseUrl !== null;

  const query = useQuery({
    queryKey: ['movies', 'now-playing', baseUrl, page],
    enabled,
    retry: false,
    staleTime: ONE_MINUTE_MS,
    gcTime: ONE_HOUR_MS,
    queryFn: ({ signal }) => fetchNowPlayingMovies(page, signal, baseUrl!),
  });

  return toUseMoviesResult(enabled, query, configError);
}

export function usePopularMovies(page = 1): UseMoviesResult {
  const { baseUrl, configError } = safeReadBaseUrl();
  const enabled = baseUrl !== null;

  const query = useQuery({
    queryKey: ['movies', 'popular', baseUrl, page],
    enabled,
    retry: false,
    staleTime: ONE_MINUTE_MS,
    gcTime: ONE_HOUR_MS,
    queryFn: ({ signal }) => fetchPopularMovies(page, signal, baseUrl!),
  });

  return toUseMoviesResult(enabled, query, configError);
}

export interface UseSearchMoviesResult extends UseMoviesResult {
  /**
   * The server answered 429 and the search is waiting out `Retry-After` before asking again (traffic slice 5c). The
   * screen shows a Toast for it; `status` stays `loading` meanwhile, so the skeleton stays and "Search failed" never
   * appears. It goes false when the search succeeds, fails another way, or has used up its automatic retries.
   */
  rateLimited: boolean;
}

export function useSearchMovies(rawQuery: string, page = 1): UseSearchMoviesResult {
  const { baseUrl, configError } = safeReadBaseUrl();
  const normalised = normaliseSearchQuery(rawQuery);
  const enabled = baseUrl !== null && normalised.length > 0;

  const query = useQuery({
    queryKey: ['movies', 'search', baseUrl, normalised, page],
    enabled,
    // Only a 429 is retried, after its Retry-After, a few times (searchHelpers.ts). Everything else fails at once.
    ...SEARCH_RETRY_OPTIONS,
    staleTime: ONE_MINUTE_MS,
    gcTime: ONE_HOUR_MS,
    queryFn: async ({ signal }) => {
      // Search does not need an install id, but with it the server also counts this install's own searches (the
      // per-user limit). If the id cannot be read, search still works and only the address is counted.
      const clientId = await getClientId().catch(() => undefined);
      return fetchSearchMovies(normalised, page, signal, baseUrl!, clientId);
    },
  });

  return {
    ...toUseMoviesResult(enabled, query, configError),
    rateLimited: isWaitingOnRateLimit(query),
  };
}

export interface UseMovieDetailResult {
  status: MovieDetailViewStatus;
  detail: MovieDetail | null;
  error: Error | null;
  isFetching: boolean;
  refetch: () => void;
}

const FIVE_MINUTES_MS = 5 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

export function useMovieDetail(movieId: number): UseMovieDetailResult {
  const { baseUrl, configError } = safeReadBaseUrl();
  const validId = Number.isInteger(movieId) && movieId >= 1;
  const enabled = baseUrl !== null && validId;

  const query = useQuery({
    queryKey: ['movies', 'detail', baseUrl, movieId],
    enabled,
    retry: false,
    staleTime: FIVE_MINUTES_MS,
    gcTime: ONE_DAY_MS,
    queryFn: ({ signal }) => fetchMovieDetail(movieId, signal, baseUrl!),
  });

  const effectiveError = configError ?? (query.error instanceof Error ? query.error : null);
  const status = resolveMovieDetailViewStatus({
    enabled,
    isPending: query.isPending,
    isError: query.isError || configError !== null,
    error: effectiveError,
    result: query.data,
  });

  return {
    status,
    detail: query.data?.data ?? null,
    error: effectiveError,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    },
  };
}

export interface UseGenresResult {
  genres: Genre[];
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useGenres(): UseGenresResult {
  const { baseUrl, configError } = safeReadBaseUrl();
  const enabled = baseUrl !== null;

  const query = useQuery({
    queryKey: ['movies', 'genres', baseUrl],
    enabled,
    retry: false,
    staleTime: ONE_DAY_MS,
    gcTime: ONE_DAY_MS,
    queryFn: ({ signal }) => fetchGenres(signal, baseUrl!),
  });

  const effectiveError = configError ?? (query.error instanceof Error ? query.error : null);
  return {
    genres: query.data?.data.genres ?? [],
    isLoading: enabled && query.isPending && !query.data,
    isError: (configError !== null || query.isError) && !query.data,
    isFetching: query.isFetching,
    error: effectiveError,
    refetch: () => {
      void query.refetch();
    },
  };
}

export function useDiscoverMovies(genreId: number | null, page = 1): UseMoviesResult {
  const { baseUrl, configError } = safeReadBaseUrl();
  const validGenre = genreId !== null && Number.isInteger(genreId) && genreId >= 1;
  const enabled = baseUrl !== null && validGenre;

  const query = useQuery({
    queryKey: ['movies', 'discover', baseUrl, genreId, page],
    enabled,
    retry: false,
    staleTime: ONE_MINUTE_MS,
    gcTime: ONE_HOUR_MS,
    queryFn: ({ signal }) => fetchDiscoverMovies(genreId!, page, signal, baseUrl!),
  });

  return toUseMoviesResult(enabled, query, configError);
}
