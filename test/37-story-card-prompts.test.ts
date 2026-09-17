import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STORY_CARD = path.join(REPO_ROOT, 'app', '_components', 'StoryCard.tsx')
const GLOBALS_CSS = path.join(REPO_ROOT, 'app', 'globals.css')

test('AC1: story card provides at least 6 diverse prompts bounded within 60 chars to prevent canvas collision', () => {
  assert.ok(existsSync(STORY_CARD), 'app/_components/StoryCard.tsx must exist')
  const src = readFileSync(STORY_CARD, 'utf8')

  const match = src.match(/const\s+PROMPTS\s*=\s*\[([\s\S]*?)\]/)
  assert.ok(match, 'PROMPTS array must be defined in StoryCard.tsx')

  const prompts = match[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith("'") || l.startsWith('"'))
    .map((l) => l.replace(/^['"]|['"],?$/g, ''))

  assert.ok(prompts.length >= 6, `Expected at least 6 story prompts, found ${prompts.length}`)
  for (const p of prompts) {
    assert.ok(p.length <= 60, `Prompt "${p}" exceeds 60 character canvas safety threshold (${p.length} chars)`)
  }
})

test('AC2: story modal displays prompt picker in compact flex-wrap layout preventing vertical overflow', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.match(
    css,
    /\.story-prompts\s*\{[^}]*flex-wrap:\s*wrap/,
    '.story-prompts must declare flex-wrap: wrap for compact responsive layout',
  )
})

test('AC3: story modal provides 1-tap quick-copy companion story caption button with toast confirmation', () => {
  assert.ok(existsSync(STORY_CARD), 'app/_components/StoryCard.tsx must exist')
  const src = readFileSync(STORY_CARD, 'utf8')

  assert.match(
    src,
    /(?:نسخ كابشن الستوري|نسخ النص للستوري|نسخ الكابشن)/,
    'Story modal must render a quick-copy story caption button',
  )
  assert.match(
    src,
    /navigator\.clipboard\.writeText/,
    'Quick-copy caption action must copy text to clipboard',
  )
  assert.match(
    src,
    /toast\(/,
    'Quick-copy action must trigger confirmation toast',
  )
})

test('AC4: canvas token palette, RTL text shaping, download/Web Share fallback, and modal focus trapping strictly preserved (KEEP)', () => {
  assert.ok(existsSync(STORY_CARD), 'app/_components/StoryCard.tsx must exist')
  const src = readFileSync(STORY_CARD, 'utf8')

  assert.ok(src.includes("ctx.direction = 'rtl'"), 'RTL canvas text direction must be preserved')
  assert.ok(src.includes('readPalette()'), 'Token palette reader must be preserved')
  assert.ok(src.includes('navigator.canShare'), 'Web Share check must be preserved')
  assert.ok(src.includes('URL.createObjectURL(blob)'), 'Download fallback must be preserved')
  assert.ok(src.includes("document.addEventListener('keydown', onKey)"), 'Escape key handler must be preserved')
})
