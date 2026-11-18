import { MovieApiError } from './movies';
import { safeReadBaseUrl } from './useMovies';

/**
 * The base URL, or an error the callers read as "refused, nothing happened" (a missing setting is not a hold and not a
 * place in a line). Shared by the hooks that bind a controller to the real network (`useSeatHold`, `useWaitingRoom`).
 */
export function requireBaseUrl(): string {
  const { baseUrl, configError } = safeReadBaseUrl();
  if (baseUrl === null) {
    throw new MovieApiError(configError?.message ?? 'The API address is not set.', {
      status: 0,
      kind: 'validation_failed',
      retryable: false,
    });
  }
  return baseUrl;
}
