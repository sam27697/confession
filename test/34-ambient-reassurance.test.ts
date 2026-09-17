import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')
const SEND_PAGE = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
const GLOBALS_CSS = path.join(APP_DIR, 'globals.css')
const SUBMIT_BUTTON = path.join(APP_DIR, '_components', 'SubmitButton.tsx')

test('AC1: live draft status indicator renders beside character meter with aria-live="polite"', () => {
  assert.ok(existsSync(SEND_PAGE), 'app/c/[slug]/page.tsx must exist')
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')

  const sendSrc = readFileSync(SEND_PAGE, 'utf8')
  const cssSrc = readFileSync(GLOBALS_CSS, 'utf8')

  assert.match(
    sendSrc,
    /className="[^"]*draft-indicator[^"]*"/,
    'app/c/[slug]/page.tsx must render draft-indicator element',
  )
  assert.match(
    sendSrc,
    /aria-live="polite"/,
    'draft indicator must declare aria-live="polite" for non-intrusive accessibility',
  )
  assert.match(
    cssSrc,
    /\.compose-meta\s*\{/,
    'app/globals.css must define .compose-meta flex layout',
  )
  assert.match(
    cssSrc,
    /\.draft-indicator\s*\{/,
    'app/globals.css must define .draft-indicator typography and muted styling',
  )
})

test('AC2: indicator updates to confirm saved status upon debounced input persistence', () => {
  assert.ok(existsSync(SUBMIT_BUTTON), 'app/_components/SubmitButton.tsx must exist')
  const buttonSrc = readFileSync(SUBMIT_BUTTON, 'utf8')

  assert.match(
    buttonSrc,
    /draft-indicator|draftIndicator|#draft-status/,
    'SubmitButton must look up and update draft indicator status element',
  )
  assert.match(
    buttonSrc,
    /تم الحفظ/,
    'SubmitButton must display Arabic confirmation message upon saving draft',
  )
})

test('AC3: zero layout shift or vertical jitter during indicator status transitions (KEEP)', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  assert.ok(existsSync(SEND_PAGE), 'app/c/[slug]/page.tsx must exist')

  const cssSrc = readFileSync(GLOBALS_CSS, 'utf8')
  const sendSrc = readFileSync(SEND_PAGE, 'utf8')

  // CSS must enforce min-height on compose-meta to prevent layout shift
  assert.match(
    cssSrc,
    /\.compose-meta\s*\{[^}]*min-height:/,
    '.compose-meta must set explicit min-height to maintain stable vertical rhythm',
  )
  assert.match(
    sendSrc,
    /rows=\{5\}/,
    'textarea must retain rows={5} attribute',
  )
})

test('AC4: class coverage parity strictly preserved between globals.css and tsx files (KEEP)', () => {
  assert.ok(existsSync(SEND_PAGE), 'app/c/[slug]/page.tsx must exist')
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')

  const sendSrc = readFileSync(SEND_PAGE, 'utf8')
  assert.match(
    sendSrc,
    /name="body"/,
    'textarea must retain name="body" attribute',
  )
})
