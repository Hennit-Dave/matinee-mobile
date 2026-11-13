import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatMovieMeta, normaliseSearchQuery } from '../api/movies';
import { useSearchMovies } from '../api/useMovies';
import { Button, EmptyState, Icon, Input, MovieCard, Skeleton, Text } from '../components';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = [0, 1, 2, 3];

export default function Search() {
  const router = useRouter();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { status, movies, error, isFetching, refetch } = useSearchMovies(debouncedQuery, 1);
  const normalised = normaliseSearchQuery(debouncedQuery);

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
          <Text variant="title" color="text/primary">
            Search
          </Text>
        </View>

        <Input
          leadingIcon="search"
          placeholder="Search movies"
          accessibilityLabel="Search movies"
          value={query}
          onChangeText={setQuery}
          onClear={() => {
            setQuery('');
            setDebouncedQuery('');
          }}
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => setDebouncedQuery(query)}
        />
      </View>

      {status === 'idle' ? (
        <View style={styles.idleWrap}>
          <Text variant="body" color="text/secondary">
            Type a movie title to search.
          </Text>
        </View>
      ) : null}

      {status === 'loading' ? (
        <View style={styles.skeletonList}>
          {SKELETON_ROWS.map((row) => (
            <View
              key={row}
              style={[
                styles.skeletonRow,
                {
                  backgroundColor: colors['surface/raised'],
                  borderColor: colors['border/default'],
                },
              ]}
            >
              <Skeleton
                shape="block"
                width={primitives['size/thumb-width']}
                height={primitives['size/thumb-height']}
              />
              <View style={styles.skeletonCopy}>
                <Skeleton shape="text" width="70%" />
                <Skeleton shape="text" width="90%" />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {status === 'server_overloaded' ? (
        <EmptyState
          icon="error"
          headline="Server overloaded"
          body="Movie data is temporarily unavailable. Please try again in a moment."
          actionLabel={isFetching ? 'Retrying…' : 'Try again'}
          onAction={refetch}
        />
      ) : null}

      {status === 'error' ? (
        <EmptyState
          icon="error"
          headline="Search failed"
          body={error?.message ?? 'Check your connection and try again.'}
          actionLabel={isFetching ? 'Retrying…' : 'Try again'}
          onAction={refetch}
        />
      ) : null}

      {status === 'empty' ? (
        <EmptyState
          icon="info"
          headline="No results"
          body={`No movies matched "${normalised}".`}
          actionLabel="Clear search"
          onAction={() => {
            setQuery('');
            setDebouncedQuery('');
          }}
        />
      ) : null}

      {status === 'ready' || status === 'offline_saved_data' ? (
        <FlatList
          data={movies}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            status === 'offline_saved_data' ? (
              <View
                style={[
                  styles.offlineStrip,
                  {
                    backgroundColor: colors['surface/raised'],
                    borderColor: colors['border/default'],
                  },
                ]}
              >
                <Text variant="body" color="text/secondary" style={styles.offlineText}>
                  Movie data unavailable — showing saved data.
                </Text>
                <Button variant="text" label="Retry" loading={isFetching} onPress={refetch} />
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <MovieCard
              layout="list"
              title={item.title}
              meta={formatMovieMeta(item)}
              posterUrl={item.posterUrl}
              onPress={() => {
                // Movie detail screen lands in a later slice.
              }}
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
    paddingHorizontal: primitives['space/6'],
    paddingTop: primitives['space/2'],
    paddingBottom: primitives['space/3'],
    gap: primitives['space/3'],
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/2'],
  },
  backButton: {
    minWidth: primitives['size/touch-min'],
    minHeight: primitives['size/touch-min'],
    borderRadius: primitives['radius/md'],
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -primitives['space/3'],
  },
  idleWrap: {
    paddingHorizontal: primitives['space/6'],
    paddingTop: primitives['space/4'],
  },
  skeletonList: {
    paddingHorizontal: primitives['space/6'],
    paddingTop: primitives['space/2'],
    gap: primitives['space/3'],
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/3'],
    padding: primitives['space/3'],
    borderRadius: primitives['radius/md'],
    borderWidth: primitives['border-width/default'],
  },
  skeletonCopy: {
    flex: 1,
    gap: primitives['space/2'],
  },
  listContent: {
    paddingHorizontal: primitives['space/6'],
    paddingTop: primitives['space/2'],
    paddingBottom: primitives['space/8'],
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
  offlineText: {
    flex: 1,
  },
});
