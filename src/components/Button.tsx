import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'text';

export interface ButtonProps {
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  fullWidth?: boolean;
  onPress?: () => void;
}

export function Button({
  variant = 'primary',
  disabled = false,
  loading = false,
  label,
  fullWidth = false,
  onPress,
}: ButtonProps) {
  const { colors } = useTheme();
  const isBlocked = disabled || loading;

  const getColors = (pressed: boolean) => {
    if (variant === 'primary') {
      if (disabled) {
        return { bg: colors['primary/disabled'], border: undefined, text: 'text/disabled' as const };
      }
      return {
        bg: pressed ? colors['primary/pressed'] : colors['primary/default'],
        border: undefined,
        text: 'text/on-primary' as const,
      };
    }

    if (variant === 'secondary') {
      if (disabled) {
        return { bg: colors['secondary/default'], border: colors['border/default'], text: 'text/disabled' as const };
      }
      return {
        bg: pressed ? colors['secondary/pressed'] : colors['secondary/default'],
        border: colors['secondary/border'],
        text: 'text/on-secondary' as const,
      };
    }

    // text variant
    if (disabled) {
      return { bg: undefined, border: undefined, text: 'text/disabled' as const };
    }
    return {
      bg: pressed ? colors['secondary/pressed'] : undefined,
      border: undefined,
      text: 'text/primary' as const,
    };
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      disabled={isBlocked}
      onPress={onPress}
      style={({ pressed }) => {
        const palette = getColors(pressed && !isBlocked);
        return [
          styles.base,
          fullWidth ? styles.fullWidth : undefined,
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            borderWidth: palette.border ? primitives['border-width/default'] : 0,
          },
        ];
      }}
    >
      <View style={styles.content}>
        <Text
          variant="label-lg"
          color={getColors(false).text}
          style={loading ? styles.hiddenLabel : undefined}
        >
          {label}
        </Text>
        {loading ? (
          <View style={styles.dotsOverlay} aria-hidden>
            <View style={[styles.dot, { backgroundColor: colors[getColors(false).text] }]} />
            <View style={[styles.dot, { backgroundColor: colors[getColors(false).text] }]} />
            <View style={[styles.dot, { backgroundColor: colors[getColors(false).text] }]} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: primitives['size/button-height'],
    minWidth: primitives['size/touch-min'],
    borderRadius: primitives['radius/md'],
    paddingHorizontal: primitives['space/4'],
    paddingVertical: primitives['space/3'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenLabel: {
    opacity: 0,
  },
  dotsOverlay: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/1'],
  },
  dot: {
    width: primitives['space/1'],
    height: primitives['space/1'],
    borderRadius: primitives['radius/full'],
  },
});
