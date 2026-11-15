import { type Href, useRouter } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  composeFeaturedMeta,
  resolveHeroHeight,
  resolveHeroImageCandidates,
  selectFeaturedMovie,
} from '../../../api/homeHelpers';
import { useMovieDetail, useNowPlayingMovies } from '../../../api/useMovies';
import {
  Button,
  EmptyState,
  HeroBackdrop,
  Icon,
  MovieCard,
  Skeleton,
  Text,
  useNavBarClearance,
} from '../../../components';
import { useTheme } from '../../../theme';
import { primitives } from '../../../tokens/tokens';

const SKELETON_CARDS = [0, 1, 2];

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { colors } = useTheme();
  const navClearance = useNavBarClearance();

  const heroHeight = resolveHeroHeight(windowHeight);
  const searchTop = Math.max(insets.top + primitives['space/2'], primitives['space/8']);

  const { status, movies, error, isFetching, refetch } = useNowPlayingMovies(1);
  const featured = selectFeaturedMovie(movies);
  const { detail: featuredDetail } = useMovieDetail(featured?.id ?? 0);

  const heroImages = featured
    ? resolveHeroImageCandidates(featured, featuredDetail)
    : { primaryUrl: null, fallbackUrl: null };
  const featuredMeta = featured ? composeFeaturedMeta(featured, featuredDetail) : '';

  return (
    <View style={[styles.screen, { backgroundColor: colors['surface/default'] }]}>
      {status === 'loading' ? (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: navClearance }]}>
          <HeroBackdrop loading height={heroHeight}>
            <Skeleton shape="text" width={240} height={primitives['space/6']} />
            <Skeleton shape="text" width={180} height={14} />
            <Skeleton shape="block" width="100%" height={primitives['size/touch-min']} />
          </HeroBackdrop>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Skeleton shape="text" width={140} height={20} />
            </View>
            <View style={styles.skeletonRow}>
              {SKELETON_CARDS.map((item) => (
                <Skeleton key={item} shape="poster" />
              ))}
            </View>
          </View>
        </ScrollView>
      ) : null}

      {status === 'server_overloaded' ? (
        <View
          style={[
            styles.stateWrap,
            {
              paddingTop: searchTop + primitives['size/touch-min'],
              paddingBottom: navClearance,
            },
          ]}
        >
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
        <View
          style={[
            styles.stateWrap,
            {
              paddingTop: searchTop + primitives['size/touch-min'],
              paddingBottom: navClearance,
            },
          ]}
        >
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
        <View
          style={[
            styles.stateWrap,
            {
              paddingTop: searchTop + primitives['size/touch-min'],
              paddingBottom: navClearance,
            },
          ]}
        >
          <EmptyState
            icon="info"
            headline="Nothing’s showing yet"
            body="New films are added every week. Check back soon, or search for a title."
            actionLabel="Refresh"
            onAction={refetch}
          />
        </View>
      ) : null}

      {(status === 'ready' || status === 'offline_saved_data') && featured ? (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: navClearance }]}>
          <HeroBackdrop
            height={heroHeight}
            imageUrl={heroImages.primaryUrl}
            fallbackImageUrl={heroImages.fallbackUrl}
            accessibilityLabel={`${featured.title} poster`}
          >
            <Text variant="display" color="text/primary">
              {featured.title}
            </Text>
            <Text variant="body" color="text/secondary">
              {featuredMeta}
            </Text>
            <Button
              variant="primary"
              fullWidth
              label="See showtimes"
              onPress={() =>
                router.push({
                  pathname: '/movie/[id]/showtimes',
                  params: {
                    id: String(featured.id),
                    title: featured.title,
                  },
                } as unknown as Href)
              }
            />
          </HeroBackdrop>

          {status === 'offline_saved_data' ? (
            <View style={styles.offlineBanner}>
              <Icon name="info" size="md" color="text/secondary" />
              <Text variant="body" color="text/secondary" style={styles.offlineText}>
                You&apos;re offline. Showing saved films.
              </Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="title" color="text/primary">
                Now playing
              </Text>
            </View>

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={movies}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.carouselContent}
              renderItem={({ item }) => (
                <MovieCard
                  layout="poster"
                  title={item.title}
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
          </View>
        </ScrollView>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search movies"
        onPress={() => router.push('/search' as Href)}
        style={({ pressed }) => [
          styles.searchButton,
          {
            top: searchTop,
            backgroundColor: pressed ? colors['secondary/pressed'] : colors['surface/overlay'],
            borderColor: colors['border/default'],
          },
        ]}
      >
        <Icon name="search" size="md" color="text/primary" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    gap: primitives['space/8'],
  },
  section: {
    gap: primitives['space/3'],
  },
  sectionHeader: {
    paddingHorizontal: primitives['space/4'],
  },
  skeletonRow: {
    flexDirection: 'row',
    paddingHorizontal: primitives['space/4'],
    gap: primitives['space/3'],
    overflow: 'hidden',
  },
  carouselContent: {
    paddingHorizontal: primitives['space/4'],
    gap: primitives['space/3'],
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: primitives['space/4'],
    paddingVertical: primitives['space/2'],
    gap: primitives['space/2'],
  },
  offlineText: {
    flex: 1,
  },
  stateWrap: {
    flex: 1,
  },
  searchButton: {
    position: 'absolute',
    right: primitives['space/4'],
    width: primitives['size/touch-min'],
    height: primitives['size/touch-min'],
    borderRadius: primitives['radius/full'],
    borderWidth: primitives['border-width/default'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
