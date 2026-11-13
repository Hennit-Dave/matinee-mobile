import { StyleSheet, View } from 'react-native';
import { primitives } from '../tokens/tokens';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

export interface EmptyStateProps {
  headline: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  icon?: 'info' | 'error';
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  headline,
  body,
  actionLabel,
  onAction,
  icon,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Icon
            name={icon}
            size="lg"
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
        <Button variant="primary" label={actionLabel} onPress={onAction} />
        {secondaryActionLabel && onSecondaryAction ? (
          <Button variant="text" label={secondaryActionLabel} onPress={onSecondaryAction} />
        ) : null}
      </View>
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
});
