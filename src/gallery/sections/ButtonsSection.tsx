import { StyleSheet, View } from 'react-native';
import { Button, type ButtonVariant } from '../../components';
import { primitives } from '../../tokens/tokens';
import { GalleryGroup, GalleryItem } from '../GalleryParts';

const VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'text'];

const noop = () => {};

export function ButtonsSection() {
  return (
    <GalleryGroup
      name="Button"
      note="3 variants × default, disabled and loading. Pressed is press feedback, not a prop: press and hold any button to see it. One solid Primary per screen."
    >
      {VARIANTS.map((variant) => (
        <GalleryItem key={variant} label={variant}>
          <View style={styles.row}>
            <Button variant={variant} label="Default" onPress={noop} />
            <Button variant={variant} label="Disabled" disabled onPress={noop} />
            <Button variant={variant} label="Loading" loading onPress={noop} />
          </View>
        </GalleryItem>
      ))}

      <GalleryItem label="fullWidth (how it sits in a screen footer)">
        <Button variant="primary" label="See showtimes" fullWidth onPress={noop} />
      </GalleryItem>
    </GalleryGroup>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: primitives['space/3'],
  },
});
