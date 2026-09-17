import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

test('AC1: each sent message card in app/sent/page.tsx renders a copy button with data-copy-text', () => {
  const sentPath = path.join(APP_DIR, 'sent', 'page.tsx')
  assert.ok(existsSync(sentPath), 'app/sent/page.tsx must exist')
  const src = readFileSync(sentPath, 'utf8')

  assert.ok(
    src.includes('data-copy-text'),
    'sent page must render buttons with data-copy-text binding'
  )
  assert.ok(
    src.includes('msg__copy-btn') || src.includes('copy-btn'),
    'copy button must carry dedicated class for styling'
  )
  assert.ok(
    src.includes('aria-label') && (src.includes('نسخ') || src.includes('copy')),
    'copy button must carry an accessible aria-label'
  )
})

test('AC2: sent page script provides clipboard writing with affirmative confirmation and fallback', () => {
  const sentPath = path.join(APP_DIR, 'sent', 'page.tsx')
  const src = readFileSync(sentPath, 'utf8')

  assert.ok(
    src.includes('navigator.clipboard') || src.includes('execCommand'),
    'sent page script must provide clipboard copy functionality'
  )
  assert.ok(
    src.includes('تم النسخ') || src.includes('--copied'),
    'sent page must trigger visual confirmation state'
  )
})

test('AC3: globals.css styles outbox copy button with tokenized states', () => {
  const cssPath = path.join(APP_DIR, 'globals.css')
  const css = readFileSync(cssPath, 'utf8')

  assert.ok(
    css.includes('.msg__copy-btn') || css.includes('.copy-btn'),
    'globals.css must define styles for copy button'
  )
})

test('AC4: sent message body, recipient name, hourstamp, and filter tabs strictly preserved (KEEP)', () => {
  const sentPath = path.join(APP_DIR, 'sent', 'page.tsx')
  const src = readFileSync(sentPath, 'utf8')

  assert.ok(src.includes('getSentForSender'), 'getSentForSender must be preserved')
  assert.ok(src.includes('formatHourStamp'), 'formatHourStamp must be preserved')
  assert.ok(src.includes('OfferBlock'), 'OfferBlock must be preserved')
  assert.ok(src.includes('sent-filters'), 'filter tabs must be preserved')
})
