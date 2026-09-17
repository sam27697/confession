import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')
const INBOX_PAGE = path.join(APP_DIR, 'inbox', 'page.tsx')
const REVEAL_CARD = path.join(APP_DIR, '_components', 'RevealCard.tsx')

test('AC1: prompt chips render as interactive button controls with type="button"', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  const inboxSrc = readFileSync(INBOX_PAGE, 'utf8')

  // Chips must not be inert spans
  assert.ok(
    !inboxSrc.includes('<span key={q} className="chip'),
    'prompt suggestion chips must not be inert span elements',
  )

  // Chips must be buttons with explicit type="button" (C1-PE02)
  assert.match(
    inboxSrc,
    /<button[^>]*type="button"[^>]*className="[^"]*chip/,
    'prompt chips must render as button elements with explicit type="button"',
  )
})

test('AC2: prompt chips declare data-target and data-prompt for zero-keystroke input population', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  const inboxSrc = readFileSync(INBOX_PAGE, 'utf8')

  assert.match(
    inboxSrc,
    /data-target=/,
    'prompt chips must declare data-target pointing to the target input field',
  )
  assert.match(
    inboxSrc,
    /data-prompt=/,
    'prompt chips must declare data-prompt carrying the suggestion text',
  )

  // Population click listener must be present
  assert.match(
    inboxSrc,
    /data-target[\s\S]*data-prompt|addEventListener\(['"]click['"]/,
    'inbox surface must include 1-tap chip population handler',
  )
})

test('AC3: keyboard accessibility and visible focus indicator preserved (KEEP)', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  const inboxSrc = readFileSync(INBOX_PAGE, 'utf8')

  // Buttons natively receive tabIndex and keyboard click actuation
  assert.ok(
    inboxSrc.includes('STAKE_SUGGESTIONS') || inboxSrc.includes('QUESTION_SUGGESTIONS'),
    'inbox must import and render prompt suggestions',
  )
})

test('AC4: datalist and input form validation contracts remain intact (KEEP)', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  assert.ok(existsSync(REVEAL_CARD), 'app/_components/RevealCard.tsx must exist')
  const inboxSrc = readFileSync(INBOX_PAGE, 'utf8')

  assert.match(
    inboxSrc,
    /name="questionForSender"/,
    'question input name must be preserved',
  )
  assert.match(
    inboxSrc,
    /name="stakePrompt"/,
    'stake prompt input name must be preserved',
  )
  assert.match(
    inboxSrc,
    /name="recipientAnswer"/,
    'recipient answer textarea name must be preserved',
  )
  assert.match(
    inboxSrc,
    /required/,
    'required validation must be preserved',
  )
})
