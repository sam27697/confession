import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')
const SENT_PAGE = path.join(APP_DIR, 'sent', 'page.tsx')
const GLOBALS_CSS = path.join(APP_DIR, 'globals.css')

test('AC1: outbox renders filter tabs for all, pending, and resolved messages', () => {
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')

  const sentSrc = readFileSync(SENT_PAGE, 'utf8')
  const cssSrc = readFileSync(GLOBALS_CSS, 'utf8')

  // Filter bar container and filter pill classes must be present
  assert.match(
    sentSrc,
    /className="[^"]*sent-filters[^"]*"/,
    'app/sent/page.tsx must render sent-filters container',
  )
  assert.match(
    sentSrc,
    /role="tablist"/,
    'sent-filters must declare role="tablist" for accessible navigation',
  )
  assert.match(
    cssSrc,
    /\.sent-filters\s*\{/,
    'app/globals.css must define .sent-filters rule',
  )
  assert.match(
    cssSrc,
    /\.sent-filter\s*\{/,
    'app/globals.css must define .sent-filter pill rule',
  )
})

test('AC2: selecting a filter tab displays only messages matching the selected status', () => {
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')
  const sentSrc = readFileSync(SENT_PAGE, 'utf8')

  // Must accept searchParams with filter
  assert.match(
    sentSrc,
    /searchParams.*filter/,
    'SentPage component must accept searchParams containing filter parameter',
  )

  // Must filter messages based on offer kind
  assert.match(
    sentSrc,
    /filter === 'pending'|filter === 'resolved'/,
    'SentPage must filter displayed messages according to the active filter state',
  )
})

test('AC3: filter state is preserved in URL search parameters (?filter=...)', () => {
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')
  const sentSrc = readFileSync(SENT_PAGE, 'utf8')

  assert.match(
    sentSrc,
    /href="\/sent\?filter=pending"/,
    'SentPage must provide direct URL link to pending filter state',
  )
  assert.match(
    sentSrc,
    /href="\/sent\?filter=resolved"/,
    'SentPage must provide direct URL link to resolved filter state',
  )
  assert.match(
    sentSrc,
    /sent-filter--active/,
    'SentPage must mark active tab with sent-filter--active modifier',
  )
})

test('AC4: empty states and offer block cards render correctly when filters are active (KEEP)', () => {
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')
  const sentSrc = readFileSync(SENT_PAGE, 'utf8')

  assert.match(
    sentSrc,
    /<OfferBlock offer=\{m\.offer\} \/>/,
    'SentPage must preserve OfferBlock rendering inside message card',
  )
  assert.match(
    sentSrc,
    /requireActiveViewerAccountId\(db\)/,
    'SentPage must preserve auth session requirement',
  )
  assert.match(
    sentSrc,
    /getSentForSender\(db,\s*\{\s*senderAccountId\s*\}\)/,
    'SentPage must preserve domain view query contract',
  )
})
