import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INBOX_PAGE = path.join(REPO_ROOT, 'app', 'inbox', 'page.tsx')
const SENT_PAGE = path.join(REPO_ROOT, 'app', 'sent', 'page.tsx')
const GLOBALS_CSS = path.join(REPO_ROOT, 'app', 'globals.css')
const HUMAN_CHECKLIST = path.join(REPO_ROOT, '.uxprogram', 'human_checklist.md')

test('AC1 (NEW): Sub-navigation tab bar renders numeric count badges (.app-nav__badge) indicating message volume', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')

  const inboxSrc = readFileSync(INBOX_PAGE, 'utf8')
  const sentSrc = readFileSync(SENT_PAGE, 'utf8')

  assert.match(
    inboxSrc,
    /className=["'][^"']*app-nav__badge[^"']*["']/,
    'Inbox page sub-navigation must render .app-nav__badge count indicator',
  )
  assert.match(
    sentSrc,
    /className=["'][^"']*app-nav__badge[^"']*["']/,
    'Sent page sub-navigation must render .app-nav__badge count indicator',
  )
})

test('AC2 (NEW): Badge displays high-contrast typography and muted background styling matching active/inactive tab states', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.match(
    css,
    /\.app-nav__badge\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/,
    'globals.css must specify pill radius for .app-nav__badge',
  )
  assert.match(
    css,
    /\.app-nav__tab--active\s+\.app-nav__badge/,
    'globals.css must define distinct active state styling for .app-nav__badge inside .app-nav__tab--active',
  )
})

test('AC3 (KEEP): Tab navigation links, active tab indicators, and mobile touch target geometry strictly preserved', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')

  const inboxSrc = readFileSync(INBOX_PAGE, 'utf8')
  const sentSrc = readFileSync(SENT_PAGE, 'utf8')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.ok(
    inboxSrc.includes('app-nav') && inboxSrc.includes('href="/inbox"') && inboxSrc.includes('href="/sent"'),
    'inbox nav must preserve links to /inbox and /sent',
  )
  assert.ok(
    sentSrc.includes('app-nav') && sentSrc.includes('href="/inbox"') && sentSrc.includes('href="/sent"'),
    'sent nav must preserve links to /inbox and /sent',
  )
  assert.ok(
    /min-height:\s*44px/.test(css),
    'touch target 44px preserved in CSS',
  )
})

test('AC4 (KEEP): Inbox confession list, daily spark banner, and sent filter pills strictly preserved', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')

  const inboxSrc = readFileSync(INBOX_PAGE, 'utf8')
  const sentSrc = readFileSync(SENT_PAGE, 'utf8')

  assert.ok(inboxSrc.includes('daily-spark'), 'inbox must preserve daily spark banner')
  assert.ok(inboxSrc.includes('inbox-header'), 'inbox must preserve inbox header')
  assert.ok(sentSrc.includes('sent-filters'), 'sent must preserve sent filter pills')
  assert.ok(sentSrc.includes('sent-header'), 'sent must preserve sent header')
})

test('AC5 (HUMAN): Human checklist contains HC-31 item for tab volume badges', () => {
  assert.ok(existsSync(HUMAN_CHECKLIST), '.uxprogram/human_checklist.md must exist')
  const content = readFileSync(HUMAN_CHECKLIST, 'utf8')
  assert.match(
    content,
    /## HC-31\b/,
    'human_checklist.md must contain ## HC-31 entry',
  )
})
