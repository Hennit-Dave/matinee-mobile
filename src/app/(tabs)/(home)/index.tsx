import { type Href, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  composeFeaturedMeta,
  pickDetail,
  resolveHeroHeight,
  resolveHeroImageCandidates,
  selectHeroSlides,
} from '../../../api/homeHelpers';
import type { Movie } from '../../../api/movies';
import { useHeroCycle } from '../../../api/useHeroCycle';
import { useMovieDetail, useNowPlayingMovies, usePopularMovies } from '../../../api/useMovies';
import {
  Button,
  CrossfadeStack,
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
/** The outgoing hero slide stays mounted until the cross-fade has fully finished. */
const HERO_SETTLE_MS = primitives['duration/slow'] + primitives['duration/fast'];

function PosterRow({
  movies,
  onPressMovie,
}: {
  movies: readonly Movie[];
  onPressMovie: (movie: Movie) => void;
}) {
  return (
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
          onPress={() => onPressMovie(item)}
        />
      )}
    />
  );
}

function SkeletonSection({ headingWidth }: { headingWidth: number }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Skeleton shape="text" width={headingWidth} height={20} />
      </View>
      <View style={styles.skeletonRow}>
        {SKELETON_CARDS.map((item) => (
          <Skeleton key={item} shape="poster" />
        ))}
      </View>
    </View>
  );
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { colors } = useTheme();
  const navClearance = useNavBarClearance();
  const reducedMotion = Boolean(useReducedMotion());

  const heroHeight = resolveHeroHeight(windowHeight);
  const searchTop = Math.max(insets.top + primitives['space/2'], primitives['space/8']);

  const { status, movies, error, isFetching, refetch } = useNowPlayingMovies(1);
  const popular = usePopularMovies(1);

  const slides = useMemo(() => selectHeroSlides(movies), [movies]);
  const {
    index: heroIndex,
    nextIndex,
    previousIndex,
  } = useHeroCycle({
    count: slides.length,
    reducedMotion,
    settleMs: HERO_SETTLE_MS,
    getImageUrl: (slideIndex) => {
      const movie = slides[slideIndex];
      if (!movie) return null;
      return resolveHeroImageCandidates(movie, pickDetail([featuredDetail, nextDetail], movie.id))
        .primaryUrl;
    },
  });

  const featured = slides[heroIndex] ?? null;
  const nextSlide = slides[nextIndex] ?? null;
  const previousSlide = previousIndex !== null ? (slides[previousIndex] ?? null) : null;

  // Detail supplies the backdrop and the genre/runtime meta. Only the slide on screen, the one
  // arriving next (so it is warm before it fades in) and the one leaving are requested.
  const { detail: featuredDetail } = useMovieDetail(featured?.id ?? 0);
  const { detail: nextDetail } = useMovieDetail(
    nextSlide && nextSlide.id !== featured?.id ? nextSlide.id : 0
  );
  const { detail: previousDetail } = useMovieDetail(previousSlide?.id ?? 0);

  const openMovie = (movie: Movie) =>
    router.push({
      pathname: '/movie/[id]',
      params: {
        id: String(movie.id),
        title: movie.title,
        posterUrl: movie.posterUrl ?? '',
      },
    } as unknown as Href);

  const openShowtimes = (movie: Movie) =>
    router.push({
      pathname: '/movie/[id]/showtimes',
      params: {
        id: String(movie.id),
        title: movie.title,
      },
    } as unknown as Href);

  const renderSlide = (movie: Movie) => {
    const detail = pickDetail([featuredDetail, previousDetail, nextDetail], movie.id);
    const images = resolveHeroImageCandidates(movie, detail);
    return (
      <HeroBackdrop
        height={heroHeight}
        imageUrl={images.primaryUrl}
        fallbackImageUrl={images.fallbackUrl}
        accessibilityLabel={`${movie.title} poster`}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${movie.title} details`}
          onPress={() => openMovie(movie)}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.slideCopy}>
          <Text variant="display" color="text/primary">
            {movie.title}
          </Text>
          <Text variant="body" color="text/secondary">
            {composeFeaturedMeta(movie, detail)}
          </Text>
        </View>
        <Button
          variant="primary"
          fullWidth
          label="See showtimes"
          onPress={() => openShowtimes(movie)}
        />
      </HeroBackdrop>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors['surface/default'] }]}>
      {status === 'loading' ? (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: navClearance }]}>
          <HeroBackdrop loading height={heroHeight}>
            <Skeleton shape="text" width={240} height={primitives['space/6']} />
            <Skeleton shape="text" width={180} height={14} />
            <Skeleton shape="block" width="100%" height={primitives['size/touch-min']} />
          </HeroBackdrop>

          <SkeletonSection headingWidth={140} />
          <SkeletonSection headingWidth={100} />
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
          <CrossfadeStack
            reducedMotion={reducedMotion}
            incoming={{ key: String(featured.id), node: renderSlide(featured) }}
            outgoing={
              previousSlide
                ? { key: String(previousSlide.id), node: renderSlide(previousSlide) }
                : null
            }
          />

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

            <PosterRow movies={movies} onPressMovie={openMovie} />
          </View>

          {popular.status !== 'idle' ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text variant="title" color="text/primary">
                  Popular
                </Text>
              </View>

              {popular.status === 'loading' ? (
                <View style={styles.skeletonRow}>
                  {SKELETON_CARDS.map((item) => (
                    <Skeleton key={item} shape="poster" />
                  ))}
                </View>
              ) : null}

              {popular.status === 'ready' || popular.status === 'offline_saved_data' ? (
                <PosterRow movies={popular.movies} onPressMovie={openMovie} />
              ) : null}

              {popular.status === 'empty' ? (
                <Text variant="body" color="text/secondary" style={styles.inlineMessage}>
                  No popular films right now.
                </Text>
              ) : null}

              {popular.status === 'server_overloaded' || popular.status === 'error' ? (
                <View style={styles.inlineError}>
                  <Text variant="body" color="text/secondary">
                    {popular.status === 'server_overloaded'
                      ? 'Popular films are temporarily unavailable.'
                      : 'Couldn’t load popular films.'}
                  </Text>
                  <Button
                    variant="secondary"
                    label={popular.isFetching ? 'Retrying…' : 'Try again'}
                    loading={popular.isFetching}
                    onPress={popular.refetch}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
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
  slideCopy: {
    gap: primitives['space/2'],
  },
  inlineMessage: {
    paddingHorizontal: primitives['space/4'],
  },
  inlineError: {
    paddingHorizontal: primitives['space/4'],
    gap: primitives['space/3'],
    alignItems: 'flex-start',
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
