import { useMemo, type ReactNode } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  accessibilityLabel?: string;
  children: ReactNode;
}

const DISMISS_DRAG_THRESHOLD = primitives['size/touch-min'];

/**
 * Modal sheet rising over `surface/scrim`. Dismisses via scrim tap, drag-down on the handle,
 * or the system back action.
 */
export function BottomSheet({
  visible,
  onClose,
  accessibilityLabel = 'Details sheet',
  children,
}: BottomSheetProps) {
  const { colors, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const shadow = elevation['elevation/3'];

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > primitives['space/2'],
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy >= DISMISS_DRAG_THRESHOLD || gesture.vy > 0.8) {
            onClose();
          }
        },
      }),
    [onClose]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          onPress={onClose}
          style={[styles.scrim, { backgroundColor: colors['surface/scrim'] }]}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.panel,
            {
              boxShadow: [
                {
                  offsetX: shadow.offsetX,
                  offsetY: shadow.offsetY,
                  blurRadius: shadow.blur,
                  spreadDistance: shadow.spread,
                  color: shadow.color,
                },
              ],
              backgroundColor: colors['surface/overlay'],
              borderColor: colors['border/default'],
              paddingBottom: Math.max(insets.bottom, primitives['space/6']),
            },
          ]}
        >
          <View {...panResponder.panHandlers} style={styles.handleWrap}>
            <View
              style={[
                styles.handle,
                { backgroundColor: colors['border/strong'] },
              ]}
            />
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  panel: {
    maxHeight: '85%',
    borderTopLeftRadius: primitives['radius/lg'],
    borderTopRightRadius: primitives['radius/lg'],
    borderWidth: primitives['border-width/default'],
    borderBottomWidth: 0,
    paddingTop: primitives['space/3'],
    paddingHorizontal: primitives['space/4'],
    gap: primitives['space/4'],
    alignItems: 'center',
  },
  handleWrap: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: primitives['space/1'],
  },
  handle: {
    width: primitives['space/8'],
    height: primitives['space/1'],
    borderRadius: primitives['radius/full'],
  },
  scroll: {
    width: '100%',
  },
  content: {
    width: '100%',
    gap: primitives['space/4'],
  },
});
