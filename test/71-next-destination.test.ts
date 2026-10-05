// test/71-next-destination.test.ts
//
// docs/SPEC-week21-next-destination.md section 4, items 1 to 11. The old
// guard in app/_lib/login-flow.ts checked for a leading '/' and a ':' and
// stopped there; section 0 of the spec measured a backslash and a bare tab
// walking straight through it in production. src/destination.ts is the
// replacement, framework-free and parsed instead of pattern-matched. Items 1
// to 8 call sanitizeNextDestination directly. Items 9 and 10 read the two
// source files as text, the way test/64 reads source files, because what
// they protect is which module owns the function and what it is allowed to
// import, not anything observable by calling it. Item 11 asks that
// test/23-navigation-continuity.test.ts and test/64-service-softening.test.ts
// keep running unchanged and keep passing; this file changes neither of them
// and adds nothing to make that so.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { sanitizeNextDestination } from '../src/destination.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SENTINEL = 'https://masaraha.provefair.app'

const TAB = '\t'
const LF = '\n'
const CR = '\r'
const NUL = '\u0000'
const DEL = '\u007f'

// Real Arabic text, not transliteration, for item 8: "confession".
const ARABIC = 'اعتراف'

// Every value fed to sanitizeNextDestination anywhere in this file, so item
// 7 can check every value the function hands back, not a hand-picked subset.
const ALL_INPUTS: unknown[] = [
  // item 1
  '/\\evil.example',
  // item 2
  '/\\/evil.example',
  '\\\\evil.example',
  // item 3
  `/${TAB}/evil.example`,
  `/${LF}/evil.example`,
  `/${CR}/evil.example`,
  `/c/a${NUL}b`,
  `/c/a${DEL}b`,
  // item 4
  '/.//evil.example',
  '/%2e//evil.example',
  '/c/..//evil.example',
  // item 5
  'https://evil.example/x',
  '//evil.example',
  'javascript:alert(1)',
  '/c/a:b',
  '',
  null,
  undefined,
  42,
  // item 6
  '/c/abc',
  '/c/abc?x=1#y',
  '/inbox',
  '/sent',
  '/offer/123',
  '/account/delete',
  // item 8
  `/c/abc?q=${ARABIC}`,
]

test('item 1: a backslash host swap returns /inbox', () => {
  assert.equal(sanitizeNextDestination('/\\evil.example'), '/inbox')
})

test('item 2: a leading slash-backslash and a value with no leading slash both return /inbox', () => {
  assert.equal(sanitizeNextDestination('/\\/evil.example'), '/inbox')
  assert.equal(sanitizeNextDestination('\\\\evil.example'), '/inbox')
})

test('item 3: tab, CR, LF, NUL and DEL anywhere in the value return /inbox', () => {
  assert.equal(sanitizeNextDestination(`/${TAB}/evil.example`), '/inbox')
  assert.equal(sanitizeNextDestination(`/${LF}/evil.example`), '/inbox')
  assert.equal(sanitizeNextDestination(`/${CR}/evil.example`), '/inbox')
  assert.equal(sanitizeNextDestination(`/c/a${NUL}b`), '/inbox')
  assert.equal(sanitizeNextDestination(`/c/a${DEL}b`), '/inbox')
})

test('item 4: a dot segment that parses into a protocol-relative path returns /inbox, not //evil.example', () => {
  assert.equal(sanitizeNextDestination('/.//evil.example'), '/inbox')
  assert.equal(sanitizeNextDestination('/%2e//evil.example'), '/inbox')
  assert.equal(sanitizeNextDestination('/c/..//evil.example'), '/inbox')
})

test('item 5: the old refusals still hold', () => {
  assert.equal(sanitizeNextDestination('https://evil.example/x'), '/inbox')
  assert.equal(sanitizeNextDestination('//evil.example'), '/inbox')
  assert.equal(sanitizeNextDestination('javascript:alert(1)'), '/inbox')
  assert.equal(sanitizeNextDestination('/c/a:b'), '/inbox')
  assert.equal(sanitizeNextDestination(''), '/inbox')
  assert.equal(sanitizeNextDestination(null), '/inbox')
  assert.equal(sanitizeNextDestination(undefined), '/inbox')
  assert.equal(sanitizeNextDestination(42), '/inbox')
})

test('item 6: destinations that worked before return unchanged', () => {
  assert.equal(sanitizeNextDestination('/c/abc'), '/c/abc')
  assert.equal(sanitizeNextDestination('/c/abc?x=1#y'), '/c/abc?x=1#y')
  assert.equal(sanitizeNextDestination('/inbox'), '/inbox')
  assert.equal(sanitizeNextDestination('/sent'), '/sent')
  assert.equal(sanitizeNextDestination('/offer/123'), '/offer/123')
  assert.equal(sanitizeNextDestination('/account/delete'), '/account/delete')
})

test('item 7: every returned value is a legal Location header and resolves same-origin against the sentinel', () => {
  for (const input of ALL_INPUTS) {
    const out = sanitizeNextDestination(input as string)
    assert.doesNotThrow(
      () => new Headers({ Location: out }),
      `sanitizeNextDestination(${JSON.stringify(input)}) returned ${JSON.stringify(out)}, which new Headers rejected`,
    )
    const resolved = new URL(out, SENTINEL)
    assert.equal(
      resolved.origin,
      SENTINEL,
      `sanitizeNextDestination(${JSON.stringify(input)}) returned ${JSON.stringify(out)}, which resolves off-origin to ${resolved.origin}`,
    )
  }
})

test('item 8: a non-ASCII query value comes back percent-encoded, same-origin, and not /inbox', () => {
  const input = `/c/abc?q=${ARABIC}`
  const out = sanitizeNextDestination(input)
  assert.notEqual(out, '/inbox')
  assert.ok(out.startsWith('/c/abc'), `expected the path to survive, got ${out}`)
  assert.match(out, /^[\x00-\x7f]*$/, 'the returned value must be ASCII, the Arabic text percent-encoded')
  assert.ok(!out.includes(ARABIC), 'the raw Arabic text must not appear unencoded in the returned value')
  assert.equal(new URL(out, SENTINEL).origin, SENTINEL)
})

test('item 9: src/destination.ts imports nothing from next/* and nothing that reads the environment', () => {
  const src = readFileSync(path.join(REPO_ROOT, 'src', 'destination.ts'), 'utf8')
  assert.doesNotMatch(src, /from\s*['"]next\//, 'destination.ts must not import from next/*')
  assert.doesNotMatch(src, /from\s*['"]next['"]/, 'destination.ts must not import from next')
  assert.doesNotMatch(src, /\bprocess\.env\b/, 'destination.ts must not read process.env directly')
  assert.doesNotMatch(
    src,
    /from\s*['"][^'"]*\/env(\.js)?['"]/,
    'destination.ts must not import the env module',
  )
  assert.doesNotMatch(
    src,
    /from\s*['"][^'"]*login-flow(\.js)?['"]/,
    'destination.ts must not depend on app/_lib/login-flow, which pulls in next/*; the dependency runs the other way',
  )
})

test('item 10: app/_lib/login-flow.ts imports sanitizeNextDestination from src/destination and no longer defines its own', () => {
  const src = readFileSync(path.join(REPO_ROOT, 'app', '_lib', 'login-flow.ts'), 'utf8')
  assert.doesNotMatch(
    src,
    /\bfunction\s+sanitizeNextDestination\b/,
    'login-flow.ts must not define its own sanitizeNextDestination any more',
  )
  assert.match(
    src,
    /import\s*\{[^}]*\bsanitizeNextDestination\b[^}]*\}\s*from\s*['"][^'"]*\/destination(\.js)?['"]/,
    'login-flow.ts must import sanitizeNextDestination from src/destination',
  )
  assert.match(
    src,
    /export\s*\{[^}]*\bsanitizeNextDestination\b[^}]*\}/,
    'login-flow.ts must still export sanitizeNextDestination under that name',
  )
})
