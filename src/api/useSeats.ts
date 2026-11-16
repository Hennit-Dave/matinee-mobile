import { useQuery } from '@tanstack/react-query';
import { MovieApiError } from './movies';
import { safeReadBaseUrl } from './useMovies';
import {
  NO_SEATS_MESSAGE,
  countSeats,
  fetchShowtimeSeats,
  isShowtimeId,
  resolveSeatsViewStatus,
  type SeatsViewStatus,
  type ShowtimeSeatsResponse,
} from './seats';

export interface UseShowtimeSeatsResult {
  status: SeatsViewStatus;
  data: ShowtimeSeatsResponse | null;
  /** Why the error state is shown. An empty seat grid is reported here too (see resolveSeatsViewStatus). */
  error: Error | null;
  isFetching: boolean;
  refetch: () => void;
}

/**
 * Seat availability must never be served stale, so nothing is cached (`staleTime: 0`, and the server does
 * not cache it either) and a failed request is never retried automatically: the user gets an explicit
 * retry instead (`retry: false`).
 */
export function useShowtimeSeats(showtimeId: string): UseShowtimeSeatsResult {
  const { baseUrl, configError } = safeReadBaseUrl();
  const enabled = baseUrl !== null && isShowtimeId(showtimeId);

  const query = useQuery({
    queryKey: ['showtimes', 'seats', baseUrl, showtimeId],
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: ({ signal }) => fetchShowtimeSeats(showtimeId, signal, baseUrl!),
  });

  const requestError = configError ?? (query.error instanceof Error ? query.error : null);
  const status = resolveSeatsViewStatus({
    enabled,
    isPending: query.isPending,
    isError: query.isError || configError !== null,
    error: requestError,
    result: query.data,
  });

  const emptyGridError =
    status === 'error' && query.data && countSeats(query.data.data.rows) === 0
      ? new MovieApiError(NO_SEATS_MESSAGE, { status: 200, kind: 'invalid_response', retryable: true })
      : null;

  return {
    status,
    // Only a response we trust is handed to the screen; an error state never carries a stale map.
    data: status === 'ready' || status === 'sold_out' ? (query.data?.data ?? null) : null,
    error: requestError ?? emptyGridError,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    },
  };
}
