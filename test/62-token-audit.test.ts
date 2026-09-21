// test/62-token-audit.test.ts
//
// B3-T04: comprehensive design token audit and codification.
//
// The class layer of app/globals.css grew a family of raw literals that the
// token blocks never named: white overlay washes (`rgba(255,255,255,X)`) for
// frost surfaces and hairlines, a backdrop-blur scale, and a 44px compact tap
// target that sits beside the design system's own 48px `--tap-min`. The three
// classes cycle A3 added -- .sovereignty-card, .view-breadcrumb, .policy-return
// -- carry the newest of them.
//
// These checks do NOT touch the five token blocks mirrored from
// design/masaraha-design-system/tokens/*.css (lines up to `tokens/base.css`).
// That directory is the design of record and stays byte-identical, so the
// literal search below is scoped to the class layer only.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GLOBALS_CSS = readFileSync(path.join(REPO_ROOT, 'app', 'globals.css'), 'utf8')

// The design-of-record token mirror ends where the base reset begins.
const BASE_MARK = '/* tokens/base.css'
const splitAt = GLOBALS_CSS.indexOf(BASE_MARK)
const TOKEN_LAYER = GLOBALS_CSS.slice(0, splitAt)
const CLASS_LAYER = GLOBALS_CSS.slice(splitAt)

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = GLOBALS_CSS.match(new RegExp(escaped + '\\s*\\{[^}]*\\}'))
  assert.ok(match, `${selector} rule must exist in app/globals.css`)
  return match[0]
}

test('AC1: .sovereignty-card__badge padding is codified, not a raw 2px 8px literal', () => {
  const block = rule('.sovereignty-card__badge')
  assert.match(block, /padding:\s*var\(--[a-z0-9-]+\)\s+var\(--[a-z0-9-]+\)/,
    '.sovereignty-card__badge padding must be expressed in tokens')
  assert.doesNotMatch(block, /padding:\s*2px\s+8px/,
    '.sovereignty-card__badge must not carry the raw 2px 8px literal')
})

test('AC1: .sovereignty-card__section--purged border-color is a codified danger hairline', () => {
  const block = rule('.sovereignty-card__section--purged')
  assert.match(block, /border-color:\s*var\(--[a-z0-9-]+\)/,
    '.sovereignty-card__section--purged border-color must reference a token')
  assert.doesNotMatch(block, /rgba\(\s*255\s*,\s*92\s*,\s*77/,
    '.sovereignty-card__section--purged must not carry a raw danger rgba literal')
})

test('AC1: .view-breadcrumb__link min-height is a codified tap target', () => {
  const block = rule('.view-breadcrumb__link')
  assert.match(block, /min-height:\s*var\(--[a-z0-9-]+\)/,
    '.view-breadcrumb__link min-height must reference a tap-target token')
  assert.doesNotMatch(block, /min-height:\s*44px/,
    '.view-breadcrumb__link must not carry the raw 44px literal')
})

test('AC1: .policy-return keeps its codified tap target (the shape the others match)', () => {
  const block = rule('.policy-return')
  assert.match(block, /min-height:\s*var\(--tap-min\)/,
    '.policy-return must keep min-height:var(--tap-min)')
})

test('AC1: the frost overlay scale and blur scale are declared as tokens', () => {
  for (const token of ['--frost-05', '--frost-06', '--frost-08', '--frost-10', '--frost-12', '--frost-20', '--frost-40']) {
    assert.match(TOKEN_LAYER, new RegExp(token + '\\s*:'), `${token} must be declared in a :root block`)
  }
  for (const token of ['--blur-sm', '--blur-md', '--blur-lg', '--blur-glass']) {
    assert.match(TOKEN_LAYER, new RegExp(token + '\\s*:'), `${token} must be declared in a :root block`)
  }
  assert.match(TOKEN_LAYER, /--tap-compact\s*:\s*44px/, '--tap-compact must be declared as 44px')
})

test('AC1: no raw white-overlay literal survives in the class layer', () => {
  const leftovers = [...CLASS_LAYER.matchAll(/rgba\(\s*255\s*,\s*255\s*,\s*255[^)]*\)/g)].map((m) => m[0])
  assert.deepEqual(leftovers, [],
    `these raw white-overlay literals must be replaced by frost tokens: ${JSON.stringify(leftovers)}`)
})

test('AC1: no raw backdrop-filter blur literal survives in the class layer', () => {
  const declarations = [...CLASS_LAYER.matchAll(/backdrop-filter:\s*([^;]+);/g)].map((m) => m[1].trim())
  const raw = declarations.filter((v) => v !== 'none' && !v.includes('var(--'))
  assert.deepEqual(raw, [],
    `these backdrop-filter values must reference a blur token: ${JSON.stringify(raw)}`)
})

test('AC2: token adoption in app/globals.css is at least 50%', () => {
  const values = [...GLOBALS_CSS.matchAll(/:\s*([^;{}]+);/g)].map((m) => m[1])
  const tokenised = values.filter((v) => v.includes('var(--'))
  const adoption = (tokenised.length / values.length) * 100
  assert.ok(
    adoption >= 50.0,
    `token adoption must be at least 50.0% (measured ${adoption.toFixed(1)}% over ${values.length} declarations)`,
  )
})

test('AC3 (KEEP): every class defined in the class layer is still used under app/', () => {
  // A cheap mirror of test/21 item 5 in the direction this task can break:
  // codifying a literal must never leave a rule behind that nothing renders.
  const defined = new Set(
    [...CLASS_LAYER.matchAll(/^\.([a-zA-Z][a-zA-Z0-9_-]*)/gm)].map((m) => m[1]),
  )
  assert.ok(defined.size > 0, 'expected to parse class selectors from the class layer')

  const appDir = path.join(REPO_ROOT, 'app')
  const tsx: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.tsx')) tsx.push(readFileSync(full, 'utf8'))
    }
  }
  walk(appDir)
  const source = tsx.join('\n')

  const unused = [...defined].filter((c) => !source.includes(c)).sort()
  assert.deepEqual(unused, [], `these classes are defined but rendered nowhere: ${JSON.stringify(unused)}`)
})

test('AC4 (KEEP): the design system invariants hold -- no import, no url(), no webfont', () => {
  assert.doesNotMatch(GLOBALS_CSS, /@import/, 'app/globals.css must carry no CSS import rule')
  assert.doesNotMatch(GLOBALS_CSS, /url\(/, 'app/globals.css must reference no external asset')
  assert.doesNotMatch(GLOBALS_CSS, /@font-face/, 'app/globals.css must declare no webfont')
})

test('AC4 (KEEP): the design-of-record token mirror is untouched by this task', () => {
  // The five blocks above tokens/base.css are byte-identical to
  // design/masaraha-design-system/tokens/*.css. Spot-check the anchors that a
  // careless sweep would rewrite.
  assert.match(TOKEN_LAYER, /--tap-min:48px/, '--tap-min must stay 48px')
  assert.match(TOKEN_LAYER, /--hairline-top:inset 0 1px 0 rgba\(255,255,255,\.05\)/,
    '--hairline-top must keep the design-of-record literal')
  assert.match(TOKEN_LAYER, /--danger-wash:rgba\(255,92,77,\.12\)/,
    '--danger-wash must keep the design-of-record literal')
})
