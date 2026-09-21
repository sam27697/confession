/**
 * B3-T02 -- Luminous compose well focus elevation
 * Acceptance checks for /c/[slug] textarea focus state
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const CSS_PATH = path.resolve('app/globals.css');
const css = fs.readFileSync(CSS_PATH, 'utf8');

// Extract the .textarea--hero:focus-visible block
function extractBlock(src: string, selector: string): string {
  const idx = src.indexOf(selector);
  if (idx === -1) return '';
  const open = src.indexOf('{', idx);
  if (open === -1) return '';
  let depth = 0;
  let i = open;
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open + 1, i); }
    i++;
  }
  return '';
}

const heroFocusBlock = extractBlock(css, '.textarea--hero:focus-visible');
const heroBaseBlock  = extractBlock(css, '.textarea--hero{') || extractBlock(css, '.textarea--hero {\n') || extractBlock(css, '.textarea--hero\n{');
const baseBlock      = extractBlock(css, '.textarea{') || extractBlock(css, '.textarea {\n');

describe('B3-T02 -- compose well focus elevation', () => {

  // AC1: citron-500 border highlight + citron-glow concentric inner wash
  it('AC1: .textarea--hero:focus-visible applies citron-500 border and citron-glow inner wash', () => {
    assert.ok(
      heroFocusBlock.includes('var(--citron-500)'),
      'Missing var(--citron-500) in .textarea--hero:focus-visible'
    );
    assert.ok(
      heroFocusBlock.includes('var(--citron-glow)'),
      'Missing var(--citron-glow) in .textarea--hero:focus-visible'
    );
    // Must have a box-shadow that contains citron-glow (the concentric inner wash)
    assert.ok(
      /box-shadow\s*:[^}]*var\(--citron-glow\)/.test(heroFocusBlock),
      'box-shadow in .textarea--hero:focus-visible must reference var(--citron-glow)'
    );
    // Must have border-color: var(--citron-500) explicitly
    assert.ok(
      /border-color\s*:\s*var\(--citron-500\)/.test(heroFocusBlock),
      'border-color must be var(--citron-500) in .textarea--hero:focus-visible'
    );
  });

  // AC2: transition uses codified motion tokens
  it('AC2: focus transition uses --dur-hover and --ease-standard tokens', () => {
    // Transition may be on base .textarea--hero or on .textarea--hero:focus-visible
    const combined = heroBaseBlock + heroFocusBlock + baseBlock;
    assert.ok(
      combined.includes('var(--dur-hover)') || combined.includes('--dur-hover'),
      'Transition must reference --dur-hover token in textarea hero scope'
    );
    assert.ok(
      combined.includes('var(--ease-standard)') || combined.includes('--ease-standard'),
      'Transition must reference --ease-standard token in textarea hero scope'
    );
  });

  // AC3: field-sizing:content, min-height, max-height preserved
  it('AC3: field-sizing:content, min-height, max-height preserved in hero textarea', () => {
    assert.ok(
      heroBaseBlock.includes('field-sizing') || baseBlock.includes('field-sizing'),
      'field-sizing must be set on .textarea--hero or .textarea base'
    );
    assert.ok(
      heroBaseBlock.includes('min-height') || baseBlock.includes('min-height'),
      'min-height must be preserved'
    );
    assert.ok(
      heroBaseBlock.includes('max-height') || baseBlock.includes('max-height'),
      'max-height must be preserved'
    );
  });

  // AC4: /c/[slug] page contains submit button and friend-challenge copy
  it('AC4: /c/[slug] page preserves submit button and post-send friend challenge', () => {
    const pagePath = path.resolve('app/c/[slug]/page.tsx');
    const page = fs.readFileSync(pagePath, 'utf8');
    assert.ok(
      page.includes('SubmitButton') || page.includes('submit'),
      'Submit button must be present in /c/[slug]/page.tsx'
    );
    // Friend-challenge: look for the challenge or launchpad copy present post-send
    assert.ok(
      page.includes('sent') || page.includes('challenge') || page.includes('رسائل'),
      'Post-send friend-challenge copy must be present in /c/[slug]/page.tsx'
    );
  });

  // AC5 presence in human checklist (HC-34)
  it('AC5: HC-34 exists in human_checklist.md', () => {
    const checklist = fs.readFileSync('.uxprogram/human_checklist.md', 'utf8');
    assert.ok(
      checklist.includes('HC-34'),
      'HC-34 must be present in .uxprogram/human_checklist.md'
    );
  });
});
