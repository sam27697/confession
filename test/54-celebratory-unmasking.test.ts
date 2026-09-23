import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SENT_PAGE = path.join(REPO_ROOT, 'app', 'sent', 'page.tsx')
const INBOX_PAGE = path.join(REPO_ROOT, 'app', 'inbox', 'page.tsx')
const GLOBALS_CSS = path.join(REPO_ROOT, 'app', 'globals.css')
const HUMAN_CHECKLIST = path.join(REPO_ROOT, 'docs', 'human_checklist.md')

test('AC1 (NEW): Resolved reveal cards render celebratory glow styling honoring bilateral unmasking', () => {
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')
  const sentSrc = readFileSync(SENT_PAGE, 'utf8')
  assert.match(
    sentSrc,
    /sent-resolved--glow/,
    'Sent resolved card must apply sent-resolved--glow celebratory styling',
  )

  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  const inboxSrc = readFileSync(INBOX_PAGE, 'utf8')
  assert.match(
    inboxSrc,
    /reveal--glow/,
    'Inbox resolved reveal must apply reveal--glow celebratory styling',
  )

  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')
  assert.match(
    css,
    /\.sent-resolved--glow/,
    'globals.css must define styling rules for .sent-resolved--glow',
  )
  assert.match(
    css,
    /\.reveal--glow/,
    'globals.css must define styling rules for .reveal--glow',
  )
})

test('AC2 (NEW): Resolved reveal displays affirmative Levantine confirmation celebrating mutual honesty', () => {
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')
  const sentSrc = readFileSync(SENT_PAGE, 'utf8')
  assert.match(
    sentSrc,
    /(?:انكشف السر بينكم، صار فيكم تحكوا براحتكم|صار فيكم تحكوا براحتكم)/,
    'Sent resolved view must render celebratory Levantine confirmation copy',
  )

  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  const inboxSrc = readFileSync(INBOX_PAGE, 'utf8')
  assert.match(
    inboxSrc,
    /(?:انكشف السر بينكم، صار فيكم تحكوا براحتكم|صار فيكم تحكوا براحتكم)/,
    'Inbox resolved view must render celebratory Levantine confirmation copy',
  )
})

test('AC3 (KEEP): Dialogue answers and sender/recipient layouts remain intact', () => {
  const sentSrc = readFileSync(SENT_PAGE, 'utf8')
  assert.match(sentSrc, /offer\.senderAnswer/, 'Sent view must render sender answer')
  assert.match(sentSrc, /offer\.recipientAnswer/, 'Sent view must render recipient answer')

  const inboxSrc = readFileSync(INBOX_PAGE, 'utf8')
  assert.match(inboxSrc, /reveal\.senderAnswer/, 'Inbox view must render sender answer')
  assert.match(inboxSrc, /reveal\.recipientAnswer/, 'Inbox view must render recipient answer')
})

test('AC4 (KEEP): human_checklist.md defines HC-27 for unmasking glow verification', () => {
  assert.ok(existsSync(HUMAN_CHECKLIST), 'human_checklist.md must exist')
  const content = readFileSync(HUMAN_CHECKLIST, 'utf8')
  assert.match(content, /## HC-27/, 'human_checklist.md must define HC-27')
})
