import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NO_SEATS_MESSAGE } from '../../../api/seats';
import { useShowtimeSeats } from '../../../api/useSeats';
import { Button, EmptyState, Icon, SeatLegend, SeatMap, Skeleton, Text, useToast } from '../../../components';
import {
  MAX_SEATS_PER_BOOKING,
  composeSeatingSubtitle,
  pruneUnavailable,
  selectedSeatNames,
  summarySeatsLine,
  toggleSeatSelection,
} from '../../../components/seatMapLogic';
import { useTheme } from '../../../theme';
import { primitives } from '../../../tokens/tokens';

/**
 * "Pick your seats" (Figma: Booking / Seat selection). A root-level route, outside `(tabs)`, so the glass
 * NavBar is not drawn here (the NavBar lives in the tabs layout).
 *
 * Everything on screen comes from the server: the seats and their state, the showing, and the per-seat
 * price as a finished string. The app never computes or formats money. Continue is inert for now:
 * checkout, payment and the seat hold are later slices, and the screen says so rather than pretending.
 */
export default function SeatSelectionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ id?: string; title?: string }>();
  const showtimeId = typeof params.id === 'string' ? params.id : '';
  // The title is display-only, passed by the screen that linked here; a deep link has none.
  const title = typeof params.title === 'string' && params.title ? params.title : undefined;

  const { status, data, error, isFetching, refetch } = useShowtimeSeats(showtimeId);
  const rows = data?.rows;

  const [picked, setPicked] = useState<readonly string[]>([]);
  // Picks that are no longer available (after a refresh) fall away rather than being booked.
  const selectedIds = useMemo(() => (rows ? pruneUnavailable(picked, rows) : picked), [picked, rows]);
  const names = useMemo(() => (rows ? selectedSeatNames(rows, selectedIds) : []), [rows, selectedIds]);

  const [footerHeight, setFooterHeight] = useState(0);
  const toastOffset = footerHeight + primitives['space/4'];

  const onSelectSeat = useCallback(
    (seatId: string) => {
      const change = toggleSeatSelection(selectedIds, seatId);
      if (change.limitReached) {
        toast.show({
          message: `You can pick up to ${MAX_SEATS_PER_BOOKING} seats.`,
          tone: 'info',
          bottomOffset: toastOffset,
        });
        return;
      }
      setPicked(change.next);
    },
    [selectedIds, toast, toastOffset]
  );

  const onContinue = useCallback(() => {
    toast.show({
      message: "Checkout isn't built yet. Your seats aren't held or booked.",
      tone: 'info',
      bottomOffset: toastOffset,
    });
  }, [toast, toastOffset]);

  const goBack = useCallback(() => router.back(), [router]);

  const loading = status === 'loading';
  const showsMap = status === 'loading' || status === 'ready';
  const canContinue = status === 'ready' && selectedIds.length > 0;
  const subtitle = data
    ? composeSeatingSubtitle({ title, startsAt: data.startsAt, time: data.time, format: data.screen.format })
    : title;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'] }]} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={goBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed ? { backgroundColor: colors['secondary/pressed'] } : undefined,
            ]}
          >
            <Icon name="chevron-left" size="lg" color="text/primary" />
          </Pressable>
          <View style={styles.titles}>
            <Text variant="title" color="text/primary" accessibilityRole="header">
              Pick your seats
            </Text>
            {subtitle ? (
              <Text variant="caption" color="text/secondary">
                {subtitle}
              </Text>
            ) : loading ? (
              <Skeleton shape="text" width={primitives['size/poster-width']} height={primitives['space/3']} />
            ) : null}
          </View>
          {/* The hold Countdown (Figma header, right) arrives with the live seat hold: nothing is held yet. */}
        </View>

        {showsMap ? (
          <View style={styles.map}>
            <SeatMap
              loading={loading}
              rows={rows}
              totalSeats={data?.screen.totalSeats}
              selectedIds={selectedIds}
              onSelectSeat={onSelectSeat}
            />
            <SeatLegend />
          </View>
        ) : null}

        {status === 'sold_out' && data ? (
          <EmptyState
            headline="This showing is sold out"
            body={`Every seat for ${data.time} is taken. Pick another time or day.`}
            actionLabel="See other times"
            onAction={goBack}
          />
        ) : null}

        {status === 'server_overloaded' ? (
          <EmptyState
            icon="error"
            headline="Server overloaded"
            body="Seats are temporarily unavailable. Please try again in a moment."
            actionLabel={isFetching ? 'Retrying…' : 'Try again'}
            onAction={refetch}
          />
        ) : null}

        {status === 'error' ? (
          <EmptyState
            icon="error"
            headline="Couldn’t load seats"
            body={
              error?.message === NO_SEATS_MESSAGE
                ? `${NO_SEATS_MESSAGE} Try again in a moment.`
                : (error?.message ?? 'Check your connection and try again.')
            }
            actionLabel={isFetching ? 'Retrying…' : 'Try again'}
            onAction={refetch}
          />
        ) : null}

        {status === 'not_found' ? (
          <EmptyState
            icon="info"
            headline="This showing isn’t available"
            body="It may have been removed. Pick another time."
            actionLabel="See other times"
            onAction={goBack}
          />
        ) : null}
      </View>

      <View
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        style={[
          styles.footer,
          {
            backgroundColor: colors['surface/overlay'],
            borderTopColor: colors['border/default'],
            paddingBottom: primitives['space/4'] + insets.bottom,
          },
        ]}
      >
        {status === 'ready' ? (
          <Text variant="caption" color="text/secondary">
            Preview only: seats aren’t held or booked yet.
          </Text>
        ) : null}
        <View style={styles.footerRow}>
          <View style={styles.summary}>
            {status === 'ready' && data ? (
              <>
                <Text variant="body" color="text/secondary" tabularNums numberOfLines={2}>
                  {summarySeatsLine(names)}
                </Text>
                {/* The server's finished per-seat price. The app never computes or formats a total. */}
                <Text variant="label-lg" color="text/primary" tabularNums>
                  {`${data.priceFormatted} each`}
                </Text>
              </>
            ) : (
              <>
                <Skeleton shape="text" width={primitives['space/16'] + primitives['space/8'] + primitives['space/1']} height={primitives['space/4'] - primitives['space/1'] / 2} />
                <Skeleton shape="text" width={primitives['space/16']} height={primitives['space/5'] - primitives['space/1'] / 2} />
              </>
            )}
          </View>
          <Button variant="primary" label="Continue" disabled={!canContinue} onPress={onContinue} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: primitives['space/4'],
    gap: primitives['space/4'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/2'],
    paddingTop: primitives['space/4'],
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
  map: {
    gap: primitives['space/4'],
  },
  footer: {
    borderTopWidth: primitives['border-width/default'],
    paddingHorizontal: primitives['space/4'],
    paddingTop: primitives['space/4'],
    gap: primitives['space/2'],
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/4'],
  },
  summary: {
    flex: 1,
    gap: primitives['space/1'] / 2,
  },
});
