// test/86-origin-and-image.test.ts
//
// docs/SPEC-week34-body-warning.md §7.3, items 7 to 9 (items 8 and 9 re-aimed
// by §7.4: the expected host comes from APP_ORIGIN, never from the request): acceptance for the two
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
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { NextRequest } from 'next/server'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const NEXT_CONFIG_PATH = path.join(REPO_ROOT, 'next.config.mjs')
const ORIGIN_GATE_PATH = path.join(REPO_ROOT, 'src', 'origin-gate.ts')

type OriginGateModule = {
  originAllowed: (headers: Headers, method: string, appOrigin: string | undefined) => boolean
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
  // Spec 7.5: Next builds its image cache before it checks unoptimized, and
  // would try to create .next/cache/images, which the image leaves unwritable.
  assert.equal((images as { maximumDiskCacheSize?: unknown }).maximumDiskCacheSize, 0, 'images.maximumDiskCacheSize must be exactly 0')

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

// --- 8. src/origin-gate.ts as a unit (spec 7.4) -------------------------

function headersOf(entries: Record<string, string>): Headers {
  return new Headers(entries)
}

const APP = 'https://app.w34-test.example'

test('8: an Origin whose host equals the appOrigin host passes; another host is refused', async () => {
  const { originAllowed } = await loadOriginGate()
  assert.equal(originAllowed(headersOf({ origin: APP }), 'POST', APP), true, 'same origin')
  assert.equal(originAllowed(headersOf({ origin: 'http://app.w34-test.example' }), 'POST', APP), true, 'the scheme is not part of the comparison')
  assert.equal(originAllowed(headersOf({ origin: `${APP}/c/x` }), 'POST', APP), true, 'a path after the host is ignored')
  assert.equal(originAllowed(headersOf({ origin: 'https://evil.w34-test.example' }), 'POST', APP), false, 'another host')
  assert.equal(originAllowed(headersOf({ origin: 'https://w34-test.example' }), 'POST', APP), false, 'a parent domain')
  assert.equal(originAllowed(headersOf({ origin: 'https://app.w34-test.example.evil.example' }), 'POST', APP), false, 'a longer host that starts the same')
  assert.equal(
    originAllowed(headersOf({ origin: 'http://w34canary-origin2.example/c/x' }), 'POST', 'http://127.0.0.1:3934'),
    false,
    'the shape the review measured',
  )
  assert.equal(originAllowed(headersOf({ origin: 'http://127.0.0.1:3934' }), 'POST', 'http://127.0.0.1:3934'), true, 'the measured same-origin shape')
})

test('8: an Origin that does not parse is refused', async () => {
  const { originAllowed } = await loadOriginGate()
  for (const origin of ['null', 'garbage', 'app.w34-test.example', '//app.w34-test.example']) {
    assert.equal(originAllowed(headersOf({ origin }), 'POST', APP), false, `Origin: ${origin}`)
  }
  // The control: the same appOrigin with a real origin passes.
  assert.equal(originAllowed(headersOf({ origin: APP }), 'POST', APP), true)
})

test('8: the port is part of the host: a mismatched port is refused, a matching one passes', async () => {
  const { originAllowed } = await loadOriginGate()
  const app = 'http://app.w34-test.example:3000'
  assert.equal(originAllowed(headersOf({ origin: 'http://app.w34-test.example:3000' }), 'POST', app), true)
  assert.equal(originAllowed(headersOf({ origin: 'http://app.w34-test.example:3001' }), 'POST', app), false)
  assert.equal(originAllowed(headersOf({ origin: 'http://app.w34-test.example' }), 'POST', app), false)
  assert.equal(originAllowed(headersOf({ origin: 'http://app.w34-test.example:3000' }), 'POST', 'http://app.w34-test.example'), false)
})

test('8: a missing or unparseable appOrigin refuses every POST that carries an Origin', async () => {
  const { originAllowed } = await loadOriginGate()
  // The control: with a good appOrigin the same request passes.
  assert.equal(originAllowed(headersOf({ origin: APP }), 'POST', APP), true, 'control')
  for (const appOrigin of [undefined, '', 'garbage', 'null', 'app.w34-test.example']) {
    assert.equal(originAllowed(headersOf({ origin: APP }), 'POST', appOrigin), false, `appOrigin: ${String(appOrigin)}`)
    assert.equal(originAllowed(headersOf({ origin: 'garbage' }), 'POST', appOrigin), false, `garbage origin, appOrigin: ${String(appOrigin)}`)
  }
})

test('8: no Origin header passes, whatever the appOrigin', async () => {
  const { originAllowed } = await loadOriginGate()
  assert.equal(originAllowed(headersOf({}), 'POST', APP), true)
  assert.equal(originAllowed(headersOf({}), 'POST', undefined), true)
  assert.equal(originAllowed(headersOf({}), 'POST', 'garbage'), true)
  assert.equal(originAllowed(headersOf({ host: 'app.w34-test.example' }), 'POST', APP), true)
  // The control: a foreign Origin on the same request is refused.
  assert.equal(originAllowed(headersOf({ origin: 'https://other.example' }), 'POST', APP), false)
})

test('8: the request headers cannot talk the gate round: only appOrigin counts', async () => {
  const { originAllowed } = await loadOriginGate()
  const foreign = 'https://evil.w34-test.example'
  // host and x-forwarded-host both name the Origin's host, appOrigin differs: refused.
  assert.equal(originAllowed(headersOf({ host: 'evil.w34-test.example', origin: foreign }), 'POST', APP), false, 'host equals the Origin')
  assert.equal(originAllowed(headersOf({ 'x-forwarded-host': 'evil.w34-test.example', origin: foreign }), 'POST', APP), false, 'x-forwarded-host equals the Origin')
  assert.equal(
    originAllowed(headersOf({ host: 'evil.w34-test.example', 'x-forwarded-host': 'evil.w34-test.example, b.example', origin: foreign }), 'POST', APP),
    false,
    'both equal the Origin',
  )
  assert.equal(
    originAllowed(headersOf({ 'x-forwarded-host': 'a.example, b.example', origin: 'https://a.example' }), 'POST', APP),
    false,
    'the first forwarded host equals the Origin',
  )
  assert.equal(originAllowed(headersOf({ host: 'evil.w34-test.example', origin: foreign }), 'POST', undefined), false, 'no appOrigin: headers still do not count')
  // The converse: wrong host headers do not refuse an Origin that matches appOrigin.
  assert.equal(originAllowed(headersOf({ host: 'evil.w34-test.example', 'x-forwarded-host': 'evil.w34-test.example', origin: APP }), 'POST', APP), true)
})

test('8: any method but POST is never refused, whatever the Origin and appOrigin', async () => {
  const { originAllowed } = await loadOriginGate()
  // The control: the same headers on a POST are refused.
  assert.equal(originAllowed(headersOf({ origin: 'https://evil.example' }), 'POST', APP), false)
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(originAllowed(headersOf({ origin: 'https://evil.example' }), method, APP), true, `${method}, foreign origin`)
    assert.equal(originAllowed(headersOf({ origin: 'null' }), method, APP), true, `${method}, Origin: null`)
    assert.equal(originAllowed(headersOf({ origin: 'garbage' }), method, undefined), true, `${method}, garbage origin, no appOrigin`)
  }
})

// The only header the gate may read is origin (spec 7.4). The source is read
// at run time, comments stripped, so this fails while the file is absent.
// Copied from test/84 (itself copied from test/68 and test/63).
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

test('8: src/origin-gate.ts reads no header but origin', () => {
  assert.ok(existsSync(ORIGIN_GATE_PATH), 'src/origin-gate.ts does not exist')
  const code = stripComments(readFileSync(ORIGIN_GATE_PATH, 'utf8'))
  const lines = code.split('\n')
  const getCalls: Array<{ line: number; arg: string }> = []
  lines.forEach((text, index) => {
    for (const m of text.matchAll(/headers\.get\(\s*([^)]*)\)/g)) getCalls.push({ line: index + 1, arg: m[1].trim() })
  })
  assert.ok(getCalls.length >= 1, 'the gate must read the Origin header with headers.get(')
  for (const call of getCalls) {
    assert.match(call.arg, /^(['"`])origin\1$/i, `line ${call.line}: .get(${call.arg}) reads a header other than origin`)
  }
  assert.ok(!/x-forwarded|['"`]host['"`]|referer|user-agent|forwarded/i.test(code), 'the gate must not name any other request header')
  // No wholesale header reads that would sidestep the .get check.
  assert.ok(!/headers\s*(?:\.\s*(?:entries|keys|values|forEach)\b|\[\s*Symbol\.iterator)|\.\.\.\s*headers\b|Object\.\w+\(\s*headers\b/.test(code), 'the gate must not iterate the headers')
})

// --- 9. middleware() answers 403 before the body gate (spec 7.4) ---------

const SAME_HOST = 'app.w34-test.example'
const REQUEST_URL = `https://${SAME_HOST}/c/abc`
const ACTION_ID = '00'.repeat(21)
const FOREIGN_ORIGIN = 'http://w34canary-origin2.example/c/x'

// Sets process.env.APP_ORIGIN for the duration of fn and restores whatever was
// there (including nothing) afterwards. `undefined` removes the variable.
async function withAppOrigin<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const had = Object.prototype.hasOwnProperty.call(process.env, 'APP_ORIGIN')
  const before = process.env.APP_ORIGIN
  if (value === undefined) delete process.env.APP_ORIGIN
  else process.env.APP_ORIGIN = value
  try {
    return await fn()
  } finally {
    if (had) process.env.APP_ORIGIN = before
    else delete process.env.APP_ORIGIN
  }
}

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
  await withAppOrigin(APP, async () => {
    await assertRefused403(await middleware(actionRequest('[]', { origin: FOREIGN_ORIGIN })), 'foreign origin, JSON body')
  })
})

test('9: the 403 comes before the body gate: a foreign Origin with a body the gate would answer 400 still gets 403', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    // Control: the same body from the same origin is the body gate's 400.
    const control = await middleware(actionRequest('{{{', { origin: APP }))
    assert.ok(control, 'control: a response')
    assert.equal(control.status, 400, 'control: same origin, non-JSON body, the body gate answers 400')

    await assertRefused403(await middleware(actionRequest('{{{', { origin: FOREIGN_ORIGIN })), 'foreign origin, non-JSON body')
    await assertRefused403(await middleware(actionRequest(null, { origin: FOREIGN_ORIGIN })), 'foreign origin, no body')
  })
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
  await withAppOrigin(APP, async () => {
    await assertRefused403(await middleware(request), 'foreign origin, multipart')
  })
})

test('9: an unparseable Origin answers 403', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    await assertRefused403(await middleware(actionRequest('[]', { origin: 'null' })), 'Origin: null')
    await assertRefused403(await middleware(actionRequest('[]', { origin: 'garbage' })), 'Origin: garbage')
  })
})

test('9: a same-origin action passes through to the body gate as before', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    // The first line is what fails before the change; the rest holds today.
    await assertRefused403(await middleware(actionRequest('[]', { origin: FOREIGN_ORIGIN })), 'control: foreign origin')

    assertPassedThrough(await middleware(actionRequest('["$K1"]', { origin: APP })), 'same origin, JSON body')
    assertPassedThrough(await middleware(actionRequest('["$K1"]', {})), 'no Origin header, JSON body')

    const rejected = await middleware(actionRequest('{{{', { origin: APP }))
    assert.ok(rejected)
    assert.equal(rejected.status, 400, 'same origin, non-JSON body: the body gate still answers 400')
    assert.equal(await rejected.text(), '', 'the 400 stays empty')
  })
})

test('9: the request headers cannot talk the gate round: host and x-forwarded-host naming the Origin do not help', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    const foreignHost = 'w34canary-origin2.example'
    await assertRefused403(
      await middleware(actionRequest('[]', { host: foreignHost, 'x-forwarded-host': foreignHost, origin: `http://${foreignHost}` })),
      'host and x-forwarded-host equal to the Origin',
    )
    await assertRefused403(
      await middleware(actionRequest('[]', { 'x-forwarded-host': 'a.example, b.example', origin: 'https://a.example' })),
      'first forwarded host equal to the Origin',
    )
    // The converse: odd host headers do not refuse an Origin that matches APP_ORIGIN.
    assertPassedThrough(
      await middleware(actionRequest('["$K1"]', { host: foreignHost, 'x-forwarded-host': foreignHost, origin: APP })),
      'Origin equal to APP_ORIGIN, host headers elsewhere',
    )
  })
})

test('9: middleware reads APP_ORIGIN at call time; a missing or unparseable APP_ORIGIN refuses an Origin-bearing POST', async () => {
  const { middleware } = await loadMiddleware()
  const request = (): NextRequest => actionRequest('["$K1"]', { origin: 'https://other.w34-test.example' })

  await withAppOrigin(APP, async () => {
    await assertRefused403(await middleware(request()), 'APP_ORIGIN names another host')
  })
  await withAppOrigin('https://other.w34-test.example', async () => {
    assertPassedThrough(await middleware(request()), 'APP_ORIGIN names the Origin host')
  })
  await withAppOrigin(undefined, async () => {
    await assertRefused403(await middleware(request()), 'APP_ORIGIN unset')
    assertPassedThrough(await middleware(actionRequest('["$K1"]', {})), 'APP_ORIGIN unset, no Origin: still passes')
  })
  await withAppOrigin('garbage', async () => {
    await assertRefused403(await middleware(request()), 'APP_ORIGIN unparseable')
  })
})
