import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INBOX_PAGE = path.join(REPO_ROOT, 'app', 'inbox', 'page.tsx')
const SENT_PAGE = path.join(REPO_ROOT, 'app', 'sent', 'page.tsx')

test('AC1: empty inbox displays warm Levantine welcoming heading, decorative seal, and contextual prompt spark', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  const src = readFileSync(INBOX_PAGE, 'utf8')

  assert.match(
    src,
    /confessions\.length\s*===\s*0[\s\S]*?(?:empty-card|empty-box|inbox-empty)/,
    'Empty inbox must render a dedicated styled empty state container',
  )
  assert.match(
    src,
    /(?:نوّرت|الصندوق|أول مصارحة)/,
    'Empty inbox must include warm Levantine welcoming copy',
  )
  assert.match(
    src,
    /(?:empty-spark|سؤال مقترح|اطلب من رفقاتك)/,
    'Empty inbox must include actionable prompt spark guidance',
  )
})

test('AC2: empty outbox displays warm reassuring copy with clear link to /inbox', () => {
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')
  const src = readFileSync(SENT_PAGE, 'utf8')

  assert.match(
    src,
    /totalSent\s*===\s*0[\s\S]*?href=['"]\/inbox['"]/,
    'Empty outbox must provide a link to /inbox to manage and share own secret box',
  )
})

test('AC3: filtered outbox displays dedicated filter-empty state when filtered items are zero', () => {
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')
  const src = readFileSync(SENT_PAGE, 'utf8')

  assert.match(
    src,
    /filter-empty/,
    'Filtered outbox must render a dedicated filter-empty container when messages matching active filter count is zero',
  )
})

test('AC4: filter tabs, link blocks, and existing message actions strictly preserved (KEEP)', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')
  const inboxSrc = readFileSync(INBOX_PAGE, 'utf8')
  const sentSrc = readFileSync(SENT_PAGE, 'utf8')

  assert.ok(inboxSrc.includes('<CopyLink'), 'CopyLink component must be preserved in inbox')
  assert.ok(inboxSrc.includes('<StoryCard'), 'StoryCard component must be preserved in inbox')
  assert.ok(sentSrc.includes('sent-filters'), 'Filter tabs container must be preserved in outbox')
  assert.ok(sentSrc.includes('sent-filter'), 'Sent filter pills must be preserved in outbox')
})
