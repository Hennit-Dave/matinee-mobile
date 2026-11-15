import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, EmptyState, Skeleton, Text, Toast, useToast } from '../../components';
import { useTheme } from '../../theme';
import { primitives } from '../../tokens/tokens';
import { GalleryGroup, GalleryItem, GalleryPanel, GalleryRow } from '../GalleryParts';
import { MOCK_TOASTS } from '../mocks';

/** EmptyState fills its parent (flex: 1), so each demo frame needs a definite height. */
const FRAME_HEIGHT = primitives['space/16'] * 5;
const FRAME_HEIGHT_TALL = primitives['space/16'] * 6;

export function FeedbackSection() {
  const { colors } = useTheme();
  const [lastAction, setLastAction] = useState('none yet');
  const [toastAction, setToastAction] = useState('none yet');
  const toast = useToast();

  return (
    <>
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

        <Text variant="caption" color="text/secondary" accessibilityLiveRegion="polite">
          {`Last action: ${lastAction}`}
        </Text>
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
