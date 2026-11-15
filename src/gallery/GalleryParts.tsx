import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';

/** A section of the gallery (one heading in docs/COMPONENTS.md). */
export function GallerySection({
  title,
  docs,
  onLayoutY,
  children,
}: {
  title: string;
  docs: string;
  onLayoutY?: (y: number) => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      onLayout={(event) => onLayoutY?.(event.nativeEvent.layout.y)}
      style={[styles.section, { borderTopColor: colors['border/default'] }]}
    >
      <View style={styles.sectionHeader}>
        <Text variant="title-lg" color="text/primary" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="caption" color="text/secondary">
          {`COMPONENTS.md · ${docs}`}
        </Text>
      </View>
      {children}
    </View>
  );
}

/** One component inside a section, with an optional note on how to see a state that is not a prop. */
export function GalleryGroup({
  name,
  note,
  children,
}: {
  name: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text variant="title" color="text/primary" accessibilityRole="header">
        {name}
      </Text>
      {note ? (
        <Text variant="caption" color="text/secondary">
          {note}
        </Text>
      ) : null}
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

/** One state or variant, captioned. */
export function GalleryItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.item}>
      <Text variant="caption" color="text/secondary">
        {label}
      </Text>
      {children}
    </View>
  );
}

export function GalleryRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

/** A bordered panel for components that are normally shown on a raised surface. */
export function GalleryPanel({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: colors['surface/raised'], borderColor: colors['border/default'] },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: primitives['space/6'],
    paddingTop: primitives['space/6'],
    borderTopWidth: primitives['border-width/default'],
  },
  sectionHeader: {
    gap: primitives['space/1'],
  },
  group: {
    gap: primitives['space/2'],
  },
  groupBody: {
    gap: primitives['space/4'],
    paddingTop: primitives['space/2'],
  },
  item: {
    gap: primitives['space/2'],
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: primitives['space/4'],
  },
  panel: {
    padding: primitives['space/4'],
    gap: primitives['space/3'],
    borderRadius: primitives['radius/lg'],
    borderWidth: primitives['border-width/default'],
  },
});
