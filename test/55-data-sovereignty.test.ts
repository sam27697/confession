import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DELETE_PAGE = path.join(REPO_ROOT, 'app', 'account', 'delete', 'page.tsx')
const GLOBALS_CSS = path.join(REPO_ROOT, 'app', 'globals.css')
const HUMAN_CHECKLIST = path.join(REPO_ROOT, 'docs', 'human_checklist.md')

test('AC1 (NEW): Delete account view renders a unified data sovereignty card (.sovereignty-card) replacing fragmented notices', () => {
  assert.ok(existsSync(DELETE_PAGE), 'app/account/delete/page.tsx must exist')
  const src = readFileSync(DELETE_PAGE, 'utf8')
  assert.match(
    src,
    /sovereignty-card/,
    'Delete page must render sovereignty-card container',
  )

  // Verify that repetitive stacked notice--danger blocks are replaced
  const dangerNoticeCount = (src.match(/className=["'][^"']*notice--danger[^"']*["']/g) || []).length
  // Previously there were 4 instances of notice--danger (3 content notices + 1 error paragraph)
  // Now there should be at most 1 for dynamic error display
  assert.ok(
    dangerNoticeCount <= 1,
    `notice--danger should not be stacked redundantly (found ${dangerNoticeCount})`,
  )

  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')
  assert.match(
    css,
    /\.sovereignty-card/,
    'globals.css must define styling rules for .sovereignty-card',
  )
})

test('AC2 (NEW): Sovereignty card provides structured breakdown separating purged credentials from preserved records', () => {
  assert.ok(existsSync(DELETE_PAGE), 'app/account/delete/page.tsx must exist')
  const src = readFileSync(DELETE_PAGE, 'utf8')
  assert.match(
    src,
    /sovereignty-card__section--purged/,
    'Sovereignty card must render purged section (.sovereignty-card__section--purged)',
  )
  assert.match(
    src,
    /sovereignty-card__section--preserved/,
    'Sovereignty card must render preserved section (.sovereignty-card__section--preserved)',
  )
  assert.match(
    src,
    /شو رح ينمحي/,
    'Sovereignty card must clearly headline what is purged',
  )
  assert.match(
    src,
    /شو بيضل/,
    'Sovereignty card must clearly headline what remains',
  )

  const css = readFileSync(GLOBALS_CSS, 'utf8')
  assert.match(
    css,
    /\.sovereignty-card__section--purged/,
    'globals.css must style .sovereignty-card__section--purged',
  )
  assert.match(
    css,
    /\.sovereignty-card__section--preserved/,
    'globals.css must style .sovereignty-card__section--preserved',
  )
})

test('AC3 (NEW): Primary safe exit action is elevated above the destructive delete form', () => {
  assert.ok(existsSync(DELETE_PAGE), 'app/account/delete/page.tsx must exist')
  const src = readFileSync(DELETE_PAGE, 'utf8')
  assert.match(
    src,
    /<a[^>]*href=["']\/inbox["'][^>]*>(?:[^<]*احتفظ بحسابي|[^<]*رجوع[^<]*)<\/a>/,
    'Delete page must render an elevated safe exit link to /inbox',
  )

  // Verify safe exit appears before the destructive form in DOM source order
  const safeExitIndex = src.indexOf('href="/inbox"')
  const formIndex = src.indexOf('<form action={deleteAccountAction}>')
  assert.ok(
    safeExitIndex !== -1 && formIndex !== -1 && safeExitIndex < formIndex,
    'Safe exit link must be elevated above the destructive form',
  )
})

test('AC4 (KEEP): Confirmation checkbox, irreversible delete button, server action, and error notice preserved', () => {
  const src = readFileSync(DELETE_PAGE, 'utf8')
  assert.match(src, /name="confirm"/, 'Confirmation checkbox must be preserved')
  assert.match(src, /type="checkbox"/, 'Checkbox input type must be preserved')
  assert.match(src, /deleteAccountAction/, 'deleteAccountAction server action must be preserved')
  assert.match(src, /SubmitButton/, 'SubmitButton component must be preserved')
  assert.match(src, /ERROR_COPY/, 'Error copy mappings must be preserved')
})

test('AC5 (KEEP): human_checklist.md defines HC-29 for data sovereignty card verification', () => {
  assert.ok(existsSync(HUMAN_CHECKLIST), 'human_checklist.md must exist')
  const content = readFileSync(HUMAN_CHECKLIST, 'utf8')
  assert.match(content, /## HC-29/, 'human_checklist.md must define HC-29')
})
