import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')
const GLOBALS_CSS = path.join(APP_DIR, 'globals.css')

test('AC1: interactive buttons support active press-scale transform using --press-scale token', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.match(
    css,
    /\.btn:active\s*\{[^}]*transform:\s*scale\(var\(--press-scale\)\)/,
    '.btn:active must utilize transform:scale(var(--press-scale)) token',
  )
  assert.match(
    css,
    /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)[^}]*--press-scale:\s*1/,
    'prefers-reduced-motion block must clamp --press-scale to 1 to prevent vestibular motion displacement',
  )
})

test('AC2: focused interactive controls display high-contrast focus ring token --ring-focus', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.match(
    css,
    /\.btn:focus-visible\s*\{[^}]*box-shadow:\s*var\(--ring-focus\)/,
    '.btn:focus-visible must explicitly declare box-shadow:var(--ring-focus)',
  )
  assert.match(
    css,
    /:focus-visible\s*\{[^}]*box-shadow:\s*var\(--ring-focus\)/,
    ':focus-visible base rule must declare box-shadow:var(--ring-focus)',
  )
})

test('AC3: prompt chips in RevealCard provide clear hover and focus interaction states', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.match(
    css,
    /\.chip:hover\s*\{[^}]*filter:\s*brightness/,
    '.chip:hover must provide visual brightness elevation state on cursor hover',
  )
  assert.match(
    css,
    /\.chip\s*\{[^}]*transition:/,
    '.chip must declare smooth transition property for interaction states',
  )
})

test('AC4: client component boundaries and frozen server shells are strictly preserved (KEEP)', () => {
  const serverShells = [
    path.join(APP_DIR, 'inbox', 'page.tsx'),
    path.join(APP_DIR, 'sent', 'page.tsx'),
    path.join(APP_DIR, 'c', '[slug]', 'page.tsx'),
    path.join(APP_DIR, 'offer', '[offerId]', 'page.tsx'),
    path.join(APP_DIR, 'page.tsx'),
  ]

  for (const shellPath of serverShells) {
    if (existsSync(shellPath)) {
      const src = readFileSync(shellPath, 'utf8')
      assert.ok(
        !src.includes("'use client'") && !src.includes('"use client"'),
        `Server shell ${shellPath} must not contain use client directive`,
      )
    }
  }

  const AUTHORISED = new Set([
    'app/_components/Celebrate.tsx',
    'app/_components/CopyLink.tsx',
    'app/_components/StoryCard.tsx',
    'app/_components/SubmitButton.tsx',
    'app/_components/ToastProvider.tsx',
  ])

  const files = [
    'app/_components/Celebrate.tsx',
    'app/_components/CopyLink.tsx',
    'app/_components/StoryCard.tsx',
    'app/_components/SubmitButton.tsx',
    'app/_components/ToastProvider.tsx',
    'app/_components/RevealCard.tsx',
    'app/_components/CharacterMeter.tsx',
  ]

  for (const f of files) {
    const abs = path.join(REPO_ROOT, f)
    if (existsSync(abs)) {
      const src = readFileSync(abs, 'utf8')
      if (src.includes("'use client'") || src.includes('"use client"')) {
        assert.ok(
          AUTHORISED.has(f),
          `Component ${f} must be in AUTHORISED client list`,
        )
      }
    }
  }
})
