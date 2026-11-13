import { test } from 'node:test';
import assert from 'node:assert/strict';
import { primitives } from '../tokens/tokens';
import {
  ANDROID_GLASS_ENABLED,
  ANDROID_MIN_BLUR_SDK,
  NAV_ITEMS,
  activeNavItem,
  navBarBottomOffset,
  navBarClearance,
  resolveNavMaterial,
} from './navBarLogic';

const base = { reduceTransparency: false, os: 'ios', osVersion: '18.0', hasBlurTarget: false };

test('there are exactly three items: Home, Tickets, Account', () => {
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.label),
    ['Home', 'Tickets', 'Account'],
  );
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.icon),
    ['home', 'ticket', 'user'],
  );
});

test('the active item follows the URL path; Home is "/"', () => {
  assert.equal(activeNavItem('/'), 'home');
  assert.equal(activeNavItem('/tickets'), 'tickets');
  assert.equal(activeNavItem('/account'), 'account');
  assert.equal(activeNavItem('/tickets/'), 'tickets', 'a trailing slash is ignored');
  assert.equal(activeNavItem('/search'), null);
  assert.equal(activeNavItem(''), null);
});

test('every item points at a distinct path', () => {
  assert.equal(new Set(NAV_ITEMS.map((i) => i.href)).size, NAV_ITEMS.length);
});

test('iOS draws glass, and no blur target is needed there', () => {
  assert.equal(resolveNavMaterial(base), 'glass');
});

test('Reduce Transparency forces the solid material on every platform', () => {
  assert.equal(resolveNavMaterial({ ...base, reduceTransparency: true }), 'solid');
  assert.equal(
    resolveNavMaterial({ reduceTransparency: true, os: 'android', osVersion: 36, hasBlurTarget: true }),
    'solid',
  );
});

test('Android draws glass only when enabled, with a blur target, on API 31 or newer', () => {
  const android = { reduceTransparency: false, os: 'android', androidGlassEnabled: true };
  assert.equal(resolveNavMaterial({ ...android, osVersion: 36, hasBlurTarget: true }), 'glass');
  assert.equal(resolveNavMaterial({ ...android, osVersion: ANDROID_MIN_BLUR_SDK, hasBlurTarget: true }), 'glass');
  assert.equal(resolveNavMaterial({ ...android, osVersion: ANDROID_MIN_BLUR_SDK - 1, hasBlurTarget: true }), 'solid');
  assert.equal(resolveNavMaterial({ ...android, osVersion: 36, hasBlurTarget: false }), 'solid');
  assert.equal(resolveNavMaterial({ ...android, osVersion: 'unknown', hasBlurTarget: true }), 'solid');
});

test('with Android glass switched off, Android is always solid, whatever the device', () => {
  const android = { reduceTransparency: false, os: 'android', androidGlassEnabled: false };
  assert.equal(resolveNavMaterial({ ...android, osVersion: 36, hasBlurTarget: true }), 'solid');
});

test('the app ships with Android glass off (measured slower on the emulator; see navBarLogic)', () => {
  assert.equal(ANDROID_GLASS_ENABLED, false);
  assert.equal(
    resolveNavMaterial({ reduceTransparency: false, os: 'android', osVersion: 36, hasBlurTarget: true }),
    'solid',
  );
});

test('iOS is unaffected by the Android switch', () => {
  assert.equal(resolveNavMaterial({ ...base, androidGlassEnabled: false }), 'glass');
});

test('an unknown platform (web) draws solid', () => {
  assert.equal(resolveNavMaterial({ ...base, os: 'web' }), 'solid');
});

test('the pill sits one gap (space/4) above the safe-area inset', () => {
  assert.equal(navBarBottomOffset(0), primitives['space/4']);
  assert.equal(navBarBottomOffset(24), 24 + primitives['space/4']);
});

test('content clearance covers the inset, the gap, the 56 pill, and a gap of breathing room', () => {
  assert.equal(navBarClearance(0), primitives['space/4'] + primitives['size/nav-height'] + primitives['space/4']);
  assert.equal(navBarClearance(34), 34 + primitives['space/4'] + primitives['size/nav-height'] + primitives['space/4']);
  assert.ok(navBarClearance(24) > navBarBottomOffset(24) + primitives['size/nav-height'], 'last content clears the pill');
});
