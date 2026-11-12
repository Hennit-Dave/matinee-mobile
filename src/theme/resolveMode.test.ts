import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMode } from './resolveMode';

test('dark device scheme resolves to dark mode', () => {
  assert.equal(resolveMode('dark'), 'dark');
});

test('light device scheme resolves to light mode', () => {
  assert.equal(resolveMode('light'), 'light');
});

test('unset or unknown device scheme falls back to light', () => {
  assert.equal(resolveMode(null), 'light');
  assert.equal(resolveMode(undefined), 'light');
  assert.equal(resolveMode('unknown'), 'light');
});
