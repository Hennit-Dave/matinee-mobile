import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { isWaitingRoomRequiredError } from '../../../api/movies';
import {
  HELD_LOCKED_MESSAGE,
  STALE_MAP_MESSAGE,
  holdOutcomeNotice,
  lostPicksNotice,
  yourTurnNotice,
  type SeatNotice,
} from '../../../api/seatNotices';
import { NO_SEATS_MESSAGE, isShowtimeId, quietRejoinStatus } from '../../../api/seats';
import { useClockSeconds } from '../../../api/useClockSeconds';
import { usePollActive } from '../../../api/usePollActive';
import { useSeatHold } from '../../../api/useSeatHold';
import { useShowtimeSeats } from '../../../api/useSeats';
import { useWaitingRoom } from '../../../api/useWaitingRoom';
import {
  BottomSheet,
  Button,
  Countdown,
  EmptyState,
  Icon,
  LiveCountdown,
  OverloadedState,
  SeatLegend,
  SeatMap,
  Skeleton,
  Text,
  WaitingRoomView,
  useToast,
} from '../../../components';
import {
  MAX_SEATS_PER_BOOKING,
  composeSeatingSubtitle,
  findLostPicks,
  pruneUnavailable,
  selectedSeatNames,
  selectionHaptic,
  summarySeatsLine,
  toggleSeatSelection,
  withOwnHold,
} from '../../../components/seatMapLogic';
import * as haptics from '../../../lib/haptics';
import { useTheme } from '../../../theme';
import { primitives } from '../../../tokens/tokens';

const NO_SEATS: readonly string[] = [];

/**
 * "Pick your seats" (Figma: Booking / Seat selection). A root-level route, outside `(tabs)`, so the glass
 * NavBar is not drawn here (the NavBar lives in the tabs layout).
 *
 * Everything on screen comes from the server: the seats and their state, the showing, and the per-seat
 * price as a finished string. The app never computes or formats money.
 *
 * Traffic slice 5b makes the screen live (ADR 0015):
 * - Continue takes ONE atomic hold on the picked seats (not one per tap). While it is held the Countdown
 *   runs in the header (Figma 57:6720, 57:9738), the seats are drawn as "Yours" and the map is locked.
 * - The map refreshes itself every ~5 s while this screen is on top and the app is in the foreground, so a seat
 *   someone else takes shows up before Continue (Figma 57:7594).
 * - Leaving the screen gives the seats back. When the time runs out a sheet says so (Figma 57:11576).
 * Checkout, payment and the booking are the payments chapter: with seats held, Continue says so rather than
 * pretending (its destination is Figma Checkout, 60:12130).
 *
 * Traffic slice 5d puts the waiting room in front of all of it (ADR 0017). The server answers the seat map and a hold
 * with a 403 unless the install has a pass for this showing, so the screen joins the line first and shows
 * `WaitingRoomView` until it is let in; only then does the seat map load and start polling (the polls are the pass's
 * heartbeat). If the pass is lost later (a 403 from the map or from Continue) the screen joins again quietly and, for
 * Continue, takes the hold once it is back in. A server that says it is overloaded is shown `OverloadedState`, which
 * counts down the server's Retry-After and tries again by itself. Going back leaves the line.
 */
export default function SeatSelectionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ id?: string; title?: string; showing?: string }>();
  const showtimeId = typeof params.id === 'string' ? params.id : '';
  // The title and the showing are display-only, passed by the screen that linked here; a deep link has neither.
  const title = typeof params.title === 'string' && params.title ? params.title : undefined;
  const showing = typeof params.showing === 'string' && params.showing ? params.showing : undefined;

  const pollActive = usePollActive();
  // An id that is not a showing has no line to stand in: the room stays out of it and the screen shows what it always did.
  const standsInLine = isShowtimeId(showtimeId);
  const { state: room, controller: roomController } = useWaitingRoom(showtimeId, { enabled: standsInLine, active: pollActive });
  const admitted = !standsInLine || room.phase === 'admitted';
  const {
    status: seatsStatus,
    data,
    error,
    isFetching,
    stale,
    overloadClock,
    refetch,
  } = useShowtimeSeats(showtimeId, {
    // The map is asked for only once the room has let this install in: before that it would answer 403.
    enabled: admitted,
    polling: pollActive && admitted,
  });
  // A 403 for a person who was let in means the pass lapsed and the screen is joining again by itself (below): loading, not an error.
  const status = quietRejoinStatus(seatsStatus, error);
  const { state: hold, controller } = useSeatHold(showtimeId);
  const rows = data?.rows;
  // The "very busy" countdown for a seat map the server could not serve. When it ends the map is asked for again; in the
  // background it does not, and the refresh on return does (useShowtimeSeats).
  const overloadSeconds = useClockSeconds(status === 'server_overloaded' ? overloadClock : null, () => {
    if (pollActive) refetch();
  });
  const busySeconds = useClockSeconds(room.phase === 'busy' ? room.retry : null);

  const [picked, setPicked] = useState<readonly string[]>([]);
  // The latest picks, for a Toast action that runs later (written after render, read in a handler).
  const pickedRef = useRef(picked);
  useEffect(() => {
    pickedRef.current = picked;
  });

  const idle = hold.phase === 'idle';
  // The seats shown as "Yours": the picks, or (once Continue has been pressed) the seats of the hold.
  const selectedIds = useMemo(
    () => (idle ? (rows ? pruneUnavailable(picked, rows) : picked) : hold.seatIds),
    [idle, picked, rows, hold.seatIds]
  );
  // The server marks the caller's own held seats `held`, like anyone else's: draw them as "Yours" instead. That
  // includes behind the expiry sheet (Figma 57:11576 still shows them as Yours), where the last refresh predates
  // the end of the hold and so still says `held`.
  const showsOwnHold = hold.phase === 'held' || hold.phase === 'expired';
  const mapRows = useMemo(
    () => (rows ? withOwnHold(rows, showsOwnHold ? hold.seatIds : NO_SEATS) : rows),
    [rows, showsOwnHold, hold.seatIds]
  );
  const names = useMemo(() => (rows ? selectedSeatNames(rows, selectedIds) : []), [rows, selectedIds]);

  const [footerHeight, setFooterHeight] = useState(0);
  const toastOffset = footerHeight + primitives['space/4'];

  // ---- Things that happen to the user's seats ----------------------------------------------------
  // Two events change the picks: a refresh that shows a picked seat was taken by someone else, and a hold that
  // was refused because it was. Both are handled while rendering (React's "adjust state when an input changes"
  // pattern, guarded so it runs once per change) because they change `picked`; the words, buzz and refresh they
  // earn are carried in a `notice` and carried out by the effect below.
  const [notice, setNotice] = useState<SeatNotice | null>(null);
  const raise = (draft: Omit<SeatNotice, 'id'>) => setNotice((previous) => ({ ...draft, id: (previous?.id ?? 0) + 1 }));

  const [seenRows, setSeenRows] = useState(rows);
  if (rows !== seenRows) {
    setSeenRows(rows);
    if (idle && rows) {
      // A pick that is now held or sold by someone else: drop it AND say so (Figma "Seat taken", 57:7594).
      const lost = findLostPicks(picked, rows);
      if (lost.length > 0) {
        setPicked(picked.filter((id) => !lost.includes(id)));
        raise(lostPicksNotice(rows, lost));
      }
    }
  }

  const [seenOutcome, setSeenOutcome] = useState(0);
  if (hold.outcome && hold.outcome.id !== seenOutcome) {
    const { outcome } = hold;
    setSeenOutcome(outcome.id);
    // A 409 means the whole request was refused (nothing is held): drop the taken seats, keep the rest.
    if (outcome.kind === 'taken') setPicked(picked.filter((id) => !outcome.seatIds.includes(id)));
    const draft = holdOutcomeNotice(outcome, rows);
    if (draft) raise(draft);
  }

  // Let in after standing in the line: a pulse and a short Toast. Being let straight in (the room had space) is not an event.
  const [seenAdmission, setSeenAdmission] = useState(0);
  if (room.admission && room.admission.id !== seenAdmission) {
    setSeenAdmission(room.admission.id);
    if (room.admission.waited) raise(yourTurnNotice());
  }

  // The pass is gone (a 403 from the seat map): join again, quietly. The map stays on screen unless the line is no longer empty.
  useEffect(() => {
    if (isWaitingRoomRequiredError(error)) roomController.rejoin();
  }, [error, roomController]);

  // Continue was refused for the same reason (a 403): join again, then take the hold once it is back in.
  const resumeHold = useRef(false);
  useEffect(() => {
    if (hold.outcome?.kind !== 'needsPass') return;
    resumeHold.current = true;
    roomController.rejoin();
  }, [hold.outcome, roomController]);
  // Every admission after the first is a re-join. The map may have been refused (and, after three refusals, stopped polling)
  // while the pass was gone, so ask for it again now; and if Continue was what found the pass gone, take the hold.
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  });
  const admissionsSeen = useRef(0);
  useEffect(() => {
    if (!room.admission) return;
    admissionsSeen.current += 1;
    if (admissionsSeen.current > 1) refetchRef.current();
    if (!resumeHold.current) return;
    resumeHold.current = false;
    controller.acquire(pickedRef.current);
  }, [room.admission, controller]);

  const shownNotice = useRef(0);
  useEffect(() => {
    // The footer is measured once the map's layout is on screen. A notice raised before that (being let in is raised while
    // the waiting room still fills the screen) waits for it, so its Toast sits above the Continue button, not over it.
    if (!notice || notice.id <= shownNotice.current || footerHeight === 0) return;
    shownNotice.current = notice.id;
    if (notice.success) haptics.success();
    else if (notice.haptic) haptics.warning();
    toast.show({
      message: notice.message,
      tone: notice.tone,
      bottomOffset: toastOffset,
      action: notice.retry ? { label: 'Try again', onPress: () => controller.acquire(pickedRef.current) } : undefined,
    });
    if (notice.refetch) refetch();
  }, [notice, toast, toastOffset, footerHeight, controller, refetch]);

  // A refresh failed once or twice: the last good map stays, and we say so once.
  const wasStale = useRef(false);
  useEffect(() => {
    if (stale && !wasStale.current) toast.show({ message: STALE_MAP_MESSAGE, tone: 'info', bottomOffset: toastOffset });
    wasStale.current = stale;
  }, [stale, toast, toastOffset]);

  const onSelectSeat = useCallback(
    (seatId: string) => {
      if (hold.phase !== 'idle') {
        // The map is locked while seats are held, so a stray tap cannot start collecting more of them.
        if (hold.phase === 'held') {
          toast.show({ message: HELD_LOCKED_MESSAGE, tone: 'info', bottomOffset: toastOffset });
        }
        return;
      }
      const change = toggleSeatSelection(selectedIds, seatId);
      // One deliberate haptic per tap that reaches here: a tick for a pick or a drop, a warning when the cap
      // refuses. Nothing on pan, pinch, zoom or scroll.
      if (selectionHaptic(change) === 'warning') haptics.warning();
      else haptics.selection();
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
    [hold.phase, selectedIds, toast, toastOffset]
  );

  const onContinue = useCallback(() => {
    if (hold.phase === 'held') {
      // The seats ARE held: open checkout as a MODAL over this screen, so the hold survives. Payment itself is
      // the payments chapter; the seat screen only hands over the showtime and the held seats.
      router.push({
        pathname: '/showtime/[id]/checkout',
        params: {
          id: showtimeId,
          seats: JSON.stringify(hold.seatIds),
          ...(title ? { title } : {}),
          ...(showing ? { showing } : {}),
        },
      } as unknown as Href);
      return;
    }
    controller.acquire(selectedIds);
  }, [hold.phase, controller, selectedIds, router, showtimeId, hold.seatIds, title, showing]);

  const onChangeSeats = useCallback(() => {
    controller.release(); // gives the seats back; the picks stay, so they can be adjusted
    refetch(); // so the seats we just let go of show as available
  }, [controller, refetch]);

  const onChooseAgain = useCallback(() => {
    controller.chooseAgain();
    setPicked([]);
    refetch();
  }, [controller, refetch]);

  // Back, swipe and the system back all unmount this screen, and the hold hook gives the seats back then and the waiting
  // room hook gives the place back.
  const goBack = useCallback(() => router.back(), [router]);

  // "Leave the queue": give the place back now, then go back. A deep link has nowhere to go back to, so it goes home.
  const onLeaveQueue = useCallback(() => {
    roomController.leave();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [roomController, router]);

  const loading = status === 'loading';
  const showsMap = status === 'loading' || status === 'ready';
  const acquiring = hold.phase === 'acquiring';
  const canContinue =
    status === 'ready' && (acquiring || hold.phase === 'held' || (idle && selectedIds.length > 0));
  const subtitle = data
    ? composeSeatingSubtitle({ title, startsAt: data.startsAt, time: data.time, format: data.screen.format })
    : title;

  // The line comes first. Nothing below (the map, the footer, the polling) is shown until the room lets this install in.
  if (!admitted) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'] }]} edges={['top', 'bottom']}>
        {room.phase === 'busy' ? (
          // Figma 107:15558: the server (or the line) is full. It counts down and tries again by itself.
          <View style={styles.content}>
            <ScreenHeader subtitle={title} onBack={goBack} />
            <OverloadedState secondsUntilRetry={busySeconds} retrying={room.retrying} onRetry={roomController.retry} />
          </View>
        ) : room.phase === 'failed' ? (
          <View style={styles.content}>
            <ScreenHeader subtitle={title} onBack={goBack} />
            {room.failure?.kind === 'not_found' ? (
              <EmptyState
                icon="info"
                headline="This showing isn’t available"
                body="It may have been removed. Pick another time."
                actionLabel="See other times"
                onAction={goBack}
              />
            ) : (
              <EmptyState
                icon="error"
                headline="Couldn’t join the queue"
                body={room.failure?.message ?? 'Check your connection and try again.'}
                actionLabel="Try again"
                onAction={roomController.retry}
              />
            )}
          </View>
        ) : (
          // Figma 56:6607 (and the skeleton 56:6691 until the join answers).
          <WaitingRoomView
            loading={room.phase !== 'waiting'}
            ahead={room.ahead ?? 0}
            stale={room.stale}
            title={title}
            showing={showing}
            onLeave={onLeaveQueue}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'] }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader subtitle={subtitle} loadingSubtitle={loading} onBack={goBack}>
          {/* The hold's Countdown (Figma header, right): running while held, "0:00" under the expiry sheet. */}
          {hold.phase === 'held' && hold.clock ? <LiveCountdown clock={hold.clock} /> : null}
          {hold.phase === 'expired' ? <Countdown secondsRemaining={0} /> : null}
        </ScreenHeader>

        {showsMap ? (
          <View style={styles.map}>
            <SeatMap
              loading={loading}
              rows={mapRows}
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
          // Figma 107:15558. The booking funnel counts down the server's Retry-After and tries again by itself.
          <OverloadedState secondsUntilRetry={overloadSeconds} retrying={isFetching} onRetry={refetch} />
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
        {hold.phase === 'held' ? (
          <View style={styles.changeRow}>
            <Button variant="text" label="Change seats" onPress={onChangeSeats} />
          </View>
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
          <Button variant="primary" label="Continue" loading={acquiring} disabled={!canContinue} onPress={onContinue} />
        </View>
      </View>

      {/* Figma 57:11576: the hold ran out. One clear next step. */}
      <BottomSheet visible={hold.phase === 'expired'} onClose={onChooseAgain} accessibilityLabel="Your seats were released">
        <View style={styles.sheetBody}>
          <View style={styles.sheetText}>
            <Text variant="title" color="text/primary" accessibilityRole="header">
              Your seats were released
            </Text>
            <Text variant="body" color="text/secondary">
              The 10-minute hold ended. The showing still has seats, so you can choose again.
            </Text>
          </View>
          <Button variant="primary" fullWidth label="Choose seats again" onPress={onChooseAgain} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

interface ScreenHeaderProps {
  /** The line under the title (the film, and when known the showing). */
  subtitle?: string;
  /** No subtitle yet because the seat map is still loading: draw its skeleton. */
  loadingSubtitle?: boolean;
  onBack: () => void;
  /** Right-hand side: the hold's countdown. */
  children?: ReactNode;
}

/** The back button, "Pick your seats" and the film: the header of the map, and of the states that replace the map. */
function ScreenHeader({ subtitle, loadingSubtitle = false, onBack, children }: ScreenHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed ? { backgroundColor: colors['secondary/pressed'] } : undefined]}
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
        ) : loadingSubtitle ? (
          <Skeleton shape="text" width={primitives['size/poster-width']} height={primitives['space/3']} />
        ) : null}
      </View>
      {children}
    </View>
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
  changeRow: {
    alignItems: 'flex-start',
    // A text button has no container, so its padding would indent the label; pull it back to the footer's edge.
    marginLeft: -primitives['space/4'],
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
  sheetBody: {
    gap: primitives['space/4'],
    paddingBottom: primitives['space/4'],
  },
  sheetText: {
    gap: primitives['space/1'],
  },
});
