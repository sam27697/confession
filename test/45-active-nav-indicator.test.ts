import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const globalsCss = fs.readFileSync('app/globals.css', 'utf-8');

test('AC1: .app-nav__tab--active renders inset 2px citron bottom accent indicator', () => {
  const activeBlockMatch = globalsCss.match(/\.app-nav__tab--active\s*\{[^}]+\}/);
  assert.ok(activeBlockMatch, '.app-nav__tab--active rule must exist');
  assert.match(activeBlockMatch[0], /box-shadow:[^;]*inset\s+0\s+-2px\s+0\s+var\(--citron-500\)/, 'must render inset 2px citron bottom accent');
  assert.match(activeBlockMatch[0], /background:\s*var\(--surface-2\)/, 'must use elevated surface-2 container');
});

test('AC2: .app-nav__tab--active renders subtle citron glow shadow and high contrast text', () => {
  const activeBlockMatch = globalsCss.match(/\.app-nav__tab--active\s*\{[^}]+\}/);
  assert.ok(activeBlockMatch, '.app-nav__tab--active rule must exist');
  assert.match(activeBlockMatch[0], /var\(--citron-glow\)/, 'must include var(--citron-glow) in box-shadow');
  assert.match(activeBlockMatch[0], /color:\s*var\(--text-1\)/, 'must use high-contrast text-1 token');
});

test('AC3: .app-nav__tab transitions smoothly via motion tokens', () => {
  const tabBlockMatch = globalsCss.match(/\.app-nav__tab\s*\{[^}]+\}/);
  assert.ok(tabBlockMatch, '.app-nav__tab rule must exist');
  assert.match(tabBlockMatch[0], /transition:[^;]*var\(--dur-hover\)\s+var\(--ease-standard\)/, 'must use motion tokens in transition');
  assert.match(tabBlockMatch[0], /box-shadow/, 'transition must include box-shadow');
});

test('AC4: sub-navigation geometry and touch target strictly preserved (KEEP)', () => {
  assert.match(globalsCss, /min-height:\s*44px/, 'min-height 44px touch target preserved');
  assert.match(globalsCss, /border-radius:\s*var\(--radius-pill\)/, 'pill radius preserved');
});
