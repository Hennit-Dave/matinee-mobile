import { type Href, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNowPlayingMovies } from '../../api/useMovies';
import { Button, EmptyState, Icon, MovieCard, Skeleton, Text, useNavBarClearance } from '../../components';
import { useTheme } from '../../theme';
import { primitives } from '../../tokens/tokens';

const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5];

export default function Home() {
  const router = useRouter();
  const { colors } = useTheme();
  // The list runs behind the floating NavBar; this keeps its last row (and the static states) clear of it.
  const navClearance = useNavBarClearance();
  const { status, movies, error, isFetching, refetch } = useNowPlayingMovies(1);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'] }]} edges={['top']}>
      <View style={styles.header}>
        <Text variant="display" color="text/primary">
          Matinee
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search movies"
          onPress={() => router.push('/search' as Href)}
          style={({ pressed }) => [
            styles.searchEntry,
            {
              backgroundColor: pressed ? colors['secondary/pressed'] : colors['surface/raised'],
              borderColor: colors['border/strong'],
            },
          ]}
        >
          <Icon name="search" size="md" color="text/secondary" />
          <Text variant="body-lg" color="text/secondary">
            Search movies
          </Text>
        </Pressable>

        <Text variant="title" color="text/primary" style={styles.sectionTitle}>
          Now playing
        </Text>
      </View>

      {status === 'loading' ? (
        <View style={[styles.skeletonGrid, { paddingBottom: navClearance }]}>
          {SKELETON_ITEMS.map((item) => (
            <View key={item} style={styles.skeletonCard}>
              <Skeleton shape="poster" />
              <Skeleton shape="text" width={primitives['size/poster-width']} />
            </View>
          ))}
        </View>
      ) : null}

      {status === 'server_overloaded' ? (
        <View style={{ flex: 1, paddingBottom: navClearance }}>
          <EmptyState
            icon="error"
            headline="Server overloaded"
            body="Movie data is temporarily unavailable. Please try again in a moment."
            actionLabel={isFetching ? 'Retrying…' : 'Try again'}
            onAction={refetch}
          />
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={{ flex: 1, paddingBottom: navClearance }}>
          <EmptyState
            icon="error"
            headline="Couldn’t load movies"
            body={error?.message ?? 'Check your connection and try again.'}
            actionLabel={isFetching ? 'Retrying…' : 'Try again'}
            onAction={refetch}
          />
        </View>
      ) : null}

      {status === 'empty' ? (
        <View style={{ flex: 1, paddingBottom: navClearance }}>
          <EmptyState
            icon="info"
            headline="No movies showing"
            body="There are no now-playing films to show right now."
            actionLabel="Refresh"
            onAction={refetch}
          />
        </View>
      ) : null}

      {status === 'ready' || status === 'offline_saved_data' ? (
        <FlatList
          data={movies}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[styles.listContent, { paddingBottom: navClearance }]}
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
              layout="poster-title"
              title={item.title}
              meta={item.year ? String(item.year) : undefined}
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
    paddingTop: primitives['space/4'],
    gap: primitives['space/4'],
  },
  searchEntry: {
    minHeight: primitives['size/input-height'],
    borderRadius: primitives['radius/md'],
    borderWidth: primitives['border-width/default'],
    paddingHorizontal: primitives['space/3'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/2'],
  },
  sectionTitle: {
    marginTop: primitives['space/2'],
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: primitives['space/6'],
    paddingTop: primitives['space/4'],
    gap: primitives['space/4'],
  },
  skeletonCard: {
    gap: primitives['space/2'],
  },
  listContent: {
    paddingHorizontal: primitives['space/6'],
    paddingTop: primitives['space/4'],
    gap: primitives['space/4'],
  },
  gridRow: {
    justifyContent: 'space-between',
    gap: primitives['space/4'],
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
