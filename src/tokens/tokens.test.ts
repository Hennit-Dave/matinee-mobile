import { test } from 'node:test';
import assert from 'node:assert/strict';
import { semantic, type ThemeMode } from './tokens';

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`Expected a 6-digit hex colour, got "${hex}"`);
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function channelLuminance(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }: RGB): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexToRgb(hexA));
  const b = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const MIN_CONTRAST = 4.5;

/**
 * General-purpose body text only. text/disabled is exempt here (WCAG 1.4.3
 * excludes inactive-component text from the contrast minimum), and the
 * on-primary/on-secondary/on-urgent tokens pair with their own
 * primary/secondary/urgent backgrounds, not with surfaces, so neither belongs
 * in this matrix.
 */
const TEXT_TOKENS = ['text/primary', 'text/secondary'] as const;

// The contrast test should only pair text with opaque surfaces.
// Exclude surface/scrim and any token ending in -clear, since
// they are overlays and gradient ends.
const OPAQUE_SURFACE_TOKENS = ['surface/default', 'surface/raised', 'surface/overlay'] as const;

const MODES: ThemeMode[] = ['light', 'dark'];

for (const mode of MODES) {
  for (const textToken of TEXT_TOKENS) {
    for (const surfaceToken of OPAQUE_SURFACE_TOKENS) {
      test(`${mode} ${textToken} on ${surfaceToken} meets WCAG AA contrast`, () => {
        const ratio = contrastRatio(semantic[mode][textToken], semantic[mode][surfaceToken]);
        assert.ok(
          ratio >= MIN_CONTRAST,
          `${textToken} on ${surfaceToken} (${mode}) is ${ratio.toFixed(2)}:1, below ${MIN_CONTRAST}:1`
        );
      });
    }
  }
}
