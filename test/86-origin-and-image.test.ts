// test/86-origin-and-image.test.ts
//
// docs/SPEC-week34-body-warning.md §7.3, items 7 to 9: acceptance for the two
// requests the review found still writing sender text into the log -- the
// image optimizer endpoint (/_next/image) and a foreign Origin on a server
// action. Written from the spec only (§5's rule, carried into §7): neither
// src/origin-gate.ts, the new part of middleware.ts nor the new block of
// next.config.mjs was opened while writing this file.
//
// Every module is loaded with a dynamic import inside each test body, so
// before the implementation exists each test fails on its own with its own
// message instead of one import error taking the whole file down. The
// specifier for src/origin-gate.ts goes through a constant, with the shape the
// coordinator fixed written out as a local type, so `tsc --noEmit` is not
// broken by a module that does not exist yet; the runtime import is still the
// real module.
//
// Several tests start with an assertion that only the new behaviour satisfies
// (a foreign Origin is refused) and only then check the behaviour that already
// holds today (a same-origin request passes), so none of them passes on the
// tree as it was before the change.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { NextRequest } from 'next/server'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const NEXT_CONFIG_PATH = path.join(REPO_ROOT, 'next.config.mjs')

type OriginGateModule = {
  originAllowed: (headers: Headers, method: string) => boolean
}

const ORIGIN_GATE_SPECIFIER = '../src/origin-gate.js'

function loadOriginGate(): Promise<OriginGateModule> {
  return import(ORIGIN_GATE_SPECIFIER) as Promise<OriginGateModule>
}

function loadMiddleware() {
  return import('../middleware.js')
}

// --- 7. the image endpoint ---------------------------------------------

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = path.join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(?:[cm]?[jt]sx?)$/.test(name)) out.push(p)
    }
  }
  walk(dir)
  return out
}

const NEXT_IMAGE_IMPORT = /from\s*['"]next\/image['"]|require\(\s*['"]next\/image['"]\s*\)|import\(\s*['"]next\/image['"]\s*\)|import\s*['"]next\/image['"]/

test('7: next.config.mjs sets images.unoptimized to true, and nothing in app/ or src/ imports next/image', async () => {
  const mod = (await import(pathToFileURL(NEXT_CONFIG_PATH).href)) as { default: unknown }
  let config: unknown = mod.default
  if (typeof config === 'function') {
    config = await (config as (phase: string, ctx: { defaultConfig: object }) => unknown)('phase-production-build', {
      defaultConfig: {},
    })
  }
  const images = (config as { images?: { unoptimized?: unknown } } | undefined)?.images
  assert.ok(images && typeof images === 'object', 'the config must carry an images block')
  assert.equal(images.unoptimized, true, 'images.unoptimized must be exactly true')

  // The endpoint is switched off, so nothing may rely on it (spec 7.1 item 1).
  const files = [...sourceFiles(path.join(REPO_ROOT, 'app')), ...sourceFiles(path.join(REPO_ROOT, 'src'))]
  assert.ok(files.length > 20, `expected to scan the app and src trees, found ${files.length} files`)
  const offenders = files.filter((f) => NEXT_IMAGE_IMPORT.test(readFileSync(f, 'utf8')))
  assert.deepEqual(
    offenders.map((f) => path.relative(REPO_ROOT, f)),
    [],
    'no file under app/ or src/ may import next/image',
  )
})

// --- 8. src/origin-gate.ts as a unit -----------------------------------

function headersOf(entries: Record<string, string>): Headers {
  return new Headers(entries)
}

test('8: a matching Origin passes; a mismatched host is refused', async () => {
  const { originAllowed } = await loadOriginGate()
  const host = 'app.w34-test.example'
  assert.equal(originAllowed(headersOf({ host, origin: `https://${host}` }), 'POST'), true, 'https origin, same host')
  assert.equal(originAllowed(headersOf({ host, origin: `http://${host}` }), 'POST'), true, 'the scheme is not part of the comparison')
  assert.equal(originAllowed(headersOf({ host, origin: `https://${host}/c/x` }), 'POST'), true, 'a path after the host is ignored')
  assert.equal(originAllowed(headersOf({ host, origin: 'https://evil.w34-test.example' }), 'POST'), false, 'another host')
  assert.equal(
    originAllowed(headersOf({ host: '127.0.0.1:3934', origin: 'http://w34canary-origin2.example/c/x' }), 'POST'),
    false,
    'the shape the review measured',
  )
})

test('8: an Origin that does not parse is refused', async () => {
  const { originAllowed } = await loadOriginGate()
  const host = 'app.w34-test.example'
  for (const origin of ['null', 'garbage', 'app.w34-test.example', '//app.w34-test.example']) {
    assert.equal(originAllowed(headersOf({ host, origin }), 'POST'), false, `Origin: ${origin}`)
  }
  // The control: the same host, written as a real origin, passes.
  assert.equal(originAllowed(headersOf({ host, origin: `https://${host}` }), 'POST'), true)
})

test('8: the port is part of the host: a mismatched port is refused, a matching one passes', async () => {
  const { originAllowed } = await loadOriginGate()
  assert.equal(originAllowed(headersOf({ host: 'app.w34-test.example:3000', origin: 'http://app.w34-test.example:3000' }), 'POST'), true)
  assert.equal(originAllowed(headersOf({ host: 'app.w34-test.example:3000', origin: 'http://app.w34-test.example:3001' }), 'POST'), false)
  assert.equal(originAllowed(headersOf({ host: 'app.w34-test.example:3000', origin: 'http://app.w34-test.example' }), 'POST'), false)
  assert.equal(originAllowed(headersOf({ host: 'app.w34-test.example', origin: 'http://app.w34-test.example:3000' }), 'POST'), false)
})

test('8: no Origin header passes, with and without a host', async () => {
  const { originAllowed } = await loadOriginGate()
  assert.equal(originAllowed(headersOf({ host: 'app.w34-test.example' }), 'POST'), true)
  assert.equal(originAllowed(headersOf({ host: 'app.w34-test.example', 'x-forwarded-host': 'other.example' }), 'POST'), true)
  assert.equal(originAllowed(headersOf({}), 'POST'), true)
  // The control: the same request with a foreign Origin is refused.
  assert.equal(originAllowed(headersOf({ host: 'app.w34-test.example', origin: 'https://other.example' }), 'POST'), false)
})

test('8: the expected host is the first x-forwarded-host value, else host', async () => {
  const { originAllowed } = await loadOriginGate()
  const xfh = 'a.example, b.example'
  assert.equal(originAllowed(headersOf({ host: 'c.example', 'x-forwarded-host': xfh, origin: 'https://a.example' }), 'POST'), true, 'first value matches')
  assert.equal(originAllowed(headersOf({ host: 'c.example', 'x-forwarded-host': xfh, origin: 'https://b.example' }), 'POST'), false, 'second value does not')
  assert.equal(originAllowed(headersOf({ host: 'c.example', 'x-forwarded-host': xfh, origin: 'https://c.example' }), 'POST'), false, 'host is not consulted when x-forwarded-host is present')
  assert.equal(originAllowed(headersOf({ host: 'c.example', 'x-forwarded-host': 'a.example , b.example', origin: 'https://a.example' }), 'POST'), true, 'the first value is trimmed')
  assert.equal(originAllowed(headersOf({ host: 'c.example', origin: 'https://c.example' }), 'POST'), true, 'without x-forwarded-host, host is used')
  assert.equal(originAllowed(headersOf({ host: 'c.example', origin: 'https://a.example' }), 'POST'), false, 'without x-forwarded-host, a foreign origin is refused')
})

test('8: the comparison is exact and case-sensitive on the expected host', async () => {
  const { originAllowed } = await loadOriginGate()
  // new URL lowercases the Origin's host; the expected host is taken as sent,
  // as Next's own rule does, so a mixed-case host header never matches.
  assert.equal(originAllowed(headersOf({ host: 'app.w34-test.example', origin: 'https://app.w34-test.example' }), 'POST'), true)
  assert.equal(originAllowed(headersOf({ host: 'App.W34-Test.example', origin: 'https://app.w34-test.example' }), 'POST'), false)
})

test('8: a GET is never refused, whatever its Origin', async () => {
  const { originAllowed } = await loadOriginGate()
  const host = 'app.w34-test.example'
  // The control: the same headers on a POST are refused.
  assert.equal(originAllowed(headersOf({ host, origin: 'https://evil.example' }), 'POST'), false)
  assert.equal(originAllowed(headersOf({ host, origin: 'https://evil.example' }), 'GET'), true)
  assert.equal(originAllowed(headersOf({ host, origin: 'null' }), 'GET'), true)
  assert.equal(originAllowed(headersOf({ host, origin: 'garbage' }), 'GET'), true)
})

// --- 9. middleware() answers 403 before the body gate ------------------

const SAME_HOST = 'app.w34-test.example'
const REQUEST_URL = `https://${SAME_HOST}/c/abc`
const ACTION_ID = '00'.repeat(21)
const FOREIGN_ORIGIN = 'http://w34canary-origin2.example/c/x'

function actionRequest(body: BodyInit | null, headers: Record<string, string>): NextRequest {
  return new NextRequest(REQUEST_URL, {
    method: 'POST',
    headers: { host: SAME_HOST, 'next-action': ACTION_ID, 'content-type': 'text/plain;charset=UTF-8', ...headers },
    body,
  })
}

async function assertRefused403(response: Response | undefined, label: string): Promise<void> {
  assert.ok(response, `${label}: middleware must return a response`)
  assert.equal(response.status, 403, `${label}: status`)
  assert.equal(await response.text(), '', `${label}: the body must be empty`)
  assert.equal(response.headers.get('set-cookie'), null, `${label}: no set-cookie`)
  assert.notEqual(response.headers.get('x-middleware-next'), '1', `${label}: must not be a pass-through`)
}

function assertPassedThrough(response: Response | undefined, label: string): void {
  assert.ok(response, `${label}: middleware must return a response`)
  assert.notEqual(response.status, 403, `${label}: status`)
  assert.equal(response.headers.get('x-middleware-next'), '1', `${label}: a pass-through sets x-middleware-next`)
}

test('9: a foreign Origin on a well-formed action answers 403 with an empty body', async () => {
  const { middleware } = await loadMiddleware()
  await assertRefused403(await middleware(actionRequest('[]', { origin: FOREIGN_ORIGIN })), 'foreign origin, JSON body')
})

test('9: the 403 comes before the body gate: a foreign Origin with a body the gate would answer 400 still gets 403', async () => {
  const { middleware } = await loadMiddleware()
  // Control: the same body from the same origin is the body gate's 400.
  const control = await middleware(actionRequest('{{{', { origin: `https://${SAME_HOST}` }))
  assert.ok(control, 'control: a response')
  assert.equal(control.status, 400, 'control: same origin, non-JSON body, the body gate answers 400')

  await assertRefused403(await middleware(actionRequest('{{{', { origin: FOREIGN_ORIGIN })), 'foreign origin, non-JSON body')
  await assertRefused403(await middleware(actionRequest(null, { origin: FOREIGN_ORIGIN })), 'foreign origin, no body')
})

test('9: a foreign Origin on a multipart body answers 403', async () => {
  const { middleware } = await loadMiddleware()
  const form = new FormData()
  form.append('1_text', 'hello')
  const request = new NextRequest(REQUEST_URL, {
    method: 'POST',
    headers: { host: SAME_HOST, 'next-action': ACTION_ID, origin: FOREIGN_ORIGIN },
    body: form,
  })
  await assertRefused403(await middleware(request), 'foreign origin, multipart')
})

test('9: an unparseable Origin answers 403', async () => {
  const { middleware } = await loadMiddleware()
  await assertRefused403(await middleware(actionRequest('[]', { origin: 'null' })), 'Origin: null')
  await assertRefused403(await middleware(actionRequest('[]', { origin: 'garbage' })), 'Origin: garbage')
})

test('9: a same-origin action passes through to the body gate as before', async () => {
  const { middleware } = await loadMiddleware()
  // The first line is what fails before the change; the rest holds today.
  await assertRefused403(await middleware(actionRequest('[]', { origin: FOREIGN_ORIGIN })), 'control: foreign origin')

  assertPassedThrough(await middleware(actionRequest('["$K1"]', { origin: `https://${SAME_HOST}` })), 'same origin, JSON body')
  assertPassedThrough(await middleware(actionRequest('["$K1"]', {})), 'no Origin header, JSON body')

  const rejected = await middleware(actionRequest('{{{', { origin: `https://${SAME_HOST}` }))
  assert.ok(rejected)
  assert.equal(rejected.status, 400, 'same origin, non-JSON body: the body gate still answers 400')
  assert.equal(await rejected.text(), '', 'the 400 stays empty')
})

test('9: the expected host is the first x-forwarded-host value when the request carries one', async () => {
  const { middleware } = await loadMiddleware()
  const behindProxy = { 'x-forwarded-host': 'a.example, b.example' }
  await assertRefused403(
    await middleware(actionRequest('[]', { ...behindProxy, origin: `https://${SAME_HOST}` })),
    'origin equal to host but not to the forwarded host',
  )
  assertPassedThrough(await middleware(actionRequest('["$K1"]', { ...behindProxy, origin: 'https://a.example' })), 'origin equal to the first forwarded host')
  await assertRefused403(await middleware(actionRequest('[]', { ...behindProxy, origin: 'https://b.example' })), 'origin equal to the second forwarded host')
})
