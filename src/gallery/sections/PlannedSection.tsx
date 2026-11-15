import { StyleSheet, View } from 'react-native';
import { Text } from '../../components';
import { useTheme } from '../../theme';
import { primitives } from '../../tokens/tokens';
import { GalleryGroup } from '../GalleryParts';
import { PLANNED_COMPONENTS } from '../registry';

/**
 * Components that are specified and drawn in the Figma Gallery but do not exist in code yet. Listed
 * so the gallery never claims more than the app has. When one is built, move it out of
 * PLANNED_COMPONENTS and into a section: the registry test enforces this.
 */
export function PlannedSection() {
  const { colors } = useTheme();

  return (
    <GalleryGroup
      name={`${PLANNED_COMPONENTS.length} components not built yet`}
      note="They are in the Figma Gallery and docs/COMPONENTS.md but not in the app, so there is nothing to show. Each gets a gallery entry when it is built."
    >
      <View style={styles.list}>
        {PLANNED_COMPONENTS.map((planned) => (
          <View key={planned.name} style={[styles.row, { borderColor: colors['border/default'] }]}>
            <Text variant="label-lg" color="text/primary">
              {planned.name}
            </Text>
            <Text variant="caption" color="text/secondary">
              {`COMPONENTS.md · ${planned.docs}`}
            </Text>
          </View>
        ))}
      </View>
    </GalleryGroup>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: primitives['space/2'],
  },
  row: {
    minHeight: primitives['size/touch-min'],
    justifyContent: 'center',
    paddingHorizontal: primitives['space/4'],
    paddingVertical: primitives['space/2'],
    gap: primitives['space/1'],
    borderRadius: primitives['radius/md'],
    borderWidth: primitives['border-width/default'],
  },
});
