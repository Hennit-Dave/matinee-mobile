import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getClientId } from '../../api/clientIdNative';
import { fetchOrderStatus, type OrderStatusResponse } from '../../api/orderStatus';
import { requireBaseUrl } from '../../api/requireBaseUrl';
import { EmptyState, Skeleton, Text } from '../../components';
import { useTheme } from '../../theme';
import { primitives } from '../../tokens/tokens';

/**
 * The ticket after a confirmed booking (D4.6). A minimal shell in payments P2: it reads the order status by
 * reference and shows the confirmed booking. The QR code and the full ticket design land in the next PR.
 */

export default function TicketScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ reference?: string }>();
  const reference = typeof params.reference === 'string' ? params.reference : '';

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [ticket, setTicket] = useState<OrderStatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!reference) {
        setStatus('error');
        return;
      }
      try {
        const result = await fetchOrderStatus(reference, await getClientId(), undefined, requireBaseUrl());
        if (cancelled) return;
        setTicket(result);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reference]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors['surface/default'] }]} edges={['top', 'bottom']}>
      <View style={styles.body}>
        {status === 'loading' ? (
          <>
            <Skeleton shape="text" width={primitives['space/16']} height={primitives['space/5']} />
            <Skeleton shape="text" width={primitives['space/12']} height={primitives['space/3']} />
            <Skeleton shape="text" width={primitives['space/10']} height={primitives['space/3']} />
          </>
        ) : null}

        {status === 'error' ? (
          <EmptyState
            icon="error"
            headline="Couldn't load the ticket"
            body="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => setStatus('loading')}
          />
        ) : null}

        {status === 'ready' && ticket?.ticket ? (
          <View style={styles.ticket}>
            <Text variant="title-lg" color="text/primary" accessibilityRole="header">
              {ticket.ticket.movieTitle}
            </Text>
            <Text variant="body" color="text/secondary">
              {ticket.ticket.cinemaName} · {ticket.ticket.screenName}
            </Text>
            <Text variant="body" color="text/secondary">
              {ticket.ticket.time} · {ticket.ticket.seats.map((s) => `${s.row}${s.number}`).join(', ')}
            </Text>
            <Text variant="label-lg" color="text/primary" tabularNums>
              {ticket.ticket.totalFormatted}
            </Text>
            <Text variant="caption" color="text/secondary">
              Reference {ticket.reference}
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, padding: primitives['space/6'], gap: primitives['space/3'] },
  ticket: { gap: primitives['space/2'] },
});
