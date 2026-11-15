import assert from 'node:assert/strict';
import { test } from 'node:test';
import { semantic, type ThemeMode } from '../tokens/tokens';
import { MIN_TEXT_CONTRAST, contrastRatio } from '../tokens/contrast';
import { BADGE_TONES, type BadgeTone } from './badgeLogic';

const MODES: ThemeMode[] = ['light', 'dark'];
const TONES = Object.keys(BADGE_TONES) as BadgeTone[];
/** A badge sits on the page, on a Card (raised) or on an overlay surface. */
const SURFACES = ['surface/default', 'surface/raised', 'surface/overlay'] as const;

test('there is one spec per Figma tone, and the label colour matches the outline except for neutral', () => {
  assert.deepEqual(TONES.sort(), ['error', 'info', 'neutral', 'success', 'warning']);
  assert.deepEqual(BADGE_TONES.neutral, { outline: 'border/strong', label: 'text/secondary' });
  for (const tone of TONES.filter((t) => t !== 'neutral')) {
    assert.equal(BADGE_TONES[tone].outline, BADGE_TONES[tone].label, `${tone} outline and label share a colour`);
  }
});

for (const mode of MODES) {
  for (const tone of TONES) {
    for (const surface of SURFACES) {
      test(`${mode} badge label (${tone}) on ${surface} meets WCAG AA text contrast`, () => {
        const label = semantic[mode][BADGE_TONES[tone].label];
        const background = semantic[mode][surface];
        const ratio = contrastRatio(label, background);
        assert.ok(
          ratio >= MIN_TEXT_CONTRAST,
          `${BADGE_TONES[tone].label} on ${surface} (${mode}) is ${ratio.toFixed(2)}:1, below ${MIN_TEXT_CONTRAST}:1`
        );
      });
    }
  }
}
