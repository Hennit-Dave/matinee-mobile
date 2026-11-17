import { DEFAULT_RETRY_AFTER_MS } from './holds';
import { MovieApiError, isRateLimitedError, retryAfterMs } from './movies';

export type SearchMode = 'idle' | 'text' | 'genre';

export function resolveSearchMode(normalisedQuery: string, selectedGenreId: number | null): SearchMode {
  if (normalisedQuery.length > 0) return 'text';
  if (selectedGenreId !== null) return 'genre';
  return 'idle';
}

export function formatFilmCount(totalResults: number, visibleCount: number): string {
  const count = totalResults > 0 ? totalResults : visibleCount;
  return count === 1 ? '1 film' : `${count} films`;
}

export function isOfflineNetworkError(error: unknown): boolean {
  return error instanceof MovieApiError && error.kind === 'network_error';
}

// ---- Search under the rate limiter (traffic slice 5c, ADR 0016) ------------------------------------
//
// `GET /movies/search` is limited per install and per address. A 429 there is not a failure of the search, it is
// "not yet": the server says how long to wait (`Retry-After`) and the app waits, shows a Toast, and asks again, so
// the person sees results instead of "Search failed". TanStack Query does the waiting (`retry` + `retryDelay`), which
// keeps the query in its loading state (the skeleton) meanwhile, pauses while the app is in the background, and is
// cancelled when the query is no longer on screen (the person typed something else).
//
// It is bounded. A phone behind a busy shared address could be refused again and again; after
// `SEARCH_RATE_LIMIT_RETRIES` automatic tries the screen stops waiting and shows the error state, which has a
// manual Try again. Polling is a different path and is not touched here (a stray 429 there is covered by the
// "keep the map on 1-2 failed polls, error on the 3rd" rule).

/** Automatic retries of a rate-limited search before the error state is shown. Chosen, not measured. */
export const SEARCH_RATE_LIMIT_RETRIES = 3;

/**
 * The shortest wait before a retry, whatever `Retry-After` says. A header is input from the network (and the
 * server's own is at least a second): a `0` or a missing value must not become a tight loop.
 */
export const SEARCH_MIN_RETRY_MS = 1_000;

export const RATE_LIMITED_SEARCH_MESSAGE = 'Slow down a moment. Searching again shortly…';

/** Only a 429 is retried, and only `SEARCH_RATE_LIMIT_RETRIES` times. Any other failure is shown as before. */
export function shouldRetrySearch(failureCount: number, error: unknown): boolean {
  return isRateLimitedError(error) && failureCount < SEARCH_RATE_LIMIT_RETRIES;
}

/** The server's `Retry-After`, never less than `SEARCH_MIN_RETRY_MS`. */
export function searchRetryDelayMs(error: unknown): number {
  const asked = isRateLimitedError(error) ? retryAfterMs(error, DEFAULT_RETRY_AFTER_MS) : DEFAULT_RETRY_AFTER_MS;
  return Math.max(asked, SEARCH_MIN_RETRY_MS);
}

/** Spread into the search query's options. Exported as one object so a test runs the very options the hook uses. */
export const SEARCH_RETRY_OPTIONS = {
  retry: shouldRetrySearch,
  retryDelay: (_retryAttempt: number, error: unknown) => searchRetryDelayMs(error),
} as const;

/**
 * True while a search that was refused with a 429 is waiting to be asked again (a retry is queued or in flight).
 * False once it succeeds, fails some other way, or has used up its retries (then it is an ordinary error).
 */
export function isWaitingOnRateLimit(query: {
  isFetching: boolean;
  failureCount: number;
  failureReason: unknown;
}): boolean {
  return query.isFetching && query.failureCount > 0 && isRateLimitedError(query.failureReason);
}

/** The words of the search error state. The first two are what the screen has always said. */
export function searchErrorCopy(error: Error | null): { headline: string; body: string } {
  if (isOfflineNetworkError(error)) {
    return {
      headline: 'You’re offline',
      body: 'Search needs a connection. Your saved tickets still open without one.',
    };
  }
  if (isRateLimitedError(error)) {
    // Only reached once the automatic retries are used up.
    return { headline: 'Too many searches', body: 'Give it a moment, then try again.' };
  }
  return { headline: 'Search failed', body: error?.message ?? 'Check your connection and try again.' };
}
