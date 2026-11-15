import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { EmptyState, Skeleton, Text } from '../../components';
import { useTheme } from '../../theme';
import { primitives } from '../../tokens/tokens';
import { GalleryGroup, GalleryItem, GalleryPanel, GalleryRow } from '../GalleryParts';

/** EmptyState fills its parent (flex: 1), so each demo frame needs a definite height. */
const FRAME_HEIGHT = primitives['space/16'] * 5;
const FRAME_HEIGHT_TALL = primitives['space/16'] * 6;

export function FeedbackSection() {
  const { colors } = useTheme();
  const [lastAction, setLastAction] = useState('none yet');

  return (
    <>
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
  frame: {
    borderWidth: primitives['border-width/default'],
    borderRadius: primitives['radius/lg'],
    paddingVertical: primitives['space/6'],
    overflow: 'hidden',
  },
});
