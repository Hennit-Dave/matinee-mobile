import { MovieApiError } from './movies';

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
