import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Countdown,
  EmptyState,
  LiveCountdown,
  OverloadedState,
  Skeleton,
  Text,
  Toast,
  WaitingRoomView,
  useToast,
} from '../../components';
import { readClock, startHoldClock } from '../../api/holdClock';
import { useClockSeconds } from '../../api/useClockSeconds';
import { useTheme } from '../../theme';
import { primitives } from '../../tokens/tokens';
import { GalleryGroup, GalleryItem, GalleryPanel, GalleryRow } from '../GalleryParts';
import { MOCK_TOASTS, MOCK_WAITING_ROOM } from '../mocks';

/** EmptyState fills its parent (flex: 1), so each demo frame needs a definite height. */
const FRAME_HEIGHT = primitives['space/16'] * 5;
const FRAME_HEIGHT_TALL = primitives['space/16'] * 6;
/** A whole waiting-room screen: the film, the line, the note and the button. */
const FRAME_HEIGHT_SCREEN = primitives['space/16'] * 8;

/** The live demo starts just over 2:00 out, so it crosses into urgent after five seconds and ends after 2:05. */
const LIVE_DEMO_MS = 125_000;
/** The overloaded state's live demo counts down the Figma example, 0:14, then says it is trying again. */
const OVERLOADED_DEMO_MS = 14_000;

export function FeedbackSection() {
  const { colors } = useTheme();
  const [liveClock, setLiveClock] = useState(() => startHoldClock(LIVE_DEMO_MS, readClock()));
  const [lastAction, setLastAction] = useState('none yet');
  const [toastAction, setToastAction] = useState('none yet');
  const toast = useToast();
  const [retryClock, setRetryClock] = useState(() => startHoldClock(OVERLOADED_DEMO_MS, readClock()));
  const retrySeconds = useClockSeconds(retryClock);

  return (
    <>
      <GalleryGroup
        name="Countdown"
        note="The seat-hold countdown, drawn from the seconds it is given: it never counts down by itself (LiveCountdown, below, does). Calm until 2:00; urgent for the last two minutes, the only place orange appears. Tabular figures keep the pill still as digits change."
      >
        <GalleryItem label="calm: 9:58, and 2:00 exactly (still calm)">
          <GalleryRow>
            <Countdown secondsRemaining={598} />
            <Countdown secondsRemaining={120} />
          </GalleryRow>
        </GalleryItem>
        <GalleryItem label="urgent: 1:59, and 0:09">
          <GalleryRow>
            <Countdown secondsRemaining={119} />
            <Countdown secondsRemaining={9} />
          </GalleryRow>
        </GalleryItem>
        <GalleryItem label="ended: 0:00 (the hold-expired sheet sits over this)">
          <GalleryRow>
            <Countdown secondsRemaining={0} />
          </GalleryRow>
        </GalleryItem>
      </GalleryGroup>

      <GalleryGroup
        name="LiveCountdown"
        note="The Countdown with a clock behind it, as the seat screen uses it. It is seeded with the time the server says is left, ticks on the second, never shows more time than the hold has (a changed clock or a long sleep shorten it, never lengthen it), and tells a screen reader the time at 5:00, 2:00, 1:00 and 0:30 rather than every second. Only the pill re-renders."
      >
        <GalleryItem label="live: starts at 2:05, goes urgent at 1:59 and ends at 0:00">
          <GalleryRow>
            <LiveCountdown clock={liveClock} />
            <Button
              variant="secondary"
              label="Restart"
              onPress={() => setLiveClock(startHoldClock(LIVE_DEMO_MS, readClock()))}
            />
          </GalleryRow>
        </GalleryItem>
      </GalleryGroup>

      <GalleryGroup
        name="Toast"
        note="A short message above the content, never covering the main button. 3 tones, each with its own icon shape (the tone is not colour alone). The action is optional. A toast dismisses itself: 4 s for a plain message, 6 s for an error or one with an action."
      >
        <GalleryItem label="info, success, error">
          <View style={styles.stack}>
            <Toast tone="info" message={MOCK_TOASTS.info} />
            <Toast tone="success" message={MOCK_TOASTS.success} />
            <Toast tone="error" message={MOCK_TOASTS.error} />
          </View>
        </GalleryItem>
        <GalleryItem label="with an action">
          <View style={styles.stack}>
            <Toast tone="info" message={MOCK_TOASTS.info} action={{ label: 'Undo', onPress: () => {} }} />
            <Toast tone="error" message={MOCK_TOASTS.error} action={{ label: 'Retry', onPress: () => {} }} />
          </View>
        </GalleryItem>
        <GalleryItem label="a long message wraps">
          <Toast tone="error" message={MOCK_TOASTS.long} action={{ label: 'Retry', onPress: () => {} }} />
        </GalleryItem>

        <GalleryItem label="live, through ToastProvider and useToast (auto-dismiss; a new toast replaces the old one)">
          <View style={styles.liveButtons}>
            <Button
              variant="secondary"
              label="Show info"
              onPress={() => toast.show({ tone: 'info', message: MOCK_TOASTS.info })}
            />
            <Button
              variant="secondary"
              label="Show success"
              onPress={() => toast.show({ tone: 'success', message: MOCK_TOASTS.success })}
            />
            <Button
              variant="secondary"
              label="Show error"
              onPress={() => toast.show({ tone: 'error', message: MOCK_TOASTS.error })}
            />
            <Button
              variant="secondary"
              label="Show with action"
              onPress={() =>
                toast.show({
                  tone: 'error',
                  message: MOCK_TOASTS.error,
                  action: { label: 'Retry', onPress: () => setToastAction('Retry') },
                })
              }
            />
            <Button variant="text" label="Dismiss" onPress={toast.dismiss} />
          </View>
          <Text variant="caption" color="text/secondary" accessibilityLiveRegion="polite">
            {`Last toast action: ${toastAction}`}
          </Text>
        </GalleryItem>
      </GalleryGroup>

      <GalleryGroup
        name="Skeleton"
        note="4 shapes. Pulses between skeleton/base and skeleton/highlight with Reanimated; holds the base colour when the OS reduce-motion setting is on. Used instead of spinners."
      >
        <GalleryItem label="block, text, poster, circle">
          <GalleryRow>
            <Skeleton shape="block" width={primitives['space/16'] * 2} />
            <Skeleton shape="text" width={primitives['space/16'] * 2} />
            <Skeleton shape="poster" />
            <Skeleton shape="circle" />
          </GalleryRow>
        </GalleryItem>

        <GalleryItem label="on a raised surface, the way a card loads">
          <GalleryPanel>
            <Skeleton shape="text" width="60%" height={primitives['space/5']} />
            <Skeleton shape="text" width="90%" />
            <Skeleton shape="text" width="75%" />
          </GalleryPanel>
        </GalleryItem>
      </GalleryGroup>

      <GalleryGroup
        name="EmptyState"
        note="One headline, one body, exactly one primary action. A second, quieter action is optional. With an icon it becomes a system state: info, or error for server problems."
      >
        <GalleryItem label="plain">
          <View style={[styles.frame, { borderColor: colors['border/default'], height: FRAME_HEIGHT }]}>
            <EmptyState
              headline="No tickets yet"
              body="When you book a film, your tickets will show up here."
              actionLabel="Browse films"
              onAction={() => setLastAction('Browse films')}
            />
          </View>
        </GalleryItem>

        <GalleryItem label="info icon">
          <View style={[styles.frame, { borderColor: colors['border/default'], height: FRAME_HEIGHT }]}>
            <EmptyState
              icon="info"
              headline="Nothing’s showing yet"
              body="New films are added every week. Check back soon, or search for a title."
              actionLabel="Refresh"
              onAction={() => setLastAction('Refresh')}
            />
          </View>
        </GalleryItem>

        <GalleryItem label="error icon, with a secondary action">
          <View style={[styles.frame, { borderColor: colors['border/default'], height: FRAME_HEIGHT_TALL }]}>
            <EmptyState
              icon="error"
              headline="Server overloaded"
              body="Movie data is temporarily unavailable. Please try again in a moment."
              actionLabel="Try again"
              onAction={() => setLastAction('Try again')}
              secondaryActionLabel="Open saved tickets"
              onSecondaryAction={() => setLastAction('Open saved tickets')}
            />
          </View>
        </GalleryItem>

        <GalleryItem label="action loading, with a footnote (the two props the overloaded state uses)">
          <View style={[styles.frame, { borderColor: colors['border/default'], height: FRAME_HEIGHT_TALL }]}>
            <EmptyState
              icon="info"
              headline="Checking again"
              body="This takes a moment. The button keeps its width while it works."
              actionLabel="Try again"
              actionLoading
              onAction={() => setLastAction('Try again (loading: ignored)')}
              footnote="A quiet caption under the actions"
            />
          </View>
        </GalleryItem>

        <Text variant="caption" color="text/secondary" accessibilityLiveRegion="polite">
          {`Last action: ${lastAction}`}
        </Text>
      </GalleryGroup>

      <GalleryGroup
        name="OverloadedState"
        note="Figma 'System / Server overloaded' (107:15558): an EmptyState with the info icon at 48, the reassurance that nothing was charged, one button, and a caption that counts down the server's Retry-After. For the booking funnel only (the seat screen and the waiting room); the rest of the app keeps the plain EmptyState. It draws the seconds it is given."
      >
        <GalleryItem label="counting down: 0:14">
          <View style={[styles.frame, { borderColor: colors['border/default'], height: FRAME_HEIGHT_TALL }]}>
            <OverloadedState secondsUntilRetry={14} onRetry={() => setLastAction('Try again now')} />
          </View>
        </GalleryItem>
        <GalleryItem label="trying again: the caption stops counting and the button works (loading dots)">
          <View style={[styles.frame, { borderColor: colors['border/default'], height: FRAME_HEIGHT_TALL }]}>
            <OverloadedState secondsUntilRetry={0} retrying onRetry={() => setLastAction('Try again now (loading: ignored)')} />
          </View>
        </GalleryItem>
        <GalleryItem label="live: counts 0:14 down to 'Trying again…' with a real clock, then Restart">
          <View style={[styles.frame, { borderColor: colors['border/default'], height: FRAME_HEIGHT_TALL }]}>
            <OverloadedState
              secondsUntilRetry={retrySeconds}
              onRetry={() => setRetryClock(startHoldClock(OVERLOADED_DEMO_MS, readClock()))}
            />
          </View>
          <Text variant="caption" color="text/secondary">
            Try again now restarts the demo countdown.
          </Text>
        </GalleryItem>
      </GalleryGroup>

      <GalleryGroup
        name="WaitingRoomView"
        note="Figma 'Booking / Waiting room' (56:6729). Position only, never a time (D4). The note says 'Keep Matinee open', a deliberate change from Figma's 'You can lock your phone; we'll tell you', because the app sends no push. For 1.3x text, set the system font size to 1.3 and look: type scales and the middle scrolls so the button stays reachable. Light and dark: use the chips at the top."
      >
        <GalleryItem label="default: 128 people ahead">
          <View style={[styles.frame, { borderColor: colors['border/default'], height: FRAME_HEIGHT_SCREEN }]}>
            <WaitingRoomView
              ahead={128}
              title={MOCK_WAITING_ROOM.title}
              showing={MOCK_WAITING_ROOM.showing}
              onLeave={() => setLastAction('Leave the queue')}
            />
          </View>
        </GalleryItem>
        <GalleryItem label="one person ahead (singular), no film known (a deep link)">
          <View style={[styles.frame, { borderColor: colors['border/default'], height: FRAME_HEIGHT_SCREEN }]}>
            <WaitingRoomView ahead={1} onLeave={() => setLastAction('Leave the queue')} />
          </View>
        </GalleryItem>
        <GalleryItem label="next: nobody ahead (no Figma frame, same type tokens)">
          <View style={[styles.frame, { borderColor: colors['border/default'], height: FRAME_HEIGHT_SCREEN }]}>
            <WaitingRoomView
              ahead={0}
              title={MOCK_WAITING_ROOM.title}
              showing={MOCK_WAITING_ROOM.showing}
              onLeave={() => setLastAction('Leave the queue')}
            />
          </View>
        </GalleryItem>
        <GalleryItem label="stale: the last refresh failed, so the number may be old">
          <View style={[styles.frame, { borderColor: colors['border/default'], height: FRAME_HEIGHT_SCREEN }]}>
            <WaitingRoomView
              ahead={42}
              stale
              title={MOCK_WAITING_ROOM.title}
              showing={MOCK_WAITING_ROOM.showing}
              onLeave={() => setLastAction('Leave the queue')}
            />
          </View>
        </GalleryItem>
        <GalleryItem label="skeleton: the join has not answered yet">
          <View style={[styles.frame, { borderColor: colors['border/default'], height: FRAME_HEIGHT_SCREEN }]}>
            <WaitingRoomView loading onLeave={() => setLastAction('Leave the queue')} />
          </View>
        </GalleryItem>
      </GalleryGroup>
    </>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: primitives['space/3'],
  },
  liveButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: primitives['space/3'],
  },
  frame: {
    borderWidth: primitives['border-width/default'],
    borderRadius: primitives['radius/lg'],
    paddingVertical: primitives['space/6'],
    overflow: 'hidden',
  },
});
