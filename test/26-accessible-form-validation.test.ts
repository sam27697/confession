import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

test('AC1: textarea links to error text container via aria-describedby on error', () => {
  const sendPagePath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  assert.ok(existsSync(sendPagePath), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(sendPagePath, 'utf8')

  const hasAriaDescribedBy = /aria-describedby/i.test(src)
  assert.ok(
    hasAriaDescribedBy,
    'Send page textarea must include aria-describedby attribute referencing error container',
  )
})

test('AC2: invalid input sets aria-invalid and receives autoFocus on error', () => {
  const sendPagePath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  assert.ok(existsSync(sendPagePath), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(sendPagePath, 'utf8')

  const hasAriaInvalid = /aria-invalid/i.test(src)
  assert.ok(
    hasAriaInvalid,
    'Send page textarea must set aria-invalid attribute when an error is present',
  )

  const hasFocusHandling = /autoFocus/i.test(src)
  assert.ok(
    hasFocusHandling,
    'Send page textarea must receive autoFocus when an error is present',
  )
})

test('AC3: live character meter displays limit and updates with aria-live', () => {
  const sendPagePath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  assert.ok(existsSync(sendPagePath), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(sendPagePath, 'utf8')

  const hasAriaLive = /aria-live/i.test(src)
  assert.ok(
    hasAriaLive,
    'Send page must provide an aria-live region announcing character constraints',
  )
})

test('AC4: error container has role="alert" for immediate screen reader notification', () => {
  const sendPagePath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  assert.ok(existsSync(sendPagePath), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(sendPagePath, 'utf8')

  const hasRoleAlert = /role=["']alert["']/i.test(src)
  assert.ok(
    hasRoleAlert,
    'Send page error container must include role="alert" for accessible announcements',
  )
})

test('AC5: form submit button disables during in-flight submission', () => {
  const submitButtonPath = path.join(APP_DIR, '_components', 'SubmitButton.tsx')
  assert.ok(existsSync(submitButtonPath), 'app/_components/SubmitButton.tsx must exist')
  const src = readFileSync(submitButtonPath, 'utf8')

  assert.ok(
    src.includes('disabled={pending}'),
    'SubmitButton must maintain disabled state while submission is pending',
  )
  assert.ok(
    src.includes('aria-busy={pending}'),
    'SubmitButton must maintain aria-busy state while submission is pending',
  )
})
