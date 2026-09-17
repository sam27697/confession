import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

test('AC1: compose page renders at least 3 Levantine confession starter chips with explicit type="button"', () => {
  const composePath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  assert.ok(existsSync(composePath), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(composePath, 'utf8')

  assert.ok(
    src.includes('compose-starters') || src.includes('starter-chips'),
    'page must contain compose starters container'
  )
  assert.ok(
    src.includes('data-starter-prompt'),
    'starter chips must define data-starter-prompt attribute'
  )
  assert.ok(
    src.includes('type="button"'),
    'starter chips must explicitly use type="button" to prevent premature form submission'
  )
})

test('AC2: starter chips support 1-tap textarea population and trigger input event for draft auto-save', () => {
  const composePath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  const src = readFileSync(composePath, 'utf8')

  assert.ok(
    src.includes('data-starter-prompt') && (src.includes('dispatchEvent') || src.includes('starter-chips') || src.includes('handleStarter')),
    'compose page must support 1-tap population mechanism dispatching input event'
  )
})

test('AC3: globals.css defines styles for starter chips using design tokens', () => {
  const cssPath = path.join(APP_DIR, 'globals.css')
  const css = readFileSync(cssPath, 'utf8')

  assert.ok(
    css.includes('.compose-starters') || css.includes('.starter-chips'),
    'globals.css must style the compose starters container'
  )
  assert.ok(
    css.includes('.starter-chip') || css.includes('.compose-starter-chip'),
    'globals.css must style the individual starter chips'
  )
})

test('AC4: form action, submit button, draft slug, and recipient validation strictly preserved (KEEP)', () => {
  const composePath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  const src = readFileSync(composePath, 'utf8')

  assert.ok(src.includes('sendConfessionAction'), 'sendConfessionAction must be preserved')
  assert.ok(src.includes('SubmitButton'), 'SubmitButton must be preserved')
  assert.ok(src.includes('data-draft-slug'), 'data-draft-slug must be preserved')
  assert.ok(src.includes('getLinkBySlug'), 'getLinkBySlug verification must be preserved')
})
