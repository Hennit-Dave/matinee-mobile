import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { getClientId } from './clientIdNative';
import { MovieApiError } from './movies';
import { safeReadBaseUrl } from './useMovies';
import {
  NO_SEATS_MESSAGE,
  countSeats,
  fetchShowtimeSeats,
  isShowtimeId,
  isStaleRefresh,
  resolveSeatsViewStatus,
  type SeatsViewStatus,
  type ShowtimeSeatsResponse,
} from './seats';
import { nextPollDelay, shouldRefreshOnResume } from './seatsPolling';

/** Kept out of the hook so the random draw is plainly part of the poll timer, not of rendering. */
const randomUnit = (): number => Math.random();

export interface UseShowtimeSeatsResult {
  status: SeatsViewStatus;
  data: ShowtimeSeatsResponse | null;
  /** Why the error state is shown. An empty seat grid is reported here too (see resolveSeatsViewStatus). */
  error: Error | null;
  isFetching: boolean;
  /**
   * The last refresh failed but the last good map is still drawn (see `resolveSeatsViewStatus`). The screen
   * says so once; it clears itself on the next good refresh.
   */
  stale: boolean;
  /** Fetch now, cancelling any refresh already running (its answer may predate whatever we are reacting to). */
  refetch: () => void;
}

export interface UseShowtimeSeatsOptions {
  /**
   * Refresh the map by itself while true (every ~5 s, see seatsPolling.ts). The screen passes "focused AND in
   * the foreground" so a screen that is not being looked at asks for nothing.
   */
  polling?: boolean;
}

/**
 * Seat availability must never be served stale, so nothing is cached (`staleTime: 0`, and the server does not
 * cache it either) and a failed request is never retried by TanStack (`retry: false`): the user gets an explicit
 * Try again, and while polling the next scheduled refresh is the retry.
 *
 * Every request carries the caller's `X-Client-Id` when there is one (it is optional on this route), so the
 * server can show a user their own booking at once. A missing id never blocks the map.
 */
export function useShowtimeSeats(showtimeId: string, options: UseShowtimeSeatsOptions = {}): UseShowtimeSeatsResult {
  const { polling = false } = options;
  const { baseUrl, configError } = safeReadBaseUrl();
  const enabled = baseUrl !== null && isShowtimeId(showtimeId);

  // Refreshes that failed in a row. Counted inside the request, so it is updated before TanStack publishes the
  // failure, and an aborted request (leaving the screen) is not a failure.
  const [failures, setFailures] = useState(0);

  const query = useQuery({
    queryKey: ['showtimes', 'seats', baseUrl, showtimeId],
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    // TanStack re-evaluates this after every fetch and whenever `polling` changes, so each wait is fresh
    // (jittered) and the timer never overlaps a request that is still running.
    refetchInterval: () => nextPollDelay({ active: polling, consecutiveFailures: failures, random: randomUnit() }),
    refetchIntervalInBackground: false,
    queryFn: async ({ signal }) => {
      const clientId = await getClientId().catch(() => undefined);
      try {
        const result = await fetchShowtimeSeats(showtimeId, signal, baseUrl!, clientId);
        setFailures(0);
        return result;
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) setFailures((count) => count + 1);
        throw error;
      }
    },
  });

  // Back on screen or back in the foreground: refresh at once rather than after the next interval.
  const wasPolling = useRef(polling);
  const { refetch } = query;
  useEffect(() => {
    if (enabled && shouldRefreshOnResume(wasPolling.current, polling)) void refetch({ cancelRefetch: false });
    wasPolling.current = polling;
  }, [enabled, polling, refetch]);

  const requestError = configError ?? (query.error instanceof Error ? query.error : null);
  const isError = query.isError || configError !== null;
  const status = resolveSeatsViewStatus({
    enabled,
    isPending: query.isPending,
    isError,
    error: requestError,
    result: query.data,
    consecutiveFailures: failures,
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
    stale: isStaleRefresh({ isError, error: requestError, result: query.data, consecutiveFailures: failures }),
    refetch: () => {
      void query.refetch();
    },
  };
}
