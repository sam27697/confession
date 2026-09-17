import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const globalsCss = fs.readFileSync('app/globals.css', 'utf-8');

test('AC1: .home-step__badge references var(--size-caption) without raw 0.875rem', () => {
  const badgeBlockMatch = globalsCss.match(/\.home-step__badge\s*\{[^}]+\}/);
  assert.ok(badgeBlockMatch, '.home-step__badge rule must exist');
  assert.match(badgeBlockMatch[0], /font-size:\s*var\(--size-caption\)/, 'must reference var(--size-caption)');
  assert.doesNotMatch(badgeBlockMatch[0], /0\.875rem/, 'must not use raw 0.875rem literal');
});

test('AC2: .home-step__text line-height references var(--lh-tight) without raw 1.6', () => {
  const textBlockMatch = globalsCss.match(/\.home-step__text\s*\{[^}]+\}/);
  assert.ok(textBlockMatch, '.home-step__text rule must exist');
  assert.match(textBlockMatch[0], /line-height:\s*var\(--lh-tight\)/, 'must reference var(--lh-tight)');
  assert.doesNotMatch(textBlockMatch[0], /line-height:\s*1\.6;/, 'must not use raw 1.6 literal');
});

test('AC3: .compose-rule references tokens for padding and radius', () => {
  const ruleBlockMatch = globalsCss.match(/\.compose-rule\s*\{[^}]+\}/);
  assert.ok(ruleBlockMatch, '.compose-rule rule must exist');
  assert.match(ruleBlockMatch[0], /padding:\s*var\(--space-1\)\s+var\(--space-2\)/, 'must reference spacing tokens for padding');
  assert.match(ruleBlockMatch[0], /border-radius:\s*var\(--radius-pill\)/, 'must reference var(--radius-pill)');
});

test('AC4: existing discovery and compose screen mechanics preserved (KEEP)', () => {
  assert.match(globalsCss, /\.home-steps/, '.home-steps must exist');
  assert.match(globalsCss, /\.home-step__text strong/, '.home-step__text strong must exist');
  assert.match(globalsCss, /\.compose-rule/, '.compose-rule must exist');
  assert.match(globalsCss, /white-space:\s*nowrap/, 'compose-rule must preserve whitespace nowrap');
});
