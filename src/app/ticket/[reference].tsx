import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getClientId } from '../../api/clientIdNative';
import { MovieApiError } from '../../api/movies';
import { fetchOrderStatus, type OrderStatusResponse } from '../../api/orderStatus';
import { requireBaseUrl } from '../../api/requireBaseUrl';
import { formatTicketDate, formatTicketSeats } from '../../api/ticket';
import { Card, EmptyState, Icon, Skeleton, Text } from '../../components';
import { useTheme } from '../../theme';
import { primitives } from '../../tokens/tokens';

/**
 * The QR ticket after a confirmed booking (D4.6, ADR 0019). The reference is the ONLY thing the QR encodes —
 * it is a non-sensitive order id; the secret key never leaves the server. The ticket is read from
 * `GET /orders/:reference` (owner-scoped), so a deep link with someone else's reference shows "not found".
 */

type TicketStatus = 'loading' | 'ready' | 'not_found' | 'error';

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

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'] }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={({ pressed }) => [styles.backButton, pressed ? { backgroundColor: colors['secondary/pressed'] } : undefined]}
        >
          <Icon name="chevron-left" size="md" color="text/primary" />
        </Pressable>
        <Text variant="title" color="text/primary" accessibilityRole="header">
          Your ticket
        </Text>
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
          onAction={goBack}
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
        <View style={styles.body}>
          <Card title={ticket.ticket.movieTitle} body={`${ticket.ticket.cinemaName} · ${ticket.ticket.screenName}`}>
            <View style={styles.qrWrap} accessible accessibilityLabel="Ticket QR code">
              <QRCode
                value={reference}
                size={primitives['space/16'] + primitives['space/10']}
                color={colors['qr/foreground']}
                backgroundColor={colors['qr/background']}
                ecl="M"
              />
            </View>
            <View style={styles.details}>
              <Text variant="body" color="text/secondary" tabularNums>
                {formatTicketDate(ticket.ticket.startsAt)} · {ticket.ticket.time}
              </Text>
              <Text variant="body" color="text/secondary">
                Seats {formatTicketSeats(ticket.ticket.seats)}
              </Text>
              <Text variant="label-lg" color="text/primary" tabularNums>
                {ticket.ticket.totalFormatted}
              </Text>
              <Text variant="caption" color="text/secondary">
                Reference {reference}
              </Text>
            </View>
          </Card>
        </View>
      ) : null}

      {status === 'ready' && ticket && !ticket.ticket ? (
        <EmptyState
          icon="info"
          headline="This booking isn't available"
          body="It wasn't confirmed. If you were charged, your payment has been refunded."
          actionLabel="Back to home"
          onAction={goBack}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  body: {
    flex: 1,
    padding: primitives['space/6'],
    gap: primitives['space/3'],
  },
  qrWrap: {
    alignItems: 'center',
    paddingVertical: primitives['space/4'],
  },
  details: {
    gap: primitives['space/1'],
  },
});
