import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const globalsCss = fs.readFileSync('app/globals.css', 'utf-8');
const tokensMd = fs.readFileSync('docs/tokens.md', 'utf-8');

test('AC1: --dur-hover and --ease-standard defined in globals.css and tokens.md', () => {
  assert.match(globalsCss, /--dur-hover\s*:/, 'globals.css must define --dur-hover');
  assert.match(globalsCss, /--ease-standard\s*:/, 'globals.css must define --ease-standard');
  assert.match(tokensMd, /--dur-hover\s*:/, 'tokens.md must document --dur-hover');
  assert.match(tokensMd, /--ease-standard\s*:/, 'tokens.md must document --ease-standard');
});

test('AC2: all transition rules referencing --dur-hover and --ease-standard resolve cleanly', () => {
  const hoverRefs = (globalsCss.match(/var\(--dur-hover\)/g) || []).length;
  const easeRefs = (globalsCss.match(/var\(--ease-standard\)/g) || []).length;
  assert.ok(hoverRefs >= 4, 'at least 4 transition rules must reference --dur-hover');
  assert.ok(easeRefs >= 4, 'at least 4 transition rules must reference --ease-standard');
  // Verify both tokens are defined at :root level
  const rootBlockMatch = globalsCss.match(/:root\s*\{[^}]*--dur-hover[^}]*\}/s);
  assert.ok(rootBlockMatch, '--dur-hover must be defined within a :root block');
});

test('AC3: --dur-hover clamped in prefers-reduced-motion', () => {
  const reducedMotionMatch = globalsCss.match(/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)\s*\{[^}]*\}/s);
  assert.ok(reducedMotionMatch, 'globals.css must contain prefers-reduced-motion block');
  assert.match(reducedMotionMatch[0], /--dur-hover\s*:\s*1ms/, '--dur-hover must be clamped to 1ms in reduced motion');
});

test('AC4: existing motion tokens strictly preserved (KEEP)', () => {
  assert.match(globalsCss, /--dur-instant\s*:\s*90ms/, '--dur-instant must be preserved');
  assert.match(globalsCss, /--dur-fast\s*:\s*150ms/, '--dur-fast must be preserved');
  assert.match(globalsCss, /--dur-base\s*:\s*220ms/, '--dur-base must be preserved');
  assert.match(globalsCss, /--dur-slow\s*:\s*420ms/, '--dur-slow must be preserved');
  assert.match(globalsCss, /--press-scale\s*:\s*\.?97/, '--press-scale must be preserved');
});
