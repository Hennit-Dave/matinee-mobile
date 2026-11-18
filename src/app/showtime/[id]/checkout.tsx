import { useStripe } from '@stripe/stripe-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { acquireCheckout, checkoutFailureMessage, idempotencyKeyFor } from '../../../api/checkout';
import { getClientId } from '../../../api/clientIdNative';
import { usePaymentConfirmation } from '../../../api/usePaymentConfirmation';
import { EmptyState, Icon, Skeleton, Text } from '../../../components';
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

export default function CheckoutScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const params = useLocalSearchParams<{ id?: string; seats?: string; title?: string }>();
  const showtimeId = typeof params.id === 'string' ? params.id : '';
  const title = typeof params.title === 'string' && params.title ? params.title : undefined;
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

  const goBack = useCallback(() => router.back(), [router]);

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

      {phase === 'confirming' ? (
        confirmation.phase === 'checking' || confirmation.phase === 'succeeded' ? (
          <View style={styles.body}>
            <Skeleton shape="text" width={primitives['space/16']} height={primitives['space/5']} />
            <Text variant="body" color="text/secondary">
              Confirming your payment…
            </Text>
            {total ? (
              <Text variant="label-lg" color="text/primary" tabularNums>
                {total}
              </Text>
            ) : null}
          </View>
        ) : null
      ) : null}

      {phase === 'confirming' && confirmation.phase === 'refunded' ? (
        <EmptyState
          icon="info"
          headline="Your seats were released"
          body="Your payment has been refunded because the hold ran out. Pick different seats to try again."
          actionLabel="Back to seats"
          onAction={goBack}
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
        <EmptyState
          icon="info"
          headline="Still confirming"
          body="This is taking longer than usual. Your seats are still held."
          actionLabel="Check again"
          onAction={() => confirmationController.retry()}
          secondaryActionLabel="Back to seats"
          onSecondaryAction={goBack}
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
  titles: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: primitives['space/6'],
    paddingTop: primitives['space/8'],
    gap: primitives['space/3'],
  },
});
