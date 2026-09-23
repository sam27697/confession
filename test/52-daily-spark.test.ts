import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INBOX_PAGE = path.join(REPO_ROOT, 'app', 'inbox', 'page.tsx')
const GLOBALS_CSS = path.join(REPO_ROOT, 'app', 'globals.css')
const HUMAN_CHECKLIST = path.join(REPO_ROOT, 'docs', 'human_checklist.md')

test('AC1 (NEW): Inbox renders ambient daily rotating Levantine spark banner with deterministic day index', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  const src = readFileSync(INBOX_PAGE, 'utf8')

  assert.match(
    src,
    /daily-spark/,
    'Inbox must render a daily-spark container',
  )

  assert.match(
    src,
    /DAILY_SPARKS\s*=\s*\[/,
    'Inbox must define DAILY_SPARKS collection of Levantine questions of the day',
  )

  // Address PE-02: deterministic day-of-year arithmetic
  assert.match(
    src,
    /(?:86400000|Math\.floor|getDayOfYear|getDate)/,
    'Daily spark index calculation must be deterministic',
  )
})

test('AC2 (NEW): Daily spark provides 1-tap clipboard copy trigger with script feedback', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  const src = readFileSync(INBOX_PAGE, 'utf8')

  assert.match(
    src,
    /daily-spark__copy/,
    'Daily spark must render a copy button or trigger with daily-spark__copy class',
  )

  assert.match(
    src,
    /navigator\.clipboard\.writeText/,
    'Daily spark script must handle copying question of the day to clipboard',
  )

  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')
  assert.match(
    css,
    /\.daily-spark/,
    'globals.css must define styling rules for .daily-spark',
  )
})

test('AC3 (KEEP): Inbox linkblock and list remain intact while redundant empty-spark is deleted', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  const src = readFileSync(INBOX_PAGE, 'utf8')

  assert.match(src, /linkblock/, 'Profile linkblock must remain intact')
  assert.match(src, /inbox-header/, 'Inbox header must remain intact')
  assert.doesNotMatch(
    src,
    /<span className="empty-spark">/,
    'Redundant hardcoded empty-spark must be removed in favor of dynamic daily-spark banner',
  )
})

test('AC4 (KEEP): human_checklist.md defines HC-25 for daily spark verification', () => {
  assert.ok(existsSync(HUMAN_CHECKLIST), 'human_checklist.md must exist')
  const content = readFileSync(HUMAN_CHECKLIST, 'utf8')
  assert.match(content, /## HC-25/, 'human_checklist.md must define HC-25')
})
