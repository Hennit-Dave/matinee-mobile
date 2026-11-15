import { useQuery } from '@tanstack/react-query';
import { safeReadBaseUrl } from './useMovies';
import {
  fetchMovieShowtimes,
  resolveShowtimesViewStatus,
  type CinemaShowtimes,
  type ShowtimesViewStatus,
} from './showtimes';

export interface UseMovieShowtimesResult {
  status: ShowtimesViewStatus;
  cinemas: CinemaShowtimes[];
  error: Error | null;
  isFetching: boolean;
  refetch: () => void;
}

/**
 * Showtimes are intentionally uncached on the server (`staleTime: 0`) so upcoming live seat
 * availability never serves stale slot state.
 */
export function useMovieShowtimes(movieId: number): UseMovieShowtimesResult {
  const { baseUrl, configError } = safeReadBaseUrl();
  const validId = Number.isInteger(movieId) && movieId >= 1;
  const enabled = baseUrl !== null && validId;

  const query = useQuery({
    queryKey: ['movies', 'showtimes', baseUrl, movieId],
    enabled,
    retry: false,
    staleTime: 0,
    queryFn: ({ signal }) => fetchMovieShowtimes(movieId, signal, baseUrl!),
  });

  const effectiveError = configError ?? (query.error instanceof Error ? query.error : null);
  const status = resolveShowtimesViewStatus({
    enabled,
    isPending: query.isPending,
    isError: query.isError || configError !== null,
    error: effectiveError,
    result: query.data,
  });

  return {
    status,
    cinemas: query.data?.data.cinemas ?? [],
    error: effectiveError,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    },
  };
}
