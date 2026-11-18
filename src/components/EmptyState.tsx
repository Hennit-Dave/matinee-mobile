import { StyleSheet, View } from 'react-native';
import { primitives } from '../tokens/tokens';
import { Button } from './Button';
import { Icon, type IconSize } from './Icon';
import { Text } from './Text';

export interface EmptyStateProps {
  headline: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  /** Shows the action as working (the Button's own loading dots, width kept) and ignores presses. */
  actionLoading?: boolean;
  icon?: 'info' | 'error';
  /** `lg` (24) unless a system state draws it larger: Figma's "server overloaded" uses `xl` (48). */
  iconSize?: Extract<IconSize, 'lg' | 'xl'>;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** A quiet caption under the actions, like "Trying again in 0:14". */
  footnote?: string;
}

export function EmptyState({
  headline,
  body,
  actionLabel,
  onAction,
  actionLoading = false,
  icon,
  iconSize = 'lg',
  secondaryActionLabel,
  onSecondaryAction,
  footnote,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Icon
            name={icon}
            size={iconSize}
            color={icon === 'error' ? 'status/error' : 'status/info'}
          />
        </View>
      ) : null}

      <Text variant="title-lg" color="text/primary" style={styles.centeredText}>
        {headline}
      </Text>

      <Text variant="body-lg" color="text/secondary" style={styles.centeredText}>
        {body}
      </Text>

      <View style={styles.actions}>
        <Button variant="primary" label={actionLabel} loading={actionLoading} onPress={onAction} />
        {secondaryActionLabel && onSecondaryAction ? (
          <Button variant="text" label={secondaryActionLabel} onPress={onSecondaryAction} />
        ) : null}
      </View>

      {footnote ? (
        <Text variant="caption" color="text/secondary" style={[styles.centeredText, styles.footnote]}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: primitives['space/6'],
    paddingVertical: primitives['space/8'],
    gap: primitives['space/3'],
  },
  iconWrap: {
    marginBottom: primitives['space/2'],
  },
  centeredText: {
    textAlign: 'center',
  },
  actions: {
    marginTop: primitives['space/3'],
    alignItems: 'center',
    gap: primitives['space/2'],
  },
  footnote: {
    // Figma 107:15558 puts the caption 48 below the button: this container's 12 gap plus this.
    marginTop: primitives['space/8'] + primitives['space/1'],
  },
});
