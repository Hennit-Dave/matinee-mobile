import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';
import { TOAST_TONES, toSpokenToast, type ToastAction, type ToastTone } from './toastLogic';

export type { ToastAction, ToastTone } from './toastLogic';

export interface ToastProps {
  tone?: ToastTone;
  message: string;
  action?: ToastAction;
}

/**
 * A short message that floats above the content, never covering the main button (the caller
 * places it; see ToastProvider). The icon shape tells the tone as well as the colour, and the
 * message is read out with the tone spoken first. The action is optional.
 */
export function Toast({ tone = 'info', message, action }: ToastProps) {
  const { colors, elevation } = useTheme();
  const spec = TOAST_TONES[tone];
  const shadow = elevation['elevation/2'];

  return (
    <View
      style={[
        styles.toast,
        {
          backgroundColor: colors['surface/overlay'],
          borderColor: colors['border/default'],
          boxShadow: [
            {
              offsetX: shadow.offsetX,
              offsetY: shadow.offsetY,
              blurRadius: shadow.blur,
              spreadDistance: shadow.spread,
              color: shadow.color,
            },
          ],
        },
      ]}
    >
      {/* Icon and message are one spoken unit; the action stays a separate, focusable button. */}
      <View accessible accessibilityLabel={toSpokenToast(tone, message)} style={styles.copy}>
        <Icon name={spec.icon} size="md" color={spec.color} />
        <Text variant="body" color="text/primary" style={styles.message}>
          {message}
        </Text>
      </View>
      {action ? <Button variant="text" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    minHeight: primitives['space/12'] + primitives['space/2'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/3'],
    paddingHorizontal: primitives['space/4'],
    paddingVertical: primitives['space/2'],
    borderRadius: primitives['radius/md'],
    borderWidth: primitives['border-width/default'],
  },
  copy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/3'],
  },
  message: {
    flex: 1,
  },
});
