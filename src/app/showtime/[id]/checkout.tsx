import { useStripe } from '@stripe/stripe-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { acquireCheckout, checkoutFailureMessage, idempotencyKeyFor } from '../../../api/checkout';
import { getClientId } from '../../../api/clientIdNative';
import { refundReasonCopy } from '../../../api/refundCopy';
import { usePaymentConfirmation } from '../../../api/usePaymentConfirmation';
import { Button, Card, EmptyState, Icon, Skeleton, Text } from '../../../components';
import * as haptics from '../../../lib/haptics';
import { classifyPaymentSheetError, MERCHANT_DISPLAY_NAME, readStripePublishableKey } from '../../../lib/stripe';
import { useTheme } from '../../../theme';
import { primitives } from '../../../tokens/tokens';

/**
 * Checkout (Figma 60:12130), pushed as a MODAL over the seat screen so the hold survives: the seat screen
 * stays mounted underneath and its hold hook never lets the seats go. The flow is checkout -> PaymentSheet ->
 * confirmation poll -> the ticket, and the rule is: PaymentSheet success is NOT a booking — the server confirms
 * only on its verified webhook, so the app polls `GET /orders/:reference` until the order resolves.
 */

type Phase = 'creating' | 'error' | 'confirming';

/** The booking card shown while confirming: the film, the showing + seats, and the server-formatted total. */
function BookingCard({ title, showing, seatCount, total }: { title?: string; showing?: string; seatCount: number; total: string | null }) {
  const line = showing ? `${showing} · Seats ${seatCount}` : `Seats ${seatCount}`;
  return (
    <Card title={title ?? 'Your booking'} body={line}>
      {total ? (
        <Text variant="label-lg" color="text/primary" tabularNums>
          Total {total}
        </Text>
      ) : null}
    </Card>
  );
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const params = useLocalSearchParams<{ id?: string; seats?: string; title?: string; showing?: string }>();
  const showtimeId = typeof params.id === 'string' ? params.id : '';
  const title = typeof params.title === 'string' && params.title ? params.title : undefined;
  const showing = typeof params.showing === 'string' && params.showing ? params.showing : undefined;
  const seatIds = useMemo(() => {
    try {
      const parsed: unknown = params.seats ? JSON.parse(params.seats) : [];
      return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
    } catch {
      return [];
    }
  }, [params.seats]);

  const { state: confirmation, controller: confirmationController } = usePaymentConfirmation();

  const [phase, setPhase] = useState<Phase>('creating');
  const [failure, setFailure] = useState<string | null>(null);
  const [total, setTotal] = useState<string | null>(null);

  // The refund copy (and where its action goes) for the `refunded` state. Pure and null-safe: a non-refunded
  // phase has a null reason, which resolves to the generic fallback and is never rendered.
  const refund = refundReasonCopy(confirmation.refundReason);

  const goBack = useCallback(() => router.back(), [router]);

  // A cancelled showing has no seat map to return to: dismiss the modal and the seat screen underneath, landing on
  // the tabs (Home). A deep link with nothing to dismiss falls back to Home.
  const goHome = useCallback(() => {
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  }, [router]);

  const goToTickets = useCallback(() => {
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/tickets' as Href);
  }, [router]);

  const run = useCallback(async () => {
    if (!showtimeId || seatIds.length === 0 || !readStripePublishableKey()) {
      setFailure(
        readStripePublishableKey()
          ? 'This order has no seats. Go back and pick again.'
          : 'Payments are not set up on this build.'
      );
      setPhase('error');
      return;
    }
    setPhase('creating');
    try {
      const checkout = await acquireCheckout(showtimeId, seatIds, idempotencyKeyFor(showtimeId, seatIds), await getClientId());
      if (!checkout.clientSecret) {
        setFailure('This order is already being processed. Go back and check your tickets.');
        setPhase('error');
        return;
      }
      setTotal(checkout.totalFormatted);

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: checkout.clientSecret,
        merchantDisplayName: MERCHANT_DISPLAY_NAME,
      });
      if (initError) {
        setFailure(initError.message);
        setPhase('error');
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      const outcome = classifyPaymentSheetError(presentError);
      if (outcome === 'success') {
        setPhase('confirming');
        confirmationController.start(checkout.reference);
      } else if (outcome === 'canceled') {
        goBack(); // back to the seats, hold alive; the deterministic key means a retry reuses the same order
      } else {
        setFailure(outcome === 'timeout' ? 'Payment timed out. Please try again.' : 'Payment could not be completed.');
        setPhase('error');
      }
    } catch (error) {
      setFailure(checkoutFailureMessage(error));
      setPhase('error');
    }
  }, [showtimeId, seatIds, initPaymentSheet, presentPaymentSheet, confirmationController, goBack]);

  // Run once per mount (a deterministic idempotency key means a StrictMode re-run would just replay the same order).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  // The confirmation machine's terminal states.
  useEffect(() => {
    if (confirmation.phase === 'succeeded') {
      haptics.success();
      router.replace({ pathname: '/ticket/[reference]', params: { reference: confirmation.reference } } as unknown as Href);
    } else if (confirmation.phase === 'refunded') {
      haptics.warning();
    }
  }, [confirmation.phase, confirmation.reference, router]);

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
        <View style={styles.titles}>
          <Text variant="title" color="text/primary" accessibilityRole="header">
            Checkout
          </Text>
          {title ? (
            <Text variant="caption" color="text/secondary" numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
      </View>

      {phase === 'creating' ? (
        <View style={styles.body}>
          <Skeleton shape="text" width={primitives['space/16']} height={primitives['space/5']} />
          <Skeleton shape="text" width={primitives['space/12']} height={primitives['space/3']} />
        </View>
      ) : null}

      {phase === 'error' ? (
        <EmptyState
          icon="error"
          headline="Couldn't start the payment"
          body={failure ?? 'Something went wrong.'}
          actionLabel="Back to seats"
          onAction={goBack}
        />
      ) : null}

      {phase === 'confirming' && (confirmation.phase === 'checking' || confirmation.phase === 'succeeded') ? (
        <View style={styles.body}>
          <View style={styles.dots} aria-hidden>
            <View style={[styles.dot, { backgroundColor: colors['primary/default'] }]} />
            <View style={[styles.dot, { backgroundColor: colors['primary/default'] }]} />
            <View style={[styles.dot, { backgroundColor: colors['primary/default'] }]} />
          </View>
          <Text variant="title-lg" color="text/primary" accessibilityRole="header">
            Confirming your booking
          </Text>
          <Text variant="body" color="text/secondary">
            This usually takes a few seconds. Please keep the app open.
          </Text>
          <BookingCard title={title} showing={showing} seatCount={seatIds.length} total={total} />
        </View>
      ) : null}

      {phase === 'confirming' && confirmation.phase === 'refunded' ? (
        <EmptyState
          icon="info"
          headline={refund.headline}
          body={refund.body}
          actionLabel={refund.destination === 'seats' ? 'Back to seats' : 'Back to home'}
          onAction={refund.destination === 'seats' ? goBack : goHome}
        />
      ) : null}

      {phase === 'confirming' && confirmation.phase === 'failed' ? (
        <EmptyState
          icon="error"
          headline="Payment didn't go through"
          body="No charge was made. Go back and try again."
          actionLabel="Back to seats"
          onAction={goBack}
        />
      ) : null}

      {phase === 'confirming' && confirmation.phase === 'unconfirmed' ? (
        <View style={styles.body}>
          <Icon name="success" size="xl" color="status/success" />
          <Text variant="title-lg" color="text/primary" accessibilityRole="header">
            Your payment went through
          </Text>
          <Text variant="body" color="text/secondary">
            Confirmation is taking longer than usual. Your ticket will appear in Tickets as soon as it&apos;s ready.
            You don&apos;t need to pay again.
          </Text>
          <BookingCard title={title} showing={showing} seatCount={seatIds.length} total={total} />
          <View style={styles.footer}>
            <Button variant="primary" fullWidth label="Go to Tickets" onPress={goToTickets} />
            <Button variant="secondary" fullWidth label="Back to Home" onPress={goHome} />
          </View>
        </View>
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
  titles: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: primitives['space/6'],
    paddingTop: primitives['space/8'],
    gap: primitives['space/3'],
  },
  dots: {
    flexDirection: 'row',
    gap: primitives['space/1'],
  },
  dot: {
    width: primitives['space/2'],
    height: primitives['space/2'],
    borderRadius: primitives['radius/full'],
  },
  footer: {
    marginTop: 'auto',
    gap: primitives['space/3'],
    paddingBottom: primitives['space/4'],
  },
});
