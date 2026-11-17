import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatMovieMeta, normaliseSearchQuery } from '../api/movies';
import {
  RATE_LIMITED_SEARCH_MESSAGE,
  formatFilmCount,
  resolveSearchMode,
  searchErrorCopy,
} from '../api/searchHelpers';
import { useDiscoverMovies, useGenres, useSearchMovies } from '../api/useMovies';
import { Button, Chip, EmptyState, Icon, Input, SearchResultRow, Skeleton, Text, useToast } from '../components';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = [0, 1, 2, 3];
const SKELETON_CHIPS = [84, 104, 76, 116, 72, 92];

export default function Search() {
  const router = useRouter();
  const { colors } = useTheme();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const normalised = normaliseSearchQuery(debouncedQuery);
  const mode = resolveSearchMode(normalised, selectedGenreId);

  const genresQuery = useGenres();
  const textQuery = useSearchMovies(debouncedQuery, 1);
  const discoverQuery = useDiscoverMovies(mode === 'genre' ? selectedGenreId : null, 1);
  const activeQuery = mode === 'genre' ? discoverQuery : textQuery;
  const { status, movies, totalResults, error, isFetching, refetch } = activeQuery;

  // The server said "too many searches" (429, ADR 0016): say so once, and let the search ask again after its
  // Retry-After by itself. `status` stays `loading` meanwhile, so the skeleton stays instead of "Search failed".
  const waitingOnRateLimit = mode === 'text' && textQuery.rateLimited;
  useEffect(() => {
    if (waitingOnRateLimit) toast.show({ message: RATE_LIMITED_SEARCH_MESSAGE, tone: 'info' });
  }, [waitingOnRateLimit, toast]);
  const errorCopy = searchErrorCopy(error);

  const clearAll = () => {
    setQuery('');
    setDebouncedQuery('');
    setSelectedGenreId(null);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'] }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed ? { backgroundColor: colors['secondary/pressed'] } : undefined,
            ]}
          >
            <Icon name="chevron-left" size="lg" color="text/primary" />
          </Pressable>
        </View>

        <Input
          label="Search"
          leadingIcon="search"
          placeholder="Film title"
          accessibilityLabel="Search"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (normaliseSearchQuery(text).length > 0 && selectedGenreId !== null) {
              setSelectedGenreId(null);
            }
          }}
          onClear={() => {
            setQuery('');
            setDebouncedQuery('');
          }}
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => setDebouncedQuery(query)}
        />
      </View>

      {mode === 'idle' ? (
        <ScrollView contentContainerStyle={styles.idleContent} keyboardShouldPersistTaps="handled">
          <View style={styles.genreSection}>
            <Text variant="title" color="text/primary">
              Browse by genre
            </Text>

            {genresQuery.isLoading ? (
              <View style={styles.chipCloud}>
                {SKELETON_CHIPS.map((width, index) => (
                  <Skeleton
                    key={index}
                    shape="block"
                    width={width}
                    height={primitives['size/chip-height']}
                  />
                ))}
              </View>
            ) : null}

            {genresQuery.isError ? (
              <View
                style={[
                  styles.genreErrorRow,
                  {
                    backgroundColor: colors['surface/raised'],
                    borderColor: colors['border/default'],
                  },
                ]}
              >
                <Text variant="body" color="text/secondary" style={styles.flexText}>
                  {genresQuery.error?.message ?? 'Couldn’t load genres.'}
                </Text>
                <Button
                  variant="text"
                  label={genresQuery.isFetching ? 'Retrying…' : 'Retry'}
                  loading={genresQuery.isFetching}
                  onPress={genresQuery.refetch}
                />
              </View>
            ) : null}

            {!genresQuery.isLoading && !genresQuery.isError && genresQuery.genres.length > 0 ? (
              <View style={styles.chipCloud}>
                {genresQuery.genres.map((genre) => (
                  <Chip
                    key={genre.id}
                    label={genre.name}
                    selected={genre.id === selectedGenreId}
                    onPress={() => setSelectedGenreId(genre.id)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
      ) : null}

      {mode === 'genre' && genresQuery.genres.length > 0 ? (
        <View style={styles.activeGenreBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeGenreRow}>
            {genresQuery.genres.map((genre) => (
              <Chip
                key={genre.id}
                label={genre.name}
                selected={genre.id === selectedGenreId}
                onPress={() => setSelectedGenreId((prev) => (prev === genre.id ? null : genre.id))}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {mode !== 'idle' && status === 'loading' ? (
        <View style={styles.skeletonList}>
          <Skeleton shape="text" width={primitives['space/12']} height={12} />
          {SKELETON_ROWS.map((row) => (
            <View key={row} style={styles.skeletonRow}>
              <Skeleton
                shape="block"
                width={primitives['size/thumb-width']}
                height={primitives['size/thumb-height']}
              />
              <View style={styles.skeletonCopy}>
                <Skeleton shape="text" width={180} height={16} />
                <Skeleton shape="text" width={120} height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {mode !== 'idle' && status === 'server_overloaded' ? (
        <EmptyState
          icon="error"
          headline="Server overloaded"
          body="Movie data is temporarily unavailable. Please try again in a moment."
          actionLabel={isFetching ? 'Retrying…' : 'Try again'}
          onAction={refetch}
        />
      ) : null}

      {mode !== 'idle' && status === 'error' ? (
        <EmptyState
          icon="error"
          headline={errorCopy.headline}
          body={errorCopy.body}
          actionLabel={isFetching ? 'Retrying…' : 'Try again'}
          onAction={refetch}
        />
      ) : null}

      {mode !== 'idle' && status === 'empty' ? (
        <EmptyState
          icon="info"
          headline={mode === 'text' ? `No films match '${normalised}'` : 'No films in this genre'}
          body="Check the spelling, or browse by genre instead."
          actionLabel="Clear search"
          onAction={clearAll}
        />
      ) : null}

      {mode !== 'idle' && (status === 'ready' || status === 'offline_saved_data') ? (
        <FlatList
          data={movies}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.resultsHeader}>
              {status === 'offline_saved_data' ? (
                <View
                  style={[
                    styles.offlineStrip,
                    {
                      backgroundColor: colors['surface/raised'],
                      borderColor: colors['border/default'],
                    },
                  ]}
                >
                  <Text variant="body" color="text/secondary" style={styles.flexText}>
                    Movie data unavailable — showing saved data.
                  </Text>
                  <Button variant="text" label="Retry" loading={isFetching} onPress={refetch} />
                </View>
              ) : null}
              <Text variant="caption" color="text/secondary">
                {formatFilmCount(totalResults, movies.length)}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <SearchResultRow
              title={item.title}
              meta={formatMovieMeta(item)}
              posterUrl={item.posterUrl}
              onPress={() =>
                router.push({
                  pathname: '/movie/[id]',
                  params: {
                    id: String(item.id),
                    title: item.title,
                    posterUrl: item.posterUrl ?? '',
                  },
                } as unknown as Href)
              }
            />
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: primitives['space/4'],
    paddingTop: primitives['space/2'],
    paddingBottom: primitives['space/4'],
    gap: primitives['space/2'],
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    minWidth: primitives['size/touch-min'],
    minHeight: primitives['size/touch-min'],
    borderRadius: primitives['radius/md'],
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -primitives['space/3'],
  },
  idleContent: {
    paddingHorizontal: primitives['space/4'],
    paddingTop: primitives['space/2'],
    paddingBottom: primitives['space/6'],
  },
  genreSection: {
    gap: primitives['space/3'],
  },
  chipCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: primitives['space/2'],
  },
  genreErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: primitives['space/3'],
    paddingRight: primitives['space/2'],
    paddingVertical: primitives['space/1'],
    borderRadius: primitives['radius/md'],
    borderWidth: primitives['border-width/default'],
    gap: primitives['space/2'],
  },
  activeGenreBar: {
    paddingBottom: primitives['space/2'],
  },
  activeGenreRow: {
    paddingHorizontal: primitives['space/4'],
    gap: primitives['space/2'],
  },
  skeletonList: {
    paddingHorizontal: primitives['space/4'],
    gap: primitives['space/3'],
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/3'],
  },
  skeletonCopy: {
    flex: 1,
    gap: primitives['space/2'],
  },
  resultsHeader: {
    gap: primitives['space/3'],
  },
  listContent: {
    paddingHorizontal: primitives['space/4'],
    paddingBottom: primitives['space/6'],
    gap: primitives['space/3'],
  },
  offlineStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: primitives['space/3'],
    paddingRight: primitives['space/2'],
    paddingVertical: primitives['space/1'],
    borderRadius: primitives['radius/md'],
    borderWidth: primitives['border-width/default'],
    gap: primitives['space/2'],
  },
  flexText: {
    flex: 1,
  },
});
