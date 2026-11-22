import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getClientId } from '../../api/clientIdNative';
import { requireBaseUrl } from '../../api/requireBaseUrl';
import { formatTicketDate, formatTicketSeats } from '../../api/ticket';
import { fetchTickets, isUpcomingTicket, ticketBadge, type TicketItem } from '../../api/tickets';
import { Badge, Card, Chip, EmptyState, Skeleton, Text, useNavBarClearance } from '../../components';
import { useTheme } from '../../theme';
import { primitives } from '../../tokens/tokens';

type Segment = 'upcoming' | 'past';
type Phase = 'loading' | 'ready' | 'error';

const SKELETON_CARDS = [0, 1, 2];

/** One ticket, as a tappable Card: title, "cinema · date, time · Seats …", a status badge, and "Saved on this phone". */
function TicketCard({ ticket, now, onPress }: { ticket: TicketItem; now: number; onPress: () => void }) {
  const badge = ticketBadge(ticket.status, ticket.startsAt, now);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ticket.movieTitle}, ${ticket.cinemaName}, ${badge.label}`}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.cardPressed : undefined)}
    >
      <Card
        title={ticket.movieTitle}
        body={`${ticket.cinemaName} · ${formatTicketDate(ticket.startsAt)}, ${ticket.time} · Seats ${formatTicketSeats(ticket.seats)}`}
      >
        <View style={styles.cardFooter}>
          <Badge tone={badge.tone} label={badge.label} />
          <Text variant="caption" color="text/secondary">
            Saved on this phone
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

function SkeletonTickets() {
  const { colors } = useTheme();
  return (
    <View style={styles.list}>
      {SKELETON_CARDS.map((i) => (
        <View key={i} style={[styles.skeletonCard, { backgroundColor: colors['surface/raised'], borderColor: colors['border/default'] }]}>
          <Skeleton shape="text" width={primitives['space/16']} height={20} />
          <Skeleton shape="text" width="100%" height={14} />
          <Skeleton shape="text" width={primitives['space/10']} height={14} />
        </View>
      ))}
    </View>
  );
}

export default function Tickets() {
  const router = useRouter();
  const { colors } = useTheme();
  const navClearance = useNavBarClearance();

  const [phase, setPhase] = useState<Phase>('loading');
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [segment, setSegment] = useState<Segment>('upcoming');
  const [now, setNow] = useState(0);

  const fetch = useCallback(async () => {
    setNow(Date.now());
    setPhase('loading');
    try {
      const result = await fetchTickets(await getClientId(), undefined, requireBaseUrl());
      setTickets(result);
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, []);

  // Fetch on every focus so a just-booked ticket appears on return to the tab; `retry` re-fetches in place.
  useFocusEffect(
    useCallback(() => {
      void fetch();
    }, [fetch])
  );

  const retry = () => void fetch();

  const visible = tickets.filter((t) => (segment === 'upcoming') === isUpcomingTicket(t.status, t.startsAt, now));
  const browse = () => router.navigate('/' as Href);
  const openTicket = (reference: string) =>
    router.push({ pathname: '/ticket/[reference]', params: { reference } } as unknown as Href);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'], paddingBottom: navClearance }]} edges={['top']}>
      <Text variant="title" color="text/primary" accessibilityRole="header">
        Tickets
      </Text>

      {phase === 'loading' ? <SkeletonTickets /> : null}

      {phase === 'error' ? (
        <View style={styles.stateWrap}>
          <EmptyState
            icon="error"
            headline="Couldn’t load your tickets"
            body="Check your connection and try again."
            actionLabel="Try again"
            onAction={retry}
          />
        </View>
      ) : null}

      {phase === 'ready' && tickets.length === 0 ? (
        <View style={styles.stateWrap}>
          <EmptyState
            icon="info"
            headline="No tickets yet"
            body="Book a film and your ticket will be kept here, ready for the door."
            actionLabel="Browse films"
            onAction={browse}
          />
        </View>
      ) : null}

      {phase === 'ready' && tickets.length > 0 ? (
        <>
          <View style={styles.segments}>
            <Chip label="Upcoming" selected={segment === 'upcoming'} accessibilityLabel="Upcoming tickets" onPress={() => setSegment('upcoming')} />
            <Chip label="Past" selected={segment === 'past'} accessibilityLabel="Past tickets" onPress={() => setSegment('past')} />
          </View>

          {visible.length > 0 ? (
            <ScrollView contentContainerStyle={styles.list}>
              {visible.map((t) => (
                <TicketCard key={t.reference} ticket={t} now={now} onPress={() => openTicket(t.reference)} />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.stateWrap}>
              <Text variant="body" color="text/secondary" style={styles.segmentEmpty}>
                Nothing here yet.
              </Text>
            </View>
          )}
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: primitives['space/6'] },
  segments: {
    flexDirection: 'row',
    gap: primitives['space/2'],
    marginTop: primitives['space/4'],
    marginBottom: primitives['space/3'],
  },
  list: {
    gap: primitives['space/3'],
    paddingBottom: primitives['space/4'],
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/2'],
    marginTop: primitives['space/2'],
  },
  stateWrap: {
    flex: 1,
  },
  segmentEmpty: {
    textAlign: 'center',
    marginTop: primitives['space/12'],
  },
  skeletonCard: {
    padding: primitives['space/4'],
    borderRadius: primitives['radius/lg'],
    borderWidth: primitives['border-width/default'],
    gap: primitives['space/2'],
  },
});
