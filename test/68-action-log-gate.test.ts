// test/68-action-log-gate.test.ts
//
// docs/SPEC-week18-action-log-gate.md §4: acceptance for the middleware that
// answers 404 to any request whose next-action header is not exactly 42
// lowercase hex characters, before Next's action handler can echo it into
// the container log. Written from the spec only (§4's own rule): neither
// middleware.ts nor src/action-gate.ts was opened while writing this file.
//
// The two modules are loaded with a dynamic import inside each test body,
// not a static import at the top, and the source-text reads for items 9-11
// happen inside their own test bodies too. Before the implementation exists
// this makes every test fail on its own, with its own message, instead of
// one static import error taking the whole file down before any test runs.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { NextRequest } from 'next/server'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ACTION_GATE_PATH = path.join(REPO_ROOT, 'src', 'action-gate.ts')
const MIDDLEWARE_PATH = path.join(REPO_ROOT, 'middleware.ts')

function loadActionGate() {
  return import('../src/action-gate.js')
}

function loadMiddleware() {
  return import('../middleware.js')
}

// --- comment stripping ------------------------------------------------
//
// Copied from test/63-copy-contract.test.ts: a small state machine rather
// than a line-comment regex, so a "//" inside a string literal (there is
// none expected here, but the sweep must not assume that) is never mistaken
// for the start of a comment. Strings are copied through untouched; `//` to
// end of line and `/* ... */` are dropped.
function stripComments(src: string): string {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const two = src.slice(i, i + 2)
    if (two === '//') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (two === '/*') {
      i += 2
      while (i < n && src.slice(i, i + 2) !== '*/') i++
      i += 2
      continue
    }
    const c = src[i]
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += c
      i++
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < n) {
          out += src[i] + src[i + 1]
          i += 2
          continue
        }
        out += src[i]
        i++
      }
      if (i < n) {
        out += src[i]
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}

// Copied, not imported, from test/14-share-card.test.ts, per §4 item 11.
const HEADER_READ_INDICATORS =
  /user-agent|x-forwarded|referer|referrer|remoteAddress|req\.ip|request\.ip|ip address|\bheaders\(\)|from 'next\/headers'.*\bheaders\b/i

// A deterministic run of lowercase hex characters, cycled from a fixed pool
// so every length asked for (40, 41, 42, 43, ...) is easy to eyeball and
// never depends on Math.random. `seed` is placed first so callers pinning
// §4 item 1's "one starting 00" / "one starting 7f" can do so directly.
function hexOfLength(length: number, seed: string): string {
  const pool = '0123456789abcdef'
  let out = seed
  let i = 0
  while (out.length < length) {
    out += pool[i % pool.length]
    i++
  }
  return out.slice(0, length)
}

// ---------------------------------------------------------------------------
// 1. isWellFormedActionId accepts 42 lowercase hex, two distinct values
// ---------------------------------------------------------------------------

test('§4.1 isWellFormedActionId accepts 42 lowercase hex characters', async () => {
  const { isWellFormedActionId } = await loadActionGate()

  const startingZero = hexOfLength(42, '00')
  const startingSeven = hexOfLength(42, '7f')

  assert.equal(startingZero.length, 42)
  assert.equal(startingSeven.length, 42)
  assert.notEqual(startingZero, startingSeven)

  assert.equal(isWellFormedActionId(startingZero), true)
  assert.equal(isWellFormedActionId(startingSeven), true)
})

// ---------------------------------------------------------------------------
// 2. isWellFormedActionId rejects the listed malformed values
// ---------------------------------------------------------------------------

test('§4.2 isWellFormedActionId rejects every listed malformed value', async () => {
  const { isWellFormedActionId } = await loadActionGate()

  const base = hexOfLength(42, '00')
  const oneUppercaseIndex = [...base].findIndex((c) => /[a-f]/.test(c))
  const withOneUppercase = base.slice(0, oneUppercaseIndex) + base[oneUppercaseIndex]!.toUpperCase() + base.slice(oneUppercaseIndex + 1)
  const withOneG = 'g' + base.slice(1)

  const cases: Record<string, string> = {
    empty: '',
    singleChar: 'x',
    canary: 'canary-7f3a9',
    hex40: hexOfLength(40, '00'),
    hex41: hexOfLength(41, '00'),
    hex43: hexOfLength(43, '00'),
    oneUppercaseLetter: withOneUppercase,
    oneInvalidLetterG: withOneG,
    trailingNewline: base + '\n',
    leadingSpace: ' ' + base,
    arabic42: 'س'.repeat(42),
  }

  // Sanity on the fixtures themselves, so a failure below is never blamed on
  // a miscounted test string.
  assert.equal(cases.hex40!.length, 40)
  assert.equal(cases.hex41!.length, 41)
  assert.equal(cases.hex43!.length, 43)
  assert.equal(withOneUppercase.length, 42)
  assert.equal(withOneG.length, 42)
  assert.equal(cases.arabic42!.length, 42)

  for (const [label, value] of Object.entries(cases)) {
    assert.equal(
      isWellFormedActionId(value),
      false,
      `expected isWellFormedActionId to reject case "${label}": ${JSON.stringify(value)}`,
    )
  }
})

// ---------------------------------------------------------------------------
// 3 & 4. middleware() answers 404 to a malformed next-action, POST and GET
// ---------------------------------------------------------------------------

test('§4.3 middleware() given a POST with a malformed next-action returns 404, an empty body, and no set-cookie', async () => {
  const { middleware } = await loadMiddleware()

  const request = new NextRequest('https://w18-gate-test.example/', {
    method: 'POST',
    headers: { 'next-action': 'canary-7f3a9' },
  })
  const response = await middleware(request)

  assert.ok(response, 'middleware must return a response for a malformed next-action')
  assert.equal(response.status, 404)
  assert.equal(await response.text(), '')
  assert.equal(response.headers.get('set-cookie'), null)
})

test('§4.4 middleware() given a GET with a malformed next-action also returns 404', async () => {
  const { middleware } = await loadMiddleware()

  const request = new NextRequest('https://w18-gate-test.example/', {
    method: 'GET',
    headers: { 'next-action': 'canary-7f3a9' },
  })
  const response = await middleware(request)

  assert.ok(response)
  assert.equal(response.status, 404)
  assert.equal(await response.text(), '')
  assert.equal(response.headers.get('set-cookie'), null)
})

// ---------------------------------------------------------------------------
// 5. the rejected value never comes back, in body or in any header
// ---------------------------------------------------------------------------

test('§4.5 the 404 response never echoes the rejected next-action value, in body or in any header', async () => {
  const { middleware } = await loadMiddleware()

  const rejectedValue = 'canary-7f3a9'
  const request = new NextRequest('https://w18-gate-test.example/', {
    method: 'POST',
    headers: { 'next-action': rejectedValue },
  })
  const response = await middleware(request)

  const body = await response.text()
  assert.ok(!body.includes(rejectedValue), 'response body must not contain the rejected value')

  for (const [key, value] of response.headers.entries()) {
    assert.ok(!value.includes(rejectedValue), `header "${key}" echoes the rejected value: ${value}`)
  }
})

// ---------------------------------------------------------------------------
// 6 & 7. pass-through: well-formed id, and no header at all
// ---------------------------------------------------------------------------

test('§4.6 middleware() given a POST with a well-formed next-action passes the request through', async () => {
  const { middleware } = await loadMiddleware()

  const wellFormed = hexOfLength(42, '00')
  const request = new NextRequest('https://w18-gate-test.example/', {
    method: 'POST',
    headers: { 'next-action': wellFormed },
  })
  const response = await middleware(request)

  assert.ok(response)
  assert.notEqual(response.status, 404)
  assert.equal(response.headers.get('x-middleware-next'), '1', 'a pass-through NextResponse.next() sets x-middleware-next')
})

test('§4.7 middleware() given a request with no next-action header passes it through', async () => {
  const { middleware } = await loadMiddleware()

  const request = new NextRequest('https://w18-gate-test.example/', { method: 'POST' })
  const response = await middleware(request)

  assert.ok(response)
  assert.notEqual(response.status, 404)
  assert.equal(response.headers.get('x-middleware-next'), '1')
})

// ---------------------------------------------------------------------------
// 8. config.matcher shape
// ---------------------------------------------------------------------------

test('§4.8 config.matcher is exactly one entry, gated on the next-action header', async () => {
  const { config } = await loadMiddleware()

  assert.ok(Array.isArray(config.matcher), 'config.matcher must be an array')
  assert.equal(config.matcher.length, 1, 'config.matcher must hold exactly one entry')

  const entry = config.matcher[0]
  assert.ok(entry && typeof entry === 'object', 'the matcher entry must be an object')
  assert.ok(Array.isArray(entry.has), 'the matcher entry must have a "has" array')
  assert.ok(
    entry.has.some(
      (condition: { type?: string; key?: string }) => condition && condition.type === 'header' && condition.key === 'next-action',
    ),
    `matcher entry.has must include { type: 'header', key: 'next-action' }, got: ${JSON.stringify(entry.has)}`,
  )
})

// ---------------------------------------------------------------------------
// 9. no console / process.stdout / process.stderr, comments stripped
// ---------------------------------------------------------------------------

test('§4.9 middleware.ts and src/action-gate.ts contain no console or process.stdout/stderr calls, comments stripped', () => {
  for (const filePath of [MIDDLEWARE_PATH, ACTION_GATE_PATH]) {
    const relative = path.relative(REPO_ROOT, filePath)
    const src = readFileSync(filePath, 'utf8')
    const stripped = stripComments(src)

    assert.ok(!/console\s*\./.test(stripped), `${relative} contains a console. call`)
    assert.ok(!/process\s*\.\s*stdout/.test(stripped), `${relative} contains process.stdout`)
    assert.ok(!/process\s*\.\s*stderr/.test(stripped), `${relative} contains process.stderr`)
  }
})

// ---------------------------------------------------------------------------
// 10. every headers.get( call in middleware.ts reads only 'next-action';
//     no cookies
// ---------------------------------------------------------------------------

test("§4.10 middleware.ts reads only the literal 'next-action' header and never touches cookies, comments stripped", () => {
  const src = readFileSync(MIDDLEWARE_PATH, 'utf8')
  const stripped = stripComments(src)

  const calls = [...stripped.matchAll(/headers\s*\.\s*get\(([^)]*)\)/g)].map((m) => m[1]!.trim())
  assert.ok(calls.length > 0, 'middleware.ts must call headers.get at least once, to read next-action')

  for (const arg of calls) {
    assert.ok(
      arg === "'next-action'" || arg === '"next-action"',
      `every headers.get() call in middleware.ts must take the literal 'next-action', found: ${arg}`,
    )
  }

  assert.ok(!/cookies/.test(stripped), 'middleware.ts must not reference cookies in any form')
})

// ---------------------------------------------------------------------------
// 11. week 6 header-read tripwire, applied to middleware.ts
// ---------------------------------------------------------------------------

test('§4.11 the week 6 header-read indicators find nothing in middleware.ts, comments stripped', () => {
  const src = readFileSync(MIDDLEWARE_PATH, 'utf8')
  const stripped = stripComments(src)
  const lines = stripped.split(/\r?\n/)

  const matches = lines
    .map((text, i) => ({ line: i + 1, text: text.trim() }))
    .filter(({ text }) => HEADER_READ_INDICATORS.test(text))

  assert.deepEqual(matches, [], `header-read indicators matched in middleware.ts: ${JSON.stringify(matches)}`)
})

// ---------------------------------------------------------------------------
// 12. mutation guard -- one pinned case per length class
// ---------------------------------------------------------------------------

// Loosening the regex to /^[0-9a-f]{40,42}$/ would accept the 40- and
// 41-length cases below. Dropping the anchors, e.g. /[0-9a-f]{42}/, would
// find a matching 42-char run inside the 43-length case and accept it too.
// Each case is built fresh here rather than reused from item 2, so this
// guard stands even if item 2's test is ever rewritten.
test('§4.12 mutation guard: a rejection is pinned for each length class (short, 40, 41, 43)', async () => {
  const { isWellFormedActionId } = await loadActionGate()

  const valid42 = hexOfLength(42, '00')
  const short = 'x'
  const hex40 = hexOfLength(40, '00')
  const hex41 = hexOfLength(41, '00')
  const hex43 = hexOfLength(43, '00')

  assert.equal(valid42.length, 42)
  assert.equal(hex40.length, 40)
  assert.equal(hex41.length, 41)
  assert.equal(hex43.length, 43)

  // The 42-length control case must pass -- otherwise the rejections below
  // would be meaningless (the fixture, not the length, would be at fault).
  assert.equal(isWellFormedActionId(valid42), true)

  assert.equal(isWellFormedActionId(short), false, 'a short value must be rejected')
  assert.equal(isWellFormedActionId(hex40), false, 'a 40-hex value must be rejected (guards a {40,42} quantifier)')
  assert.equal(isWellFormedActionId(hex41), false, 'a 41-hex value must be rejected (guards a {40,42} quantifier)')
  assert.equal(isWellFormedActionId(hex43), false, 'a 43-hex value must be rejected (guards dropped anchors)')
})
