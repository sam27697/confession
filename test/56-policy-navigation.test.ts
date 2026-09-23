import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TERMS_PAGE = path.join(REPO_ROOT, 'app', 'terms', 'page.tsx')
const PRIVACY_PAGE = path.join(REPO_ROOT, 'app', 'privacy', 'page.tsx')
const GLOBALS_CSS = path.join(REPO_ROOT, 'app', 'globals.css')
const HUMAN_CHECKLIST = path.join(REPO_ROOT, 'docs', 'human_checklist.md')

test('AC1 (NEW): /terms renders an in-app return navigation action (.policy-return)', () => {
  assert.ok(existsSync(TERMS_PAGE), 'app/terms/page.tsx must exist')
  const src = readFileSync(TERMS_PAGE, 'utf8')
  assert.match(
    src,
    /policy-return/,
    'Terms page must render policy-return element',
  )
  assert.match(
    src,
    /<a[^>]*href=["'](?:\/|\/inbox)["'][^>]*>(?:[^<]*عودة|[^<]*رجوع[^<]*)<\/a>/,
    'Terms page must render a return navigation link to home or inbox',
  )

  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')
  assert.match(
    css,
    /\.policy-return/,
    'globals.css must define styling rules for .policy-return',
  )
})

test('AC2 (NEW): /privacy renders an in-app return navigation action (.policy-return)', () => {
  assert.ok(existsSync(PRIVACY_PAGE), 'app/privacy/page.tsx must exist')
  const src = readFileSync(PRIVACY_PAGE, 'utf8')
  assert.match(
    src,
    /policy-return/,
    'Privacy page must render policy-return element',
  )
  assert.match(
    src,
    /<a[^>]*href=["'](?:\/|\/inbox)["'][^>]*>(?:[^<]*عودة|[^<]*رجوع[^<]*)<\/a>/,
    'Privacy page must render a return navigation link to home or inbox',
  )
})

test('AC3 (NEW): Policy return button provides tactile feedback and >=44px touch target geometry', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')
  assert.match(
    css,
    /\.policy-return\s*{[^}]*min-height:\s*(?:var\(--tap-min\)|44px)/,
    'globals.css must specify min-height >= 44px (or var(--tap-min)) on .policy-return',
  )
})

test('AC4 (KEEP): Dual-language terms and privacy content, RTL/LTR layout, and legal disclosures preserved', () => {
  const termsSrc = readFileSync(TERMS_PAGE, 'utf8')
  assert.match(termsSrc, /TERMS_TEXT_AR/, 'Terms page must render Arabic terms')
  assert.match(termsSrc, /TERMS_TEXT_EN/, 'Terms page must render English terms')
  assert.match(termsSrc, /dir="rtl"/, 'Terms page must preserve RTL container')
  assert.match(termsSrc, /dir="ltr"/, 'Terms page must preserve LTR container')

  const privacySrc = readFileSync(PRIVACY_PAGE, 'utf8')
  assert.match(privacySrc, /سياسة الخصوصية/, 'Privacy page must render Arabic heading')
  assert.match(privacySrc, /What we store, exactly:/, 'Privacy page must render English content')
  assert.match(privacySrc, /dir="rtl"/, 'Privacy page must preserve RTL container')
  assert.match(privacySrc, /dir="ltr"/, 'Privacy page must preserve LTR container')
})

test('AC5 (KEEP): human_checklist.md defines HC-30 for policy return navigation evaluation', () => {
  assert.ok(existsSync(HUMAN_CHECKLIST), 'human_checklist.md must exist')
  const content = readFileSync(HUMAN_CHECKLIST, 'utf8')
  assert.match(content, /## HC-30/, 'human_checklist.md must define HC-30')
})
