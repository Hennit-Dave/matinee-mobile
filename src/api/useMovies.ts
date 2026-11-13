import { useQuery } from '@tanstack/react-query';
import { readApiBaseUrl } from './config';
import {
  fetchNowPlayingMovies,
  fetchSearchMovies,
  normaliseSearchQuery,
  resolveMoviesViewStatus,
  type MoviesFetchResult,
  type MoviesViewStatus,
} from './movies';

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;

function safeReadBaseUrl(): { baseUrl: string | null; configError: Error | null } {
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

export function useSearchMovies(rawQuery: string, page = 1): UseMoviesResult {
  const { baseUrl, configError } = safeReadBaseUrl();
  const normalised = normaliseSearchQuery(rawQuery);
  const enabled = baseUrl !== null && normalised.length > 0;

  const query = useQuery({
    queryKey: ['movies', 'search', baseUrl, normalised, page],
    enabled,
    retry: false,
    staleTime: ONE_MINUTE_MS,
    gcTime: ONE_HOUR_MS,
    queryFn: ({ signal }) => fetchSearchMovies(normalised, page, signal, baseUrl!),
  });

  return toUseMoviesResult(enabled, query, configError);
}
