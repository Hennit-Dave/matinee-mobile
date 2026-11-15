import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  extractShowtimeDates,
  findNearestDateWithShowtimes,
  formatDateChipLabel,
  formatShortDateLabel,
  groupDateShowtimesByCinemaAndFormat,
} from '../../../../../api/movieDetailHelpers';
import { useMovieShowtimes } from '../../../../../api/useShowtimes';
import {
  Button,
  Chip,
  EmptyState,
  Icon,
  Skeleton,
  Text,
  useNavBarClearance,
} from '../../../../../components';
import { useTheme } from '../../../../../theme';
import { primitives } from '../../../../../tokens/tokens';

const SKELETON_DATE_CHIPS = [0, 1, 2, 3, 4];

export default function ShowtimesScreen() {
  const router = useRouter();
  const navClearance = useNavBarClearance();
  const { colors } = useTheme();

  const params = useLocalSearchParams<{ id?: string; title?: string }>();
  const movieId = Number(params.id);
  const movieTitle = typeof params.title === 'string' && params.title ? params.title : 'Showtimes';

  const { status, cinemas, error, isFetching, refetch } = useMovieShowtimes(movieId);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dateSummary = useMemo(() => extractShowtimeDates(cinemas), [cinemas]);
  const [chosenDate, setChosenDate] = useState<string | null>(null);

  const selectedDate =
    chosenDate && dateSummary.dates.includes(chosenDate) ? chosenDate : dateSummary.defaultDate;

  const groupedCinemas = useMemo(
    () => (selectedDate ? groupDateShowtimesByCinemaAndFormat(cinemas, selectedDate) : []),
    [cinemas, selectedDate]
  );

  const nearestDate = useMemo(
    () => (selectedDate ? findNearestDateWithShowtimes(selectedDate, dateSummary.hasShowtimesDates) : null),
    [selectedDate, dateSummary.hasShowtimesDates]
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'] }]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: navClearance }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed ? { backgroundColor: colors['secondary/pressed'] } : undefined,
            ]}
          >
            <Icon name="chevron-left" size="md" color="text/primary" />
          </Pressable>
          <View style={styles.titles}>
            <Text variant="caption" color="text/secondary">
              Showtimes
            </Text>
            {status === 'loading' && !params.title ? (
              <Skeleton shape="text" width={160} height={20} />
            ) : (
              <Text variant="title" color="text/primary" numberOfLines={2}>
                {movieTitle}
              </Text>
            )}
          </View>
        </View>

        {status === 'loading' ? (
          <>
            <View style={styles.skeletonDates}>
              {SKELETON_DATE_CHIPS.map((item) => (
                <Skeleton key={item} shape="block" width={72} height={primitives['size/chip-height']} />
              ))}
            </View>
            <View style={styles.cinemasList}>
              <View style={styles.cinemaBlock}>
                <Skeleton shape="text" width={180} height={20} />
                <View style={styles.formatBlock}>
                  <Skeleton shape="text" width={72} height={14} />
                  <View style={styles.timesRow}>
                    <Skeleton shape="block" width={70} height={primitives['size/chip-height']} />
                    <Skeleton shape="block" width={70} height={primitives['size/chip-height']} />
                    <Skeleton shape="block" width={70} height={primitives['size/chip-height']} />
                  </View>
                </View>
                <View style={styles.formatBlock}>
                  <Skeleton shape="text" width={72} height={14} />
                  <View style={styles.timesRow}>
                    <Skeleton shape="block" width={70} height={primitives['size/chip-height']} />
                    <Skeleton shape="block" width={70} height={primitives['size/chip-height']} />
                  </View>
                </View>
              </View>
            </View>
          </>
        ) : null}

        {status === 'server_overloaded' ? (
          <EmptyState
            icon="error"
            headline="Server overloaded"
            body="Showtimes are temporarily unavailable. Please try again in a moment."
            actionLabel={isFetching ? 'Retrying…' : 'Try again'}
            onAction={refetch}
          />
        ) : null}

        {status === 'error' ? (
          <EmptyState
            icon="error"
            headline="Couldn’t load showtimes"
            body={error?.message ?? 'Check your connection and try again.'}
            actionLabel={isFetching ? 'Retrying…' : 'Try again'}
            onAction={refetch}
          />
        ) : null}

        {status === 'empty' ? (
          <EmptyState
            icon="info"
            headline="No showtimes available"
            body="There are no upcoming screenings scheduled for this film."
            actionLabel="Go back"
            onAction={() => router.back()}
          />
        ) : null}

        {status === 'ready' ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.datesRow}
            >
              {dateSummary.dates.map((date) => (
                <Chip
                  key={date}
                  label={formatDateChipLabel(date, todayIso)}
                  selected={date === selectedDate}
                  onPress={() => setChosenDate(date)}
                />
              ))}
            </ScrollView>

            <View style={styles.cinemasList}>
              {groupedCinemas.length > 0 ? (
                groupedCinemas.map((cinema) => (
                  <View key={cinema.cinemaId} style={styles.cinemaBlock}>
                    <Text variant="title" color="text/primary">
                      {cinema.cinemaName}
                    </Text>
                    {cinema.formats.map((group) => (
                      <View key={group.format} style={styles.formatBlock}>
                        <Text variant="label" color="text/secondary">
                          {group.format}
                        </Text>
                        <View style={styles.timesRow}>
                          {group.slots.map((slot) => (
                            <Chip
                              key={slot.id}
                              label={slot.time}
                              tabularNums
                              accessibilityLabel={`${cinema.cinemaName}, ${group.format}, ${slot.time}, ${slot.priceFormatted}`}
                              onPress={() => {
                                // Seat selection lands in the next slice.
                              }}
                            />
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                ))
              ) : selectedDate ? (
                <View style={styles.perDateEmpty}>
                  <View style={styles.perDateEmptyText}>
                    <Text variant="title-lg" color="text/primary" style={styles.centeredText}>
                      {`No showtimes on ${formatShortDateLabel(selectedDate)}`}
                    </Text>
                    <Text variant="body-lg" color="text/secondary" style={styles.centeredText}>
                      This film has no screenings that day. Try another date above.
                    </Text>
                  </View>
                  {nearestDate ? (
                    <Button
                      variant="primary"
                      label={`Show ${formatShortDateLabel(nearestDate)}`}
                      onPress={() => setChosenDate(nearestDate)}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    gap: primitives['space/6'],
    paddingTop: primitives['space/6'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: primitives['space/2'],
    gap: primitives['space/2'],
  },
  backButton: {
    width: primitives['size/touch-min'],
    height: primitives['size/touch-min'],
    borderRadius: primitives['radius/full'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: {
    flex: 1,
  },
  datesRow: {
    paddingHorizontal: primitives['space/4'],
    gap: primitives['space/2'],
  },
  skeletonDates: {
    flexDirection: 'row',
    paddingHorizontal: primitives['space/4'],
    gap: primitives['space/2'],
  },
  cinemasList: {
    paddingHorizontal: primitives['space/4'],
    gap: primitives['space/8'],
  },
  cinemaBlock: {
    gap: primitives['space/4'],
  },
  formatBlock: {
    gap: primitives['space/2'],
  },
  timesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: primitives['space/2'],
  },
  perDateEmpty: {
    alignItems: 'center',
    paddingHorizontal: primitives['space/6'],
    paddingVertical: primitives['space/8'],
    gap: primitives['space/6'],
  },
  perDateEmptyText: {
    gap: primitives['space/2'],
    width: '100%',
  },
  centeredText: {
    textAlign: 'center',
  },
});
