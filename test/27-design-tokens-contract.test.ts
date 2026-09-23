import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TOKENS_MD_PATH = path.join(REPO_ROOT, 'docs', 'tokens.md')
const GLOBALS_CSS_PATH = path.join(REPO_ROOT, 'app', 'globals.css')

test('AC1: tokens.md exists and documents all 7 token categories with exact CSS variables', () => {
  assert.ok(existsSync(TOKENS_MD_PATH), 'docs/tokens.md must exist')
  const content = readFileSync(TOKENS_MD_PATH, 'utf8')

  const categories = [
    'colors',
    'typography',
    'spacing',
    'radius',
    'effects',
    'motion',
    'base',
  ]
  for (const cat of categories) {
    const regex = new RegExp('##\\s+.*' + cat, 'i')
    assert.ok(regex.test(content), `tokens.md must document ${cat} category`)
  }

  // Key tokens check
  const requiredTokens = [
    '--ground',
    '--citron-500',
    '--rose-500',
    '--font-ar',
    '--lh-body',
    '--radius-bubble',
    '--dur-reveal',
    '--shadow-card',
  ]
  for (const tok of requiredTokens) {
    assert.ok(content.includes(tok), `tokens.md must document token ${tok}`)
  }
})

test('AC2: token adoption in app/globals.css is verified against tokens.md specification', () => {
  assert.ok(existsSync(TOKENS_MD_PATH), 'docs/tokens.md must exist')
  const tokensContent = readFileSync(TOKENS_MD_PATH, 'utf8')
  assert.ok(existsSync(GLOBALS_CSS_PATH), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8')

  const varsUsed = (css.match(/var\(--[^)]+\)/g) || []).length
  const propsWithVal = (css.match(/([a-z-]+):\s*([^;]+);/g) || []).length
  const adoption = propsWithVal > 0 ? (varsUsed / propsWithVal) * 100 : 0

  assert.ok(
    adoption >= 60.0,
    `Token adoption rate must be at least 60.0% (measured: ${adoption.toFixed(1)}%)`,
  )
  assert.ok(
    tokensContent.includes('60.1%') || tokensContent.includes('Token adoption'),
    'tokens.md must record the token adoption baseline metric',
  )
})

test('AC3: zero external network font or icon imports in globals.css', () => {
  assert.ok(existsSync(GLOBALS_CSS_PATH), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8')

  assert.ok(!css.includes('@font-face'), 'globals.css must not contain @font-face declarations')
  assert.ok(!css.includes('http://'), 'globals.css must not contain http:// links')
  assert.ok(!css.includes('https://'), 'globals.css must not contain https:// links')
  assert.ok(!css.includes('@import'), 'globals.css must not contain @import rules')
})
