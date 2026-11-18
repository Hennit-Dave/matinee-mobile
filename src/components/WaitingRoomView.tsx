import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { Text } from './Text';
import {
  LEAVE_LABEL,
  NEXT_IN_LINE,
  QUEUE_HEADING,
  WAITING_NOTE,
  aheadCaption,
  aheadNumeral,
  aheadSpoken,
  freshnessLabel,
} from './waitingRoomLogic';

export interface WaitingRoomViewProps {
  /** The join has not answered yet: the Figma skeleton (56:6691) instead of the line. */
  loading?: boolean;
  /** People in front of you; 0 means you are next. Position only: there is no time estimate (D4). */
  ahead?: number;
  /** The last refresh failed, so `ahead` may be out of date: the freshness line says so instead of "just now". */
  stale?: boolean;
  /** The film, when the screen that linked here knew it (a deep link does not). */
  title?: string;
  /** The showing's day, time and format, like "Sat 14 Nov · 20:00 · IMAX". */
  showing?: string;
  onLeave: () => void;
}

// The skeleton's bars, from Figma 56:6691, written as sums of tokens (there is no token for 140 or 180, and a raw number
// is not allowed). Each is the size of the thing it stands in for.
const SK_FILM_WIDTH = primitives['size/poster-width'] + primitives['space/12'] + primitives['space/1']; // 180
const SK_HEADING_WIDTH = primitives['size/poster-width'] + primitives['space/3']; // 140
const SK_NUMBER_WIDTH = primitives['size/poster-width'] - primitives['space/2']; // 120
const SK_CAPTION_WIDTH = primitives['size/poster-width'] + primitives['space/16'] + primitives['space/2']; // 200
const SK_CAPTION_HEIGHT = primitives['space/4'] - primitives['space/1'] / 2; // 14

/**
 * Figma `Booking / Waiting room` (56:6729): the film, "You're in the queue", the number of people ahead drawn large,
 * how fresh it is, a note, and a quiet "Leave the queue" at the foot. Light and dark, the skeleton, and the 1.3x
 * text frame are all this one component: type scales with the system setting, and the middle scrolls if it ever
 * outgrows the screen so the button stays reachable.
 *
 * One deliberate change from Figma: the note says "Keep Matinee open", not "You can lock your phone; we'll tell you".
 * The app sends no push notification, and a promise it cannot keep is worse than none (ADR 0017; push is a later
 * enhancement). The "You're next" line for 0 people ahead has no frame; it is built from the same type tokens.
 *
 * Presentational: it draws what it is given. The line itself lives in `waitingRoomMachine.ts`.
 */
export function WaitingRoomView({ loading = false, ahead = 0, stale = false, title, showing, onLeave }: WaitingRoomViewProps) {
  const { colors } = useTheme();
  const next = ahead <= 0;

  if (loading) {
    return (
      <View
        accessible
        accessibilityLabel="Joining the queue"
        style={[styles.root, { backgroundColor: colors['surface/default'] }]}
      >
        <View style={styles.content}>
          <Skeleton shape="text" width={SK_FILM_WIDTH} height={primitives['space/5']} />
          <View style={styles.queue}>
            <Skeleton shape="text" width={SK_HEADING_WIDTH} />
            <Skeleton shape="block" width={SK_NUMBER_WIDTH} height={primitives['space/12']} />
            <Skeleton shape="text" width={SK_CAPTION_WIDTH} height={SK_CAPTION_HEIGHT} />
          </View>
        </View>
        <View style={styles.footer}>
          <Skeleton shape="block" height={primitives['size/button-height']} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors['surface/default'] }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        // The line is the one thing on screen: nothing to dismiss the keyboard for, nothing to pull to refresh.
        bounces={false}
      >
        <View style={styles.content}>
          {title || showing ? (
            <View accessible accessibilityRole="header" accessibilityLabel={[title, showing].filter(Boolean).join(', ')}>
              {title ? (
                <Text variant="title" color="text/primary">
                  {title}
                </Text>
              ) : null}
              {showing ? (
                <Text variant="body" color="text/secondary">
                  {showing}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.queue}>
            <Text variant="body-lg" color="text/secondary">
              {QUEUE_HEADING}
            </Text>

            {/* One spoken sentence for the place, announced politely when it changes. */}
            <View
              accessible
              accessibilityLabel={aheadSpoken(ahead)}
              accessibilityLiveRegion="polite"
              style={styles.place}
            >
              {next ? (
                <Text variant="title-lg" color="text/primary">
                  {NEXT_IN_LINE}
                </Text>
              ) : (
                <>
                  <Text variant="numeral" color="text/primary" tabularNums style={styles.centered}>
                    {aheadNumeral(ahead)}
                  </Text>
                  <Text variant="body" color="text/secondary">
                    {aheadCaption(ahead)}
                  </Text>
                </>
              )}
            </View>

            <Text variant="caption" color="text/secondary">
              {freshnessLabel(stale)}
            </Text>
            <Text variant="body" color="text/secondary" style={styles.centered}>
              {WAITING_NOTE}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button variant="text" fullWidth label={LEAVE_LABEL} onPress={onLeave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: primitives['space/4'],
  },
  scroll: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    gap: primitives['space/6'],
    paddingTop: primitives['space/4'],
  },
  queue: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: primitives['space/3'],
  },
  place: {
    alignItems: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  footer: {
    paddingVertical: primitives['space/4'],
    gap: primitives['space/2'],
  },
});
