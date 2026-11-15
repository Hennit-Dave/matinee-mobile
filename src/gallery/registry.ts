/**
 * What the hidden component gallery covers. Pure data, no React Native, so it is unit-tested
 * (`registry.test.ts` fails when a component is exported from the library without a gallery entry).
 *
 * Section order and grouping follow the Figma Gallery page (`73:3973`) and `docs/COMPONENTS.md`.
 */
export type GallerySectionId =
  | 'typography'
  | 'icons'
  | 'buttons'
  | 'cards'
  | 'selection'
  | 'input'
  | 'feedback'
  | 'navigation'
  | 'motion';

export interface GallerySectionSpec {
  id: GallerySectionId;
  title: string;
  /** Library components this section shows, by export name. */
  components: readonly string[];
  /** The matching heading in docs/COMPONENTS.md. */
  docs: string;
}

export const GALLERY_SECTIONS: readonly GallerySectionSpec[] = [
  { id: 'typography', title: 'Typography', components: ['Text'], docs: '1. Typography' },
  { id: 'icons', title: 'Icons', components: ['Icon'], docs: '9. Icons' },
  { id: 'buttons', title: 'Buttons', components: ['Button'], docs: '2. Buttons' },
  {
    id: 'cards',
    title: 'Cards and posters',
    components: ['MovieCard', 'SearchResultRow', 'HeroBackdrop'],
    docs: '3. Cards and posters',
  },
  { id: 'selection', title: 'Selection and labels', components: ['Chip'], docs: '4. Selection and labels' },
  { id: 'input', title: 'Input', components: ['Input'], docs: '5. Input' },
  { id: 'feedback', title: 'Feedback', components: ['Skeleton', 'EmptyState'], docs: '6. Feedback' },
  {
    id: 'navigation',
    title: 'Navigation and sheets',
    components: ['NavBar', 'BottomSheet'],
    docs: '7. Navigation and sheets',
  },
  { id: 'motion', title: 'Motion', components: ['CrossfadeStack'], docs: 'CrossfadeStack (section 6)' },
];

export interface PlannedComponent {
  name: string;
  /** Where its spec lives in docs/COMPONENTS.md. */
  docs: string;
}

/**
 * Specified in COMPONENTS.md and drawn in the Figma Gallery, but not built yet. Listed on the
 * gallery screen so it never claims more than the app has. Remove an entry when it is built and
 * add it to a section above (the test checks both lists stay honest).
 */
export const PLANNED_COMPONENTS: readonly PlannedComponent[] = [
  { name: 'Card', docs: '3. Cards and posters' },
  { name: 'QRCode', docs: '3. Cards and posters' },
  { name: 'Badge', docs: '4. Selection and labels' },
  { name: 'Switch', docs: '4. Selection and labels' },
  { name: 'ListRow', docs: '4. Selection and labels' },
  { name: 'Toast', docs: '6. Feedback' },
  { name: 'Countdown', docs: '6. Feedback' },
  { name: 'Seat', docs: '8. Seats' },
  { name: 'SeatMap', docs: '8. Seats' },
];

export function coveredComponents(): string[] {
  return GALLERY_SECTIONS.flatMap((section) => [...section.components]);
}

/**
 * Component names exported by a barrel file such as src/components/index.ts: capitalised value
 * exports only (not types, hooks or ALL_CAPS constants).
 */
export function parseComponentExports(barrelSource: string): string[] {
  const names: string[] = [];
  const exportBlocks = barrelSource.matchAll(/export\s*\{([^}]*)\}\s*from/g);
  for (const block of exportBlocks) {
    for (const rawPart of (block[1] ?? '').split(',')) {
      const part = rawPart.trim();
      if (!part || part.startsWith('type ')) continue;
      const name = part.split(/\s+as\s+/).pop()?.trim() ?? '';
      if (/^[A-Z][a-z]/.test(name)) names.push(name);
    }
  }
  return names;
}
