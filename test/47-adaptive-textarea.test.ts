import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

test('AC1: globals.css defines field-sizing content with min-height (120px) and max-height (480px) clamp', () => {
  const cssPath = path.join(APP_DIR, 'globals.css')
  assert.ok(existsSync(cssPath), 'app/globals.css must exist')
  const css = readFileSync(cssPath, 'utf8')

  assert.ok(
    css.includes('field-sizing: content') || css.includes('field-sizing:content'),
    'globals.css must specify field-sizing: content for adaptive auto-expansion'
  )
  assert.ok(
    /min-height:\s*(?:120px|var\(--control-h-xl, 120px\))/.test(css) || css.includes('min-height: 120px') || css.includes('min-height:120px'),
    'globals.css must specify fallback min-height: 120px clamp'
  )
  assert.ok(
    /max-height:\s*(?:480px|30rem)/.test(css) || css.includes('max-height: 480px') || css.includes('max-height:480px'),
    'globals.css must specify max-height: 480px clamp'
  )
})

test('AC2: compose textarea in app/c/[slug]/page.tsx utilizes hero/elastic adaptive classes', () => {
  const composePath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  assert.ok(existsSync(composePath), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(composePath, 'utf8')

  assert.ok(
    src.includes('textarea--hero') || src.includes('textarea--elastic'),
    'compose textarea must carry hero or elastic adaptive class'
  )
  assert.ok(
    src.includes('data-draft-slug'),
    'textarea must retain draft slug persistence binding'
  )
})

test('AC3: compose textarea preserves name, validation constraints, and accessibility bindings (KEEP)', () => {
  const composePath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  const src = readFileSync(composePath, 'utf8')

  assert.ok(src.includes('name="body"'), 'textarea must preserve name="body"')
  assert.ok(src.includes('required'), 'textarea must be required')
  assert.ok(src.includes('minLength={1}'), 'textarea must enforce minLength={1}')
  assert.ok(src.includes('maxLength={4000}'), 'textarea must enforce maxLength={4000}')
  assert.ok(src.includes('aria-describedby'), 'textarea must preserve aria-describedby')
  assert.ok(src.includes('sendConfessionAction'), 'form action must remain preserved')
})
