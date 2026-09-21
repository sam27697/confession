/**
 * B3-T03 -- Atmospheric empty-state vignette
 * Acceptance checks for /inbox and /sent empty state framing
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const CSS_PATH = path.resolve('app/globals.css');
const css = fs.readFileSync(CSS_PATH, 'utf8');

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

const sentEmptyBlock  = extractBlock(css, '.sent-empty{') || extractBlock(css, '.sent-empty {\n') || extractBlock(css, '.sent-empty\n{');
const inboxEmptyBlock = extractBlock(css, '.empty{') || extractBlock(css, '.empty {\n');

describe('B3-T03 -- atmospheric empty state vignette', () => {

  // AC1: citron-wash vignette on sent-empty and inbox-empty
  it('AC1: .sent-empty applies radial vignette framing with citron-wash token', () => {
    // The sent empty block or its background should reference citron-wash or veil-citron
    const hasVignette =
      sentEmptyBlock.includes('var(--citron-wash)') ||
      sentEmptyBlock.includes('var(--veil-citron)') ||
      sentEmptyBlock.includes('radial-gradient');
    assert.ok(
      hasVignette,
      '.sent-empty must include a citron-wash/veil-citron radial vignette (background-image or background)'
    );
  });

  it('AC1b: .empty (inbox) already has citron-wash vignette framing', () => {
    assert.ok(
      inboxEmptyBlock.includes('var(--veil-citron)') ||
      inboxEmptyBlock.includes('var(--citron-wash)'),
      '.empty (inbox) must include citron vignette'
    );
  });

  // AC2: border uses codified token --line or --line-strong
  it('AC2: .sent-empty border uses codified --line or --line-strong token', () => {
    assert.ok(
      sentEmptyBlock.includes('var(--line)') ||
      sentEmptyBlock.includes('var(--line-strong)'),
      '.sent-empty border must use var(--line) or var(--line-strong) token'
    );
  });

  // AC3: inbox page preserves spark banner, nav tabs, empty-state action links
  it('AC3: inbox page preserves daily spark, nav tabs, volume badges', () => {
    const inbox = fs.readFileSync('app/inbox/page.tsx', 'utf8');
    assert.ok(inbox.includes('daily-spark') || inbox.includes('spark'), 'daily-spark banner must be present');
    assert.ok(inbox.includes('app-nav__tab'), 'nav tabs must be present');
    assert.ok(inbox.includes('app-nav__badge') || inbox.includes('badge'), 'volume badges must be present');
    assert.ok(inbox.includes('inbox-empty'), 'inbox empty-state must be present');
  });

  // AC4: sent page preserves filter pills and empty status copy
  it('AC4: sent page preserves filter pills and sent-empty copy', () => {
    const sent = fs.readFileSync('app/sent/page.tsx', 'utf8');
    assert.ok(sent.includes('filter') || sent.includes('pill'), 'filter pills must be present in sent page');
    assert.ok(sent.includes('sent-empty'), 'sent-empty class must be present');
  });

  // AC5: HC-35 in human checklist
  it('AC5: HC-35 exists in human_checklist.md', () => {
    const checklist = fs.readFileSync('.uxprogram/human_checklist.md', 'utf8');
    assert.ok(checklist.includes('HC-35'), 'HC-35 must be present in .uxprogram/human_checklist.md');
  });
});
