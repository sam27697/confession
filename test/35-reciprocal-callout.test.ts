import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEND_PAGE = path.join(REPO_ROOT, 'app', 'c', '[slug]', 'page.tsx')

test('AC1: post-send confirmation renders reciprocal box inception card with warm Levantine encouragement', () => {
  assert.ok(existsSync(SEND_PAGE), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(SEND_PAGE, 'utf8')

  assert.match(
    src,
    /sent\s*===\s*['"]1['"][\s\S]*?(?:reciprocal|reciprocal-card|send-reciprocal)/,
    'Post-send confirmation must render a dedicated reciprocal inception element when sent === "1"',
  )
  assert.match(
    src,
    /صندوقك/,
    'Reciprocal card must include warm Levantine copy referencing the sender\'s own secret box',
  )
})

test('AC2: reciprocal card provides direct action button linking to /inbox and link to /sent', () => {
  assert.ok(existsSync(SEND_PAGE), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(SEND_PAGE, 'utf8')

  assert.match(
    src,
    /sent\s*===\s*['"]1['"][\s\S]*?href=['"]\/inbox['"]/,
    'Reciprocal card must provide a primary link to /inbox with zero redirect hops',
  )
  assert.match(
    src,
    /sent\s*===\s*['"]1['"][\s\S]*?href=['"]\/sent['"]/,
    'Post-send block must preserve access to /sent outbox',
  )
})

test('AC3: redundant detached secondary card is deleted and consolidated into unified reciprocal card', () => {
  assert.ok(existsSync(SEND_PAGE), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(SEND_PAGE, 'utf8')

  assert.ok(
    !src.includes("style={{ marginTop: '1rem' }}"),
    'Redundant detached secondary card with inline style must be eliminated in favor of unified styling',
  )
})

test('AC4: existing delivered notice, Celebrate burst, and draft wiping script strictly preserved (KEEP)', () => {
  assert.ok(existsSync(SEND_PAGE), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(SEND_PAGE, 'utf8')

  assert.ok(
    src.includes('الرسالة وصلت.'),
    'Delivered message notice must be preserved',
  )
  assert.ok(
    src.includes('<Celebrate />') || src.includes('<Celebrate'),
    'Celebrate component must be preserved',
  )
  assert.match(
    src,
    /sessionStorage\.removeItem\(['"]confession_draft_/,
    'Draft wiping script must be preserved',
  )
})
