import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  GALLERY_SECTIONS,
  PLANNED_COMPONENTS,
  coveredComponents,
  parseComponentExports,
} from './registry';

const BARREL = path.join(process.cwd(), 'src', 'components', 'index.ts');

test('parseComponentExports keeps capitalised value exports and skips types, hooks and constants', () => {
  const source = `
    export { Button, type ButtonProps, type ButtonVariant } from './Button';
    export { HeroBackdrop, type HeroBackdropProps, svgStopProps } from './HeroBackdrop';
    export { NAV_ITEMS, type NavItemKey } from './navBarLogic';
    export { useNavBarClearance } from './useNavBarClearance';
    export { Thing as Renamed } from './Thing';
  `;
  assert.deepEqual(parseComponentExports(source), ['Button', 'HeroBackdrop', 'Renamed']);
});

test('every component exported from the library is shown in the gallery', () => {
  const exported = parseComponentExports(readFileSync(BARREL, 'utf8'));
  assert.ok(exported.length >= 12, `expected the library barrel to export components, got ${exported.length}`);
  const covered = new Set(coveredComponents());
  const missing = exported.filter((name) => !covered.has(name));
  assert.deepEqual(
    missing,
    [],
    `Add these to a section in src/gallery/registry.ts and render them in the gallery: ${missing.join(', ')}`
  );
});

test('the gallery does not list components the library does not export', () => {
  const exported = new Set(parseComponentExports(readFileSync(BARREL, 'utf8')));
  const unknown = coveredComponents().filter((name) => !exported.has(name));
  assert.deepEqual(unknown, [], `Not exported from src/components/index.ts: ${unknown.join(', ')}`);
});

test('a component is covered once, section ids are unique, and planned components are not built', () => {
  const covered = coveredComponents();
  assert.equal(new Set(covered).size, covered.length, 'a component appears in more than one section');

  const ids = GALLERY_SECTIONS.map((section) => section.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate section id');

  const exported = new Set(parseComponentExports(readFileSync(BARREL, 'utf8')));
  const builtButPlanned = PLANNED_COMPONENTS.filter((planned) => exported.has(planned.name)).map((p) => p.name);
  assert.deepEqual(
    builtButPlanned,
    [],
    `Built now: move out of PLANNED_COMPONENTS and into a section: ${builtButPlanned.join(', ')}`
  );
});
