import { useState } from 'react';
import { Input, type InputProps } from '../../components';
import { GalleryGroup, GalleryItem } from '../GalleryParts';

type DemoProps = Omit<InputProps, 'value' | 'onChangeText'> & { initial?: string };

/** A controlled Input with its own state, so every demo is typeable. */
function InputDemo({ initial = '', onClear, ...rest }: DemoProps) {
  const [value, setValue] = useState(initial);
  return (
    <Input
      {...rest}
      value={value}
      onChangeText={setValue}
      onClear={onClear ? () => setValue('') : undefined}
      returnKeyType="done"
    />
  );
}

export function InputSection() {
  return (
    <GalleryGroup
      name="Input"
      note="48 high. Focused is the field's own focus, not a prop: tap a field to see it. An error always carries a reason in words, never colour alone."
    >
      <GalleryItem label="default (placeholder)">
        <InputDemo label="Email" placeholder="you@example.com" accessibilityLabel="Email, default" />
      </GalleryItem>
      <GalleryItem label="filled">
        <InputDemo label="Email" initial="dave@example.com" accessibilityLabel="Email, filled" />
      </GalleryItem>
      <GalleryItem label="focused (tap to focus)">
        <InputDemo label="Film title" placeholder="Tap me" accessibilityLabel="Film title, tap to focus" />
      </GalleryItem>
      <GalleryItem label="error, with the reason">
        <InputDemo
          label="Email"
          initial="dave@"
          error="Enter a valid email address"
          accessibilityLabel="Email, error"
        />
      </GalleryItem>
      <GalleryItem label="disabled">
        <InputDemo label="Email" initial="Not editable" disabled accessibilityLabel="Email, disabled" />
      </GalleryItem>
      <GalleryItem label="search: leading icon, with a value and clear">
        <InputDemo
          placeholder="Film title"
          leadingIcon="search"
          initial="lantern"
          onClear={() => {}}
          accessibilityLabel="Search films, with a value"
        />
      </GalleryItem>
      <GalleryItem label="search: leading icon, empty">
        <InputDemo placeholder="Film title" leadingIcon="search" accessibilityLabel="Search films, empty" />
      </GalleryItem>
    </GalleryGroup>
  );
}
