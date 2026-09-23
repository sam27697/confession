import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GLOBALS_CSS = path.join(REPO_ROOT, 'app', 'globals.css')
const HUMAN_CHECKLIST = path.join(REPO_ROOT, 'docs', 'human_checklist.md')

test('AC1 (NEW): app/globals.css defines centralized :focus-visible rules using --citron-500', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.match(
    css,
    /:focus-visible\s*\{[^}]*var\(--citron-500\)/,
    'globals.css must define :focus-visible rules referencing var(--citron-500)',
  )
})

test('AC2 (NEW): Focus indicator specifies outline-offset and double-ring halo separation', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.match(
    css,
    /:focus-visible\s*\{[^}]*outline-offset:\s*2px/,
    'globals.css must specify outline-offset: 2px for :focus-visible halo separation',
  )
  assert.match(
    css,
    /:focus-visible\s*\{[^}]*(?:var\(--ground-deep\)|var\(--citron-glow\))/,
    'globals.css must include double-ring separation or citron glow in focus halo',
  )
})

test('AC3 (KEEP): Mouse clicks without keyboard focus do not trigger persistent focus halos', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.ok(
    css.includes(':focus-visible'),
    'must use :focus-visible pseudo-class rather than overriding bare :focus across all elements',
  )
})

test('AC4 (KEEP): Existing button, chip, and tab tap states strictly preserved', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.ok(css.includes('.btn:hover'), 'button hover state preserved')
  assert.ok(css.includes('.btn:active'), 'button active state preserved')
  assert.ok(css.includes('.app-nav__tab--active'), 'active nav tab state preserved')
  assert.ok(css.includes('.starter-chip'), 'starter chip state preserved')
})

test('AC5 (HUMAN): Human checklist contains HC-33 item for keyboard focus halos', () => {
  assert.ok(existsSync(HUMAN_CHECKLIST), 'docs/human_checklist.md must exist')
  const content = readFileSync(HUMAN_CHECKLIST, 'utf8')
  assert.match(
    content,
    /## HC-33\b/,
    'human_checklist.md must contain ## HC-33 entry',
  )
})
