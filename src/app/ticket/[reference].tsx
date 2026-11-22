import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getClientId } from '../../api/clientIdNative';
import { MovieApiError } from '../../api/movies';
import { fetchOrderStatus, type OrderStatusResponse } from '../../api/orderStatus';
import { refundReasonCopy } from '../../api/refundCopy';
import { requireBaseUrl } from '../../api/requireBaseUrl';
import { displayReference, formatTicketDate, formatTicketSeats } from '../../api/ticket';
import { Button, EmptyState, Icon, Logo, Skeleton, Text } from '../../components';
import { useTheme } from '../../theme';
import { primitives } from '../../tokens/tokens';

/**
 * The QR ticket after a confirmed booking (D4.6, ADR 0019). The reference is the ONLY thing the QR encodes —
 * it is a non-sensitive order id; the secret key never leaves the server. The ticket is read from
 * `GET /orders/:reference` (owner-scoped), so a deep link with someone else's reference shows "not found".
 */

type TicketStatus = 'loading' | 'ready' | 'not_found' | 'error';

/** The QR's ~177dp size (Figma 59:3968). A dimension, not a token. */
const QR_SIZE = 177;

const AT_THE_CINEMA_STEPS = [
  'Show this code at the door.',
  'It works without a signal. It is saved on this phone.',
  'One scan lets everyone in this booking through.',
] as const;

export default function TicketScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ reference?: string }>();
  const reference = typeof params.reference === 'string' ? params.reference : '';

  const [status, setStatus] = useState<TicketStatus>('loading');
  const [ticket, setTicket] = useState<OrderStatusResponse | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!reference) {
        setStatus('not_found');
        return;
      }
      setStatus('loading');
      try {
        const result = await fetchOrderStatus(reference, await getClientId(), undefined, requireBaseUrl());
        if (cancelled) return;
        setTicket(result);
        setStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setStatus(error instanceof MovieApiError && error.kind === 'not_found' ? 'not_found' : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reference, attempt]);

  // From checkout there is no history (the modal is replaced), so no back control; from Tickets the chevron shows.
  const canGoBack = router.canGoBack();
  const goBack = useCallback(() => router.back(), [router]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const goToTickets = () => router.navigate('/tickets' as Href);

  // A refunded order carries the server's reason; the non-succeeded state tailors its copy to it (e.g. a cancelled
  // showing). A failed / still-pending order has no reason and keeps the generic "wasn't confirmed" line.
  const refunded = ticket && ticket.status === 'refunded' ? refundReasonCopy(ticket.refundReason) : null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'] }]} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Logo variant="lockup-compact" />
        {canGoBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={goBack}
            style={({ pressed }) => [styles.backButton, pressed ? { backgroundColor: colors['secondary/pressed'] } : undefined]}
          >
            <Icon name="chevron-left" size="md" color="text/primary" />
          </Pressable>
        ) : null}
      </View>

      {status === 'loading' ? (
        <View style={styles.body}>
          <Skeleton shape="text" width={primitives['space/16']} height={primitives['space/6']} />
          <Skeleton shape="text" width={primitives['space/12']} height={primitives['space/3']} />
          <Skeleton shape="block" width={primitives['space/16'] + primitives['space/12']} height={primitives['space/16']} />
        </View>
      ) : null}

      {status === 'not_found' ? (
        <EmptyState
          icon="info"
          headline="Ticket not found"
          body="It may belong to another device, or have been removed."
          actionLabel="Back to home"
          onAction={goToTickets}
        />
      ) : null}

      {status === 'error' ? (
        <EmptyState
          icon="error"
          headline="Couldn't load the ticket"
          body="Check your connection and try again."
          actionLabel="Try again"
          onAction={retry}
        />
      ) : null}

      {status === 'ready' && ticket?.ticket ? (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            <View style={styles.heading}>
              <Text variant="title-lg" color="text/primary" accessibilityRole="header">
                You&apos;re going
              </Text>
              <Text variant="body" color="text/secondary">
                Booking confirmed · {displayReference(reference)}
              </Text>
            </View>

            <View style={[styles.ticketCard, { backgroundColor: colors['surface/raised'], borderColor: colors['border/default'] }]}>
              <View style={styles.ticketSection}>
                <Text variant="title" color="text/primary">
                  {ticket.ticket.movieTitle}
                </Text>
                <Text variant="body" color="text/secondary">
                  {ticket.ticket.cinemaName} · {ticket.ticket.screenName}
                </Text>
              </View>

              <View style={styles.qrWrap} accessible accessibilityLabel="Ticket QR code">
                <QRCode
                  value={reference}
                  size={QR_SIZE}
                  color={colors['qr/foreground']}
                  backgroundColor={colors['qr/background']}
                  ecl="M"
                />
              </View>

              <View style={[styles.perforation, { borderTopColor: colors['border/default'] }]} />

              <View style={styles.ticketSection}>
                <View style={styles.detailsRow}>
                  <View style={styles.detailCol}>
                    <Text variant="caption" color="text/secondary">
                      Date
                    </Text>
                    <Text variant="label-lg" color="text/primary">
                      {formatTicketDate(ticket.ticket.startsAt)}
                    </Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text variant="caption" color="text/secondary">
                      Time
                    </Text>
                    <Text variant="label-lg" color="text/primary" tabularNums>
                      {ticket.ticket.time}
                    </Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text variant="caption" color="text/secondary">
                      Seats
                    </Text>
                    <Text variant="label-lg" color="text/primary">
                      {formatTicketSeats(ticket.ticket.seats)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.cinemaSteps}>
              <Text variant="title" color="text/primary" accessibilityRole="header">
                At the cinema
              </Text>
              {AT_THE_CINEMA_STEPS.map((step, index) => (
                <View key={step} style={styles.step}>
                  <View style={[styles.stepNumber, { borderColor: colors['border/default'] }]}>
                    <Text variant="caption" color="text/secondary">
                      {index + 1}
                    </Text>
                  </View>
                  <Text variant="body" color="text/primary" style={styles.stepText}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button variant="primary" fullWidth label="Go to Tickets" onPress={goToTickets} />
          </View>
        </>
      ) : null}

      {status === 'ready' && ticket && !ticket.ticket ? (
        <EmptyState
          icon="info"
          headline={refunded ? refunded.headline : "This booking isn't available"}
          body={refunded ? refunded.body : "It wasn't confirmed. If you were charged, your payment has been refunded."}
          actionLabel="Back to home"
          onAction={goToTickets}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: primitives['space/2'],
    paddingHorizontal: primitives['space/4'],
    paddingTop: primitives['space/4'],
  },
  backButton: {
    width: primitives['size/touch-min'],
    height: primitives['size/touch-min'],
    borderRadius: primitives['radius/full'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  body: {
    padding: primitives['space/4'],
    gap: primitives['space/4'],
  },
  heading: {
    gap: primitives['space/1'],
  },
  ticketCard: {
    borderRadius: primitives['radius/lg'],
    borderWidth: primitives['border-width/default'],
    overflow: 'hidden',
  },
  ticketSection: {
    padding: primitives['space/4'],
    gap: primitives['space/1'],
  },
  qrWrap: {
    alignItems: 'center',
    paddingVertical: primitives['space/4'],
  },
  perforation: {
    borderTopWidth: primitives['border-width/default'],
  },
  detailsRow: {
    flexDirection: 'row',
    gap: primitives['space/4'],
  },
  detailCol: {
    flex: 1,
    gap: primitives['space/1'],
  },
  cinemaSteps: {
    gap: primitives['space/3'],
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/3'],
  },
  stepNumber: {
    width: primitives['size/icon-lg'],
    height: primitives['size/icon-lg'],
    borderRadius: primitives['radius/full'],
    borderWidth: primitives['border-width/default'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
  },
  footer: {
    padding: primitives['space/4'],
  },
});
