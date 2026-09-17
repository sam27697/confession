import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEND_PAGE = path.join(REPO_ROOT, 'app', 'c', '[slug]', 'page.tsx')
const COPY_LINK = path.join(REPO_ROOT, 'app', '_components', 'CopyLink.tsx')
const GLOBALS_CSS = path.join(REPO_ROOT, 'app', 'globals.css')
const HUMAN_CHECKLIST = path.join(REPO_ROOT, '.uxprogram', 'human_checklist.md')

test('AC1 (NEW): Post-send confirmation renders friend challenge container on sent=1', () => {
  assert.ok(existsSync(SEND_PAGE), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(SEND_PAGE, 'utf8')

  assert.match(
    src,
    /sent\s*===\s*['"]1['"][\s\S]*?friend-challenge/,
    'Post-send view must render friend-challenge container when sent === "1"',
  )

  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')
  assert.match(
    css,
    /\.friend-challenge/,
    'globals.css must define styling rules for .friend-challenge',
  )
})

test('AC2 (NEW): Friend challenge provides 1-tap accelerator referencing friend name and group sharing context', () => {
  assert.ok(existsSync(COPY_LINK), 'app/_components/CopyLink.tsx must exist')
  const copySrc = readFileSync(COPY_LINK, 'utf8')
  assert.match(
    copySrc,
    /label\??:\s*string/,
    'CopyLink must accept customizable label prop',
  )

  const sendSrc = readFileSync(SEND_PAGE, 'utf8')
  // Address PE-03: clear label with owner name and group context
  assert.match(
    sendSrc,
    /<CopyLink[\s\S]*?url=\{`\$\{env\.appOrigin\}\/c\/\$\{slug\}`\}[\s\S]*?label=\{`انسخ رابط \$\{link\.ownerDisplayName\} لتبعتوه بالغروب`\}[\s\S]*?\/>/,
    'Send page must invoke CopyLink with friend URL and explicit group challenge label',
  )
})

test('AC3 (KEEP): Existing reciprocal box inception action and sent messages link remain prominent', () => {
  assert.ok(existsSync(SEND_PAGE), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(SEND_PAGE, 'utf8')

  assert.match(
    src,
    /href=['"]\/inbox['"]/,
    'Reciprocal card must retain link to /inbox',
  )
  assert.match(
    src,
    /href=['"]\/sent['"]/,
    'Reciprocal card must retain link to /sent',
  )
  assert.match(
    src,
    /<Celebrate\s*\/>/,
    'Post-send confirmation must retain Celebrate component',
  )
})

test('AC4 (KEEP): human_checklist.md defines HC-26 for friend challenge verification', () => {
  assert.ok(existsSync(HUMAN_CHECKLIST), 'human_checklist.md must exist')
  const content = readFileSync(HUMAN_CHECKLIST, 'utf8')
  assert.match(content, /## HC-26/, 'human_checklist.md must define HC-26')
})
