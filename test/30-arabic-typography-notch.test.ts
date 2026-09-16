import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')
const GLOBALS_CSS = path.join(APP_DIR, 'globals.css')

test('AC1: confession cards feature asymmetric speech notch radius --radius-bubble', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.match(
    css,
    /\.msg\s*\{[^}]*border-radius:\s*var\(--radius-bubble\)/,
    '.msg cards must use --radius-bubble for signature speech notch styling',
  )
  assert.match(
    css,
    /\.textarea--hero\s*\{[^}]*border-radius:\s*var\(--radius-bubble\)/,
    '.textarea--hero input well must mirror signature speech notch radius',
  )
})

test('AC2: Arabic message body text maintains relaxed 1.75 line-height token --lh-body', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.match(
    css,
    /\.msg__body\s*\{[^}]*var\(--lh-body\)/,
    '.msg__body must use var(--lh-body) line-height token for comfortable Arabic readability',
  )
  assert.match(
    css,
    /\.textarea--hero\s*\{[^}]*var\(--lh-body\)/,
    '.textarea--hero must use var(--lh-body) line-height token',
  )
})

test('AC3: send page hero card applies harmonious vertical rhythm and comfortable spacing', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.match(
    css,
    /\.send-pitch\s*\{[^}]*var\(--lh-body\)/,
    '.send-pitch must use var(--lh-body) for comfortable reading cadence',
  )

  const sendPagePath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  assert.ok(existsSync(sendPagePath), 'app/c/[slug]/page.tsx must exist')
  const sendPageSrc = readFileSync(sendPagePath, 'utf8')
  assert.ok(
    sendPageSrc.includes('send-card') && sendPageSrc.includes('send-hero'),
    'send page must maintain structured hero and card layout hierarchy',
  )
})

test('AC4: zero em-dashes and preserved field name "body" on compose page (KEEP)', () => {
  const filesToCheck = [
    path.join(APP_DIR, 'inbox', 'page.tsx'),
    path.join(APP_DIR, 'c', '[slug]', 'page.tsx'),
  ]

  for (const filePath of filesToCheck) {
    if (existsSync(filePath)) {
      const lines = readFileSync(filePath, 'utf8').split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        // Ignore lines inside comments
        if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
          continue
        }
        const EM_DASH = String.fromCharCode(0x2014)
        assert.ok(
          !line.includes(EM_DASH),
          `prohibited dash found in ${filePath}:${i + 1}`,
        )
      }
    }
  }

  const sendPageSrc = readFileSync(path.join(APP_DIR, 'c', '[slug]', 'page.tsx'), 'utf8')
  assert.ok(
    sendPageSrc.includes('name="body"'),
    'Compose textarea name="body" must be preserved unchanged',
  )
})
