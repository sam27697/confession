import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const globalsCss = fs.readFileSync('app/globals.css', 'utf-8');

test('AC1: .home-step__badge renders solid citron background with high-contrast text-on-accent', () => {
  const badgeBlockMatch = globalsCss.match(/\.home-step__badge\s*\{[^}]+\}/);
  assert.ok(badgeBlockMatch, '.home-step__badge rule must exist');
  assert.match(badgeBlockMatch[0], /background:\s*var\(--citron-500\)/, 'must use solid var(--citron-500) background');
  assert.match(badgeBlockMatch[0], /color:\s*var\(--text-on-accent\)/, 'must use high-contrast var(--text-on-accent)');
  assert.doesNotMatch(badgeBlockMatch[0], /var\(--citron-wash\)/, 'must not use low-contrast wash background');
});

test('AC2: .home-step__badge renders subtle luminous accent ring stroke', () => {
  const badgeBlockMatch = globalsCss.match(/\.home-step__badge\s*\{[^}]+\}/);
  assert.ok(badgeBlockMatch, '.home-step__badge rule must exist');
  assert.match(badgeBlockMatch[0], /box-shadow:[^;]*var\(--citron-300\)/, 'must display luminous ring using var(--citron-300)');
});

test('AC3: .home-step renders hover elevation with line-strong and surface-2 transition', () => {
  const hoverBlockMatch = globalsCss.match(/\.home-step:hover\s*\{[^}]+\}/);
  assert.ok(hoverBlockMatch, '.home-step:hover rule must exist');
  assert.match(hoverBlockMatch[0], /border-color:\s*var\(--line-strong\)/, 'must highlight border on hover');
  assert.match(hoverBlockMatch[0], /background:\s*var\(--surface-2\)/, 'must elevate background on hover');
});

test('AC4: discovery walk structure and 3-step cards preserved (KEEP)', () => {
  assert.match(globalsCss, /\.home-steps/, '.home-steps must exist');
  assert.match(globalsCss, /\.home-step__text strong/, '.home-step__text strong must exist');
  assert.match(globalsCss, /border-radius:\s*var\(--radius-card\)/, 'must preserve card radius');
});
