import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { Icon } from './Icon';
import { Text } from './Text';

export interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  disabled?: boolean;
  leadingIcon?: 'search';
  onClear?: () => void;
  autoFocus?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  accessibilityLabel?: string;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  disabled = false,
  leadingIcon,
  onClear,
  autoFocus = false,
  returnKeyType = 'search',
  onSubmitEditing,
  accessibilityLabel,
}: InputProps) {
  const { colors, text } = useTheme();
  const [focused, setFocused] = useState(false);

  const hasError = Boolean(error);
  const borderColor = disabled
    ? colors['border/default']
    : hasError
      ? colors['status/error']
      : focused
        ? colors['text/primary']
        : colors['border/strong'];

  const borderWidth =
    !disabled && (hasError || focused)
      ? primitives['border-width/strong']
      : primitives['border-width/default'];

  const backgroundColor = disabled ? colors['surface/default'] : colors['surface/raised'];
  const valueColor = disabled ? colors['text/disabled'] : colors['text/primary'];

  return (
    <View style={styles.container}>
      {label ? (
        <Text variant="label" color={disabled ? 'text/disabled' : 'text/primary'}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.field,
          {
            backgroundColor,
            borderColor,
            borderWidth,
          },
        ]}
      >
        {leadingIcon ? (
          <Icon
            name={leadingIcon}
            size="md"
            color={disabled ? 'text/disabled' : 'text/secondary'}
          />
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={disabled ? colors['text/disabled'] : colors['text/secondary']}
          editable={!disabled}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder ?? 'Text input'}
          accessibilityState={{ disabled }}
          style={[
            text['type/body-lg'],
            styles.input,
            { color: valueColor },
          ]}
        />

        {onClear && value.length > 0 && !disabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={onClear}
            hitSlop={primitives['space/3']}
            style={styles.clearButton}
          >
            <Icon name="close" size="md" color="text/secondary" />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Icon name="error" size="sm" color="status/error" />
          <Text variant="caption" color="status/error" style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: primitives['space/1'],
  },
  field: {
    minHeight: primitives['size/input-height'],
    borderRadius: primitives['radius/md'],
    paddingHorizontal: primitives['space/3'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/2'],
  },
  input: {
    flex: 1,
    paddingVertical: primitives['space/2'],
  },
  clearButton: {
    minWidth: primitives['size/icon-lg'],
    minHeight: primitives['size/icon-lg'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/1'],
  },
  errorText: {
    flex: 1,
  },
});
