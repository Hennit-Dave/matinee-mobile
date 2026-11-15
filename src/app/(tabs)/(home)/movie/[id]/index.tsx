import { useState } from 'react';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  composeMovieMetaLine,
  formatReleaseDate,
  formatRuntime,
} from '../../../../../api/movieDetailHelpers';
import { useMovieDetail } from '../../../../../api/useMovies';
import {
  BottomSheet,
  Button,
  EmptyState,
  HeroBackdrop,
  Icon,
  Skeleton,
  Text,
  useNavBarClearance,
} from '../../../../../components';
import { useTheme } from '../../../../../theme';
import { primitives } from '../../../../../tokens/tokens';

const HERO_HEIGHT = 448;
const FACT_LABEL_WIDTH = 96;

export default function MovieDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navClearance = useNavBarClearance();
  const { colors } = useTheme();

  const params = useLocalSearchParams<{ id?: string; title?: string; posterUrl?: string }>();
  const movieId = Number(params.id);
  const paramTitle = typeof params.title === 'string' ? params.title : '';
  const paramPosterUrl = typeof params.posterUrl === 'string' && params.posterUrl ? params.posterUrl : null;

  const { status, detail, error, isFetching, refetch } = useMovieDetail(movieId);
  const [sheetVisible, setSheetVisible] = useState(false);

  const fallbackPosterUrl = detail?.posterUrl ?? paramPosterUrl;
  const primaryHeroUrl = detail?.backdropUrl ?? fallbackPosterUrl;
  const displayTitle = detail?.title ?? paramTitle;
  const metaLine = detail ? composeMovieMetaLine(detail) : '';

  const factRows = detail
    ? [
        { label: 'Director', value: detail.director },
        { label: 'Cast', value: detail.cast.length > 0 ? detail.cast.join(', ') : null },
        { label: 'Runtime', value: formatRuntime(detail.runtimeMinutes) },
        { label: 'Rating', value: detail.certification },
        { label: 'Released', value: formatReleaseDate(detail.releaseDate) },
        { label: 'Language', value: detail.language },
      ].filter((row): row is { label: string; value: string } => Boolean(row.value))
    : [];

  const backTop = Math.max(insets.top + primitives['space/2'], primitives['space/8']);

  return (
    <View style={[styles.screen, { backgroundColor: colors['surface/default'] }]}>
      {status === 'loading' ? (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: navClearance }]}>
          <HeroBackdrop loading height={HERO_HEIGHT}>
            <Skeleton shape="text" width={240} height={24} />
            <Skeleton shape="text" width={200} height={14} />
            <Skeleton shape="block" width="100%" height={primitives['size/touch-min']} />
          </HeroBackdrop>
          <View style={styles.about}>
            <Skeleton shape="text" width="100%" height={14} />
            <Skeleton shape="text" width="85%" height={14} />
            <Skeleton shape="block" width={72} height={primitives['size/touch-min']} />
          </View>
        </ScrollView>
      ) : null}

      {status === 'not_found' ? (
        <View style={[styles.stateWrap, { paddingTop: backTop + primitives['size/touch-min'], paddingBottom: navClearance }]}>
          <EmptyState
            icon="info"
            headline="Movie not found"
            body="We couldn’t find details for this film."
            actionLabel="Go back"
            onAction={() => router.back()}
          />
        </View>
      ) : null}

      {status === 'server_overloaded' ? (
        <View style={[styles.stateWrap, { paddingTop: backTop + primitives['size/touch-min'], paddingBottom: navClearance }]}>
          <EmptyState
            icon="error"
            headline="Server overloaded"
            body="Movie details are temporarily unavailable. Please try again in a moment."
            actionLabel={isFetching ? 'Retrying…' : 'Try again'}
            onAction={refetch}
          />
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={[styles.stateWrap, { paddingTop: backTop + primitives['size/touch-min'], paddingBottom: navClearance }]}>
          <EmptyState
            icon="error"
            headline="Couldn’t load movie"
            body={error?.message ?? 'Check your connection and try again.'}
            actionLabel={isFetching ? 'Retrying…' : 'Try again'}
            onAction={refetch}
          />
        </View>
      ) : null}

      {(status === 'ready' || status === 'offline_saved_data') && detail ? (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: navClearance }]}>
          <HeroBackdrop
            height={HERO_HEIGHT}
            imageUrl={primaryHeroUrl}
            fallbackImageUrl={detail?.backdropUrl ? fallbackPosterUrl : null}
            accessibilityLabel={`${displayTitle} poster`}
          >
            <Text variant="display" color="text/primary">
              {displayTitle}
            </Text>
            {metaLine ? (
              <Text variant="body" color="text/secondary">
                {metaLine}
              </Text>
            ) : null}
            <Button
              variant="primary"
              fullWidth
              label="See showtimes"
              onPress={() =>
                router.push({
                  pathname: '/movie/[id]/showtimes',
                  params: {
                    id: String(detail.id),
                    title: detail.title,
                  },
                } as unknown as Href)
              }
            />
          </HeroBackdrop>

          {status === 'offline_saved_data' ? (
            <View style={styles.offlineBanner}>
              <Icon name="info" size="md" color="text/secondary" />
              <Text variant="body" color="text/secondary" style={styles.offlineText}>
                You&apos;re offline. Showing saved details.
              </Text>
            </View>
          ) : null}

          <View style={styles.about}>
            {detail.overview ? (
              <Text variant="body-lg" color="text/primary" numberOfLines={3} ellipsizeMode="tail">
                {detail.overview}
              </Text>
            ) : null}
            <View style={styles.moreWrap}>
              <Button variant="text" label="More" onPress={() => setSheetVisible(true)} />
            </View>
          </View>

          <BottomSheet
            visible={sheetVisible}
            onClose={() => setSheetVisible(false)}
            accessibilityLabel={`About ${detail.title}`}
          >
            <Text variant="title" color="text/primary">
              About this film
            </Text>
            {detail.overview ? (
              <Text variant="body" color="text/primary">
                {detail.overview}
              </Text>
            ) : null}
            {factRows.length > 0 ? (
              <View style={styles.factsList}>
                {factRows.map((row) => (
                  <View key={row.label} style={styles.factRow}>
                    <Text variant="body" color="text/secondary" style={styles.factLabel}>
                      {row.label}
                    </Text>
                    <Text variant="body" color="text/primary" style={styles.factValue}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </BottomSheet>
        </ScrollView>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.backButton,
          {
            top: backTop,
            backgroundColor: pressed ? colors['secondary/pressed'] : colors['surface/overlay'],
            borderColor: colors['border/default'],
          },
        ]}
      >
        <Icon name="chevron-left" size="md" color="text/primary" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    gap: primitives['space/6'],
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: primitives['space/4'],
    gap: primitives['space/2'],
  },
  offlineText: {
    flex: 1,
  },
  about: {
    paddingHorizontal: primitives['space/4'],
    gap: primitives['space/2'],
    alignItems: 'flex-start',
  },
  moreWrap: {
    marginLeft: -primitives['space/4'],
  },
  backButton: {
    position: 'absolute',
    left: primitives['space/4'],
    width: primitives['size/touch-min'],
    height: primitives['size/touch-min'],
    borderRadius: primitives['radius/full'],
    borderWidth: primitives['border-width/default'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateWrap: {
    flex: 1,
  },
  factsList: {
    gap: primitives['space/3'],
    width: '100%',
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: primitives['space/4'],
  },
  factLabel: {
    width: FACT_LABEL_WIDTH,
  },
  factValue: {
    flex: 1,
  },
});
