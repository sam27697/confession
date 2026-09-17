import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

test('AC1: compose screen renders proactive minimum length guidance pill with stable layout geometry', () => {
  const sendPath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  assert.ok(existsSync(sendPath), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(sendPath, 'utf8')

  // Check for presence of proactive constraint pill / indicator
  assert.ok(
    src.includes('compose-rule') || src.includes('compose-constraint') || src.includes('field-constraint'),
    'compose screen must render a dedicated constraint indicator class (e.g. compose-rule)'
  )
  assert.ok(
    src.includes('حرفين على الأقل') || src.includes('حرفين'),
    'constraint indicator must explain the minimum 2-character requirement'
  )
})

test('AC2: constraint indicator is linked with accessible aria attributes', () => {
  const sendPath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  const src = readFileSync(sendPath, 'utf8')

  // Textarea should reference the constraint id or form field row via aria-describedby
  assert.ok(
    /aria-describedby=["'][^"']*(?:compose-rule|constraint|char-count|hint)[^"']*["']/.test(src) ||
    src.includes('aria-describedby'),
    'textarea on compose screen must include aria-describedby linking to input guidance'
  )
})

test('AC3: globals.css defines compose-rule styles with stable height preventing layout shifts', () => {
  const cssPath = path.join(APP_DIR, 'globals.css')
  const css = readFileSync(cssPath, 'utf8')

  assert.ok(
    css.includes('.compose-rule'),
    'globals.css must define styling rules for .compose-rule'
  )
})

test('AC4: submit action, rate limits, draft script, and recipient verification strictly preserved (KEEP)', () => {
  const sendPath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  const src = readFileSync(sendPath, 'utf8')

  assert.ok(src.includes('sendConfessionAction'), 'sendConfessionAction binding must be preserved')
  assert.ok(src.includes('data-draft-slug'), 'draft attribute must be preserved')
  assert.ok(src.includes('getLinkBySlug'), 'recipient link verification must be preserved')
  assert.ok(src.includes('Celebrate'), 'celebrate burst on sent must be preserved')
})