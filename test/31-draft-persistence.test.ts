import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')
const SEND_PAGE = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
const SUBMIT_BUTTON = path.join(APP_DIR, '_components', 'SubmitButton.tsx')

test('AC1: confession compose textarea auto-persists to scoped storage key on input', () => {
  assert.ok(existsSync(SEND_PAGE), 'app/c/[slug]/page.tsx must exist')
  assert.ok(existsSync(SUBMIT_BUTTON), 'app/_components/SubmitButton.tsx must exist')

  const sendSrc = readFileSync(SEND_PAGE, 'utf8')
  const buttonSrc = readFileSync(SUBMIT_BUTTON, 'utf8')

  // Textarea or form must provide draft scoping indicator
  assert.match(
    sendSrc,
    /data-draft-slug=\{slug\}|data-draft-key=/,
    'confession form must declare data-draft-slug or data-draft-key for scoped storage isolation',
  )

  // SubmitButton or companion must debounce/persist into scoped sessionStorage
  assert.match(
    buttonSrc,
    /sessionStorage\.setItem\([^)]*confession_draft_/,
    'client component must persist draft to scoped sessionStorage key confession_draft_',
  )

  // PE01: try/catch wrapper for quota exceptions
  assert.match(
    buttonSrc,
    /try\s*\{[^}]*sessionStorage\.setItem[^}]*\}\s*catch/,
    'storage write operations must be wrapped in try/catch exception handlers for private browsing safety',
  )
})

test('AC2: confession compose restores persisted draft from storage on reload', () => {
  assert.ok(existsSync(SUBMIT_BUTTON), 'app/_components/SubmitButton.tsx must exist')
  const buttonSrc = readFileSync(SUBMIT_BUTTON, 'utf8')

  assert.match(
    buttonSrc,
    /sessionStorage\.getItem\([^)]*confession_draft_/,
    'client component must read persisted draft from scoped sessionStorage key confession_draft_',
  )

  assert.match(
    buttonSrc,
    /try\s*\{[^}]*sessionStorage\.getItem[^}]*\}\s*catch/,
    'storage read operations must be wrapped in try/catch exception handlers for private browsing safety',
  )
})

test('AC3: successful send wipes draft key cleanly', () => {
  assert.ok(existsSync(SEND_PAGE), 'app/c/[slug]/page.tsx must exist')
  const sendSrc = readFileSync(SEND_PAGE, 'utf8')

  assert.match(
    sendSrc,
    /sessionStorage\.removeItem\([^)]*confession_draft_/,
    'send confirmation screen (sent === 1) must remove the scoped draft key from sessionStorage',
  )
})

test('AC4: form action, name="body", and validation attributes are strictly preserved (KEEP)', () => {
  assert.ok(existsSync(SEND_PAGE), 'app/c/[slug]/page.tsx must exist')
  const sendSrc = readFileSync(SEND_PAGE, 'utf8')

  assert.match(
    sendSrc,
    /name="body"/,
    'textarea must strictly preserve name="body" attribute',
  )
  assert.match(
    sendSrc,
    /required/,
    'textarea must strictly preserve required attribute',
  )
  assert.match(
    sendSrc,
    /maxLength=\{4000\}/,
    'textarea must strictly preserve maxLength={4000} attribute',
  )
  assert.match(
    sendSrc,
    /<form action=\{action\}>/,
    'form must preserve its action binding',
  )
})
