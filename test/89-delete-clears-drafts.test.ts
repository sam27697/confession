// test/89-delete-clears-drafts.test.ts
//
// docs/SPEC-week37-delete-clears-drafts.md §5.1 "Acceptance, replacing §4
// items 1 to 8" (the unit half). §4 items 9 to 14 are staging checks and are
// not tested here. §5.1 supersedes the first draft of this slice: the gate is
// a same-origin Origin header, not the sid cookie, and the middleware reads no
// cookie.
//
// Written from the spec only: neither src/storage-wipe.ts nor the week 37
// change to middleware.ts was opened while writing this file. The new module
// is loaded with a dynamic import inside the test body (through a constant
// specifier, with the shape the spec fixes written out as a local type, so
// `tsc --noEmit` does not break on a module that does not exist yet), and
// every source-text read happens inside its own test body, so before the
// change each test fails on its own with its own message instead of one
// import error taking the file down.
//
// The middleware is driven the way test/68, test/84 and test/86 drive it:
// middleware() called directly with NextRequest objects, a pass-through
// recognised by x-middleware-next: 1, APP_ORIGIN set inside the test and
// restored afterwards.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { NextRequest } from 'next/server'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIDDLEWARE_PATH = path.join(REPO_ROOT, 'middleware.ts')
const STORAGE_WIPE_PATH = path.join(REPO_ROOT, 'src', 'storage-wipe.ts')

type StorageWipeModule = {
  ACCOUNT_DELETE_PATH: string
  wipesStorage: (method: string, pathname: string, headers: Headers, appOrigin: string | undefined) => boolean
}

const STORAGE_WIPE_SPECIFIER = '../src/storage-wipe.js'

function loadStorageWipe(): Promise<StorageWipeModule> {
  return import(STORAGE_WIPE_SPECIFIER) as Promise<StorageWipeModule>
}
function loadMiddleware() {
  return import('../middleware.js')
}

// --- comment stripping ------------------------------------------------------
//
// Copied from test/84-malformed-posts.test.ts (itself copied from test/68).
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

// --- fixtures ---------------------------------------------------------------

const APP = 'https://w37-test.example'
const FOREIGN_ORIGIN = 'https://w37-evil.example'
const DELETE_PATH = '/account/delete'
const DELETE_URL = `${APP}${DELETE_PATH}`
const SID_VALUE = 'w37-not-a-real-session'
const CLEAR_STORAGE = '"storage"'

// A deterministic run of lowercase hex characters (same helper as test/84).
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

const ACTION_ID = hexOfLength(42, '00')

function headersOf(init: Record<string, string>): Headers {
  return new Headers(init)
}

// Sets process.env.APP_ORIGIN for the duration of fn and restores whatever was
// there (including nothing) afterwards, as test/86 does.
async function withAppOrigin<T>(value: string, fn: () => Promise<T>): Promise<T> {
  const had = Object.prototype.hasOwnProperty.call(process.env, 'APP_ORIGIN')
  const before = process.env.APP_ORIGIN
  process.env.APP_ORIGIN = value
  try {
    return await fn()
  } finally {
    if (had) process.env.APP_ORIGIN = before
    else delete process.env.APP_ORIGIN
  }
}

type Opts = {
  url?: string
  // The Origin header: a string, or null for none. Default: the app's own.
  origin?: string | null
  // Whether a sid cookie rides along. Default: no. Items 3 and 4 run both.
  sid?: boolean
  nextAction?: string | null
  method?: string
}

function headersFor(opts: Opts): Record<string, string> {
  const headers: Record<string, string> = {}
  const origin = opts.origin === undefined ? APP : opts.origin
  if (origin !== null) headers.origin = origin
  if (opts.nextAction !== undefined && opts.nextAction !== null) headers['next-action'] = opts.nextAction
  if (opts.sid === true) headers.cookie = `sid=${SID_VALUE}`
  return headers
}

// The with-script shape: a next-action header and a multipart body.
function scriptRequest(opts: Opts = {}): NextRequest {
  const form = new FormData()
  form.append('1_confirm', 'on')
  return new NextRequest(opts.url ?? DELETE_URL, {
    method: opts.method ?? 'POST',
    headers: headersFor({ nextAction: ACTION_ID, ...opts }),
    body: form,
  })
}

// The no-JS shape: a native multipart POST with $ACTION_ID_<id>, no next-action.
function noJsRequest(opts: Opts = {}): NextRequest {
  const form = new FormData()
  form.append(`$ACTION_ID_${ACTION_ID}`, '')
  form.append('confirm', 'on')
  return new NextRequest(opts.url ?? DELETE_URL, {
    method: opts.method ?? 'POST',
    headers: headersFor({ ...opts, nextAction: null }),
    body: form,
  })
}

function assertPassedThrough(response: Response | undefined | null, label: string): asserts response is Response {
  assert.ok(response, `${label}: middleware must return a response`)
  assert.notEqual(response.status, 400, `${label}: status`)
  assert.notEqual(response.status, 403, `${label}: status`)
  assert.notEqual(response.status, 404, `${label}: status`)
  assert.equal(response.headers.get('x-middleware-next'), '1', `${label}: a pass-through sets x-middleware-next`)
}

function assertWipes(response: Response, label: string) {
  assert.equal(
    response.headers.get('clear-site-data'),
    CLEAR_STORAGE,
    `${label}: Clear-Site-Data must be exactly "storage" with the double quotes`,
  )
}

function assertNoWipe(response: Response, label: string) {
  assert.equal(response.headers.get('clear-site-data'), null, `${label}: no Clear-Site-Data`)
}

// ===========================================================================
// 1. wipesStorage: true for a same-host Origin
// ===========================================================================

test("89.1: wipesStorage('POST', '/account/delete', h, A) is true where h's Origin equals A", async () => {
  const { wipesStorage, ACCOUNT_DELETE_PATH } = await loadStorageWipe()
  assert.equal(typeof wipesStorage, 'function', 'src/storage-wipe.ts must export wipesStorage (spec §5.1)')
  assert.equal(ACCOUNT_DELETE_PATH, '/account/delete', 'src/storage-wipe.ts must export ACCOUNT_DELETE_PATH (spec §5.1)')
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin: APP }), APP), true)
})

test('89.1: it is also true where the Origin differs from A only in scheme or path (host equal)', async () => {
  const { wipesStorage } = await loadStorageWipe()
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin: APP }), APP), true, 'control')
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin: 'http://w37-test.example' }), APP), true, 'scheme differs')
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin: `${APP}/c/x` }), APP), true, 'path differs')
  assert.equal(
    wipesStorage('POST', '/account/delete', headersOf({ origin: 'http://w37-test.example/account/delete' }), APP),
    true,
    'scheme and path differ',
  )
  // The converse: appOrigin may carry the scheme or a path too.
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin: APP }), 'http://w37-test.example/x'), true, 'appOrigin differs')
})

// ===========================================================================
// 2. wipesStorage: false for each listed case
// ===========================================================================

test('89.2: wipesStorage is false for method GET, PUT and post (lowercase)', async () => {
  const { wipesStorage } = await loadStorageWipe()
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin: APP }), APP), true, 'control')
  for (const method of ['GET', 'PUT', 'post']) {
    assert.equal(wipesStorage(method, '/account/delete', headersOf({ origin: APP }), APP), false, `method ${method}`)
  }
})

test('89.2: wipesStorage is false for each listed path', async () => {
  const { wipesStorage } = await loadStorageWipe()
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin: APP }), APP), true, 'control')
  for (const pathname of ['/account/delete/', '/account/DELETE', '/account/delete/x', '/account', '/auth/logout', '/', '/c/x']) {
    assert.equal(wipesStorage('POST', pathname, headersOf({ origin: APP }), APP), false, `path ${pathname}`)
  }
})

test('89.2: wipesStorage is false with no Origin, whatever else the headers say', async () => {
  const { wipesStorage } = await loadStorageWipe()
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin: APP }), APP), true, 'control')
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({}), APP), false, 'no headers')
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ cookie: `sid=${SID_VALUE}` }), APP), false, 'a session cookie is not an Origin')
  // It reads no header but origin: the app's own host in other headers does not stand in for one.
  assert.equal(
    wipesStorage(
      'POST',
      '/account/delete',
      headersOf({ host: 'w37-test.example', 'x-forwarded-host': 'w37-test.example', referer: `${APP}/account/delete` }),
      APP,
    ),
    false,
    'host, x-forwarded-host and referer naming the app',
  )
})

test('89.2: wipesStorage is false for an Origin of another host, a subdomain of A, and A with another port', async () => {
  const { wipesStorage } = await loadStorageWipe()
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin: APP }), APP), true, 'control')
  const cases: Array<[string, string]> = [
    ['another host', FOREIGN_ORIGIN],
    ['a subdomain of A', 'https://app.w37-test.example'],
    ['A with another port', 'https://w37-test.example:8443'],
    ['a longer host that starts the same', 'https://w37-test.example.w37-evil.example'],
    ['a parent domain', 'https://example'],
  ]
  for (const [label, origin] of cases) {
    assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin }), APP), false, `${label}: ${origin}`)
  }
  // The port counts both ways.
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin: APP }), 'https://w37-test.example:8443'), false, 'appOrigin carries a port the Origin lacks')
  assert.equal(
    wipesStorage('POST', '/account/delete', headersOf({ origin: 'https://w37-test.example:8443' }), 'https://w37-test.example:8443'),
    true,
    'control: the same port on both sides',
  )
  // Another host in the headers that do not count does not rescue it.
  assert.equal(
    wipesStorage('POST', '/account/delete', headersOf({ origin: FOREIGN_ORIGIN, host: 'w37-evil.example', 'x-forwarded-host': 'w37-evil.example' }), APP),
    false,
    'host headers equal to the Origin',
  )
})

test('89.2: wipesStorage is false for Origin: null and for an unparseable Origin', async () => {
  const { wipesStorage } = await loadStorageWipe()
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin: APP }), APP), true, 'control')
  for (const origin of ['null', 'garbage', 'w37-test.example', '//w37-test.example', '', ' ']) {
    assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin }), APP), false, `Origin: "${origin}"`)
  }
})

test('89.2: wipesStorage is false for appOrigin undefined and for an unparseable appOrigin', async () => {
  const { wipesStorage } = await loadStorageWipe()
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin: APP }), APP), true, 'control')
  for (const appOrigin of [undefined, '', 'garbage', 'null', 'w37-test.example']) {
    assert.equal(
      wipesStorage('POST', '/account/delete', headersOf({ origin: APP }), appOrigin),
      false,
      `appOrigin ${JSON.stringify(appOrigin)}`,
    )
  }
  // Two unparseable sides do not match each other.
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin: 'garbage' }), 'garbage'), false, 'both unparseable')
  assert.equal(wipesStorage('POST', '/account/delete', headersOf({ origin: 'null' }), 'null'), false, 'both null')
})

// ===========================================================================
// 3. middleware(): the with-script deletion POST, same-origin
// ===========================================================================

test('89.3: a with-script POST to /account/delete with a same-origin Origin passes through with Clear-Site-Data: "storage", no sid cookie', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    const request = scriptRequest({ sid: false })
    assert.equal(request.headers.get('cookie'), null, 'fixture: no cookie')
    const response = await middleware(request)
    assertPassedThrough(response, 'script delete, no sid')
    assertWipes(response, 'script delete, no sid')
  })
})

test('89.3: the same with a sid cookie present', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    const request = scriptRequest({ sid: true })
    assert.ok((request.headers.get('cookie') ?? '').includes('sid='), 'fixture: a sid cookie')
    const response = await middleware(request)
    assertPassedThrough(response, 'script delete, sid')
    assertWipes(response, 'script delete, sid')
  })
})

test('89.3: the Origin may differ from APP_ORIGIN in scheme or path only', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    for (const origin of ['http://w37-test.example', `${APP}/c/x`]) {
      const response = await middleware(scriptRequest({ origin }))
      assertPassedThrough(response, `Origin ${origin}`)
      assertWipes(response, `Origin ${origin}`)
    }
  })
})

// ===========================================================================
// 4. the same with no Origin: no header, with or without sid
// ===========================================================================

test('89.4: the same POST with no Origin header passes through with no Clear-Site-Data, without a sid cookie', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    // The control: with the Origin it is wiped, so a middleware that never
    // sets the header cannot pass this test by default.
    assertWipes(await middleware(scriptRequest()), 'control with Origin')

    const request = scriptRequest({ origin: null, sid: false })
    assert.equal(request.headers.get('origin'), null, 'fixture: no Origin')
    const response = await middleware(request)
    assertPassedThrough(response, 'script delete, no Origin, no sid')
    assertNoWipe(response, 'script delete, no Origin, no sid')
  })
})

test('89.4: the same POST with no Origin header and a sid cookie passes through with no Clear-Site-Data', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    assertWipes(await middleware(scriptRequest({ sid: true })), 'control with Origin and sid')

    const response = await middleware(scriptRequest({ origin: null, sid: true }))
    assertPassedThrough(response, 'script delete, no Origin, sid')
    assertNoWipe(response, 'script delete, no Origin, sid')
  })
})

test('89.4: the no-JS shape with no Origin gets no header either, with and without sid', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    assertWipes(await middleware(noJsRequest()), 'control with Origin')
    for (const sid of [false, true]) {
      const response = await middleware(noJsRequest({ origin: null, sid }))
      assertPassedThrough(response, `no-JS, no Origin, sid=${sid}`)
      assertNoWipe(response, `no-JS, no Origin, sid=${sid}`)
    }
  })
})

// ===========================================================================
// 5. the three gates still answer first, and their answers carry no header
// ===========================================================================

test('89.5: a foreign Origin answers 403 with no Clear-Site-Data, with and without sid', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    assertWipes(await middleware(scriptRequest()), 'control: same origin')

    for (const sid of [false, true]) {
      const response = await middleware(scriptRequest({ origin: FOREIGN_ORIGIN, sid }))
      assert.ok(response, 'a response')
      assert.equal(response.status, 403, `script shape, sid=${sid}`)
      assertNoWipe(response, `foreign Origin, sid=${sid}`)
      assert.notEqual(response.headers.get('x-middleware-next'), '1', 'a 403 is not a pass-through')

      const noJs = await middleware(noJsRequest({ origin: FOREIGN_ORIGIN, sid }))
      assert.equal(noJs.status, 403, `no-JS shape, sid=${sid}`)
      assertNoWipe(noJs, `foreign Origin, no-JS shape, sid=${sid}`)
    }
  })
})

test('89.5: Origin: null answers 403 with no Clear-Site-Data', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    assertWipes(await middleware(scriptRequest()), 'control: same origin')
    const response = await middleware(scriptRequest({ origin: 'null' }))
    assert.equal(response.status, 403)
    assertNoWipe(response, 'Origin: null')
  })
})

test('89.5: a malformed next-action with a same Origin answers 404 with no Clear-Site-Data', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    assertWipes(await middleware(scriptRequest()), 'control: well-formed next-action')
    for (const bad of ['canary-w37-7f3a9', 'zzz', hexOfLength(41, '00'), hexOfLength(43, '00'), '']) {
      for (const sid of [false, true]) {
        const response = await middleware(scriptRequest({ nextAction: bad, sid }))
        assert.ok(response, 'a response')
        assert.equal(response.status, 404, `next-action "${bad}", sid=${sid}: status`)
        assertNoWipe(response, `next-action "${bad}", sid=${sid}`)
        assert.notEqual(response.headers.get('x-middleware-next'), '1', `next-action "${bad}": not a pass-through`)
      }
    }
  })
})

test('89.5: a malformed multipart body with a same Origin answers 400 with no Clear-Site-Data', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    assertWipes(await middleware(scriptRequest()), 'control: valid multipart')

    for (const sid of [false, true]) {
      // With a well-formed next-action and a body that is not multipart.
      const withAction = new NextRequest(DELETE_URL, {
        method: 'POST',
        headers: { ...headersFor({ nextAction: ACTION_ID, sid }), 'content-type': 'multipart/form-data; boundary=x' },
        body: 'garbage',
      })
      const a = await middleware(withAction)
      assert.ok(a, 'a response')
      assert.equal(a.status, 400, `with next-action, sid=${sid}`)
      assertNoWipe(a, `broken multipart, with next-action, sid=${sid}`)
      assert.notEqual(a.headers.get('x-middleware-next'), '1')

      // Without next-action: a multipart that does not parse.
      const withoutAction = new NextRequest(DELETE_URL, {
        method: 'POST',
        headers: { ...headersFor({ nextAction: null, sid }), 'content-type': 'multipart/form-data; boundary=x' },
        body: 'garbage',
      })
      const b = await middleware(withoutAction)
      assert.equal(b.status, 400, `without next-action, sid=${sid}`)
      assertNoWipe(b, `broken multipart, no next-action, sid=${sid}`)

      // Without next-action: a form that parses but carries no $ACTION_ field.
      const form = new FormData()
      form.append('confirm', 'on')
      const noActionField = new NextRequest(DELETE_URL, { method: 'POST', headers: headersFor({ nextAction: null, sid }), body: form })
      const c = await middleware(noActionField)
      assert.equal(c.status, 400, `a form with no $ACTION_ field, sid=${sid}`)
      assertNoWipe(c, `multipart with no $ACTION_ field, sid=${sid}`)
    }
  })
})

// ===========================================================================
// 6. the no-JS shape
// ===========================================================================

test('89.6: a no-JS POST (multipart with a well-formed $ACTION_ID_, no next-action) to /account/delete with a same Origin passes through with the header', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    for (const sid of [false, true]) {
      const request = noJsRequest({ sid })
      assert.equal(request.headers.get('next-action'), null, 'fixture: no next-action header')
      const response = await middleware(request)
      assertPassedThrough(response, `no-JS delete, sid=${sid}`)
      assertWipes(response, `no-JS delete, sid=${sid}`)
    }
  })
})

test('89.6: a no-JS POST with a bound-action $ACTION_REF_ pair and a same Origin passes through with the header', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    const form = new FormData()
    form.append('$ACTION_REF_1', '')
    form.append('$ACTION_1:0', JSON.stringify({ id: ACTION_ID, bound: '$@1' }))
    form.append('$ACTION_1:1', '["$undefined"]')
    const request = new NextRequest(DELETE_URL, { method: 'POST', headers: headersFor({ nextAction: null }), body: form })
    const response = await middleware(request)
    assertPassedThrough(response, '$ACTION_REF_ delete')
    assertWipes(response, '$ACTION_REF_ delete')
  })
})

// ===========================================================================
// 7. other paths and the GET never get the header
// ===========================================================================

const OTHER_PATHS = ['/', '/c/x', '/inbox', '/onboarding', '/admin/login']

test('89.7: same-origin POSTs with a well-formed action to other paths pass through with no Clear-Site-Data, with script', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    // The control: the deletion path itself is wiped, so a middleware that
    // never sets the header cannot satisfy the loop below by default.
    assertWipes(await middleware(scriptRequest()), 'control: /account/delete')

    for (const pathname of OTHER_PATHS) {
      for (const sid of [false, true]) {
        const response = await middleware(scriptRequest({ url: `${APP}${pathname}`, sid }))
        assertPassedThrough(response, `POST ${pathname}, sid=${sid}`)
        assertNoWipe(response, `POST ${pathname}, sid=${sid}`)
      }
    }
  })
})

test('89.7: same-origin POSTs with a well-formed action to other paths pass through with no Clear-Site-Data, no-JS shape', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    assertWipes(await middleware(noJsRequest()), 'control: /account/delete')

    for (const pathname of OTHER_PATHS) {
      const response = await middleware(noJsRequest({ url: `${APP}${pathname}` }))
      assertPassedThrough(response, `no-JS POST ${pathname}`)
      assertNoWipe(response, `no-JS POST ${pathname}`)
    }
  })
})

test('89.7: a GET to /account/delete with a well-formed next-action and a same Origin gets no Clear-Site-Data', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    assertWipes(await middleware(scriptRequest()), 'control: the POST')

    for (const sid of [false, true]) {
      const get = new NextRequest(DELETE_URL, { method: 'GET', headers: headersFor({ nextAction: ACTION_ID, sid }) })
      assert.equal(get.headers.get('origin'), APP, 'fixture: same Origin')
      const response = await middleware(get)
      assertPassedThrough(response, `GET /account/delete, sid=${sid}`)
      assertNoWipe(response, `GET /account/delete, sid=${sid}`)
    }
  })
})

test('89.7: path variants of the deletion page get no header either', async () => {
  const { middleware } = await loadMiddleware()
  await withAppOrigin(APP, async () => {
    assertWipes(await middleware(scriptRequest()), 'control: /account/delete')
    for (const pathname of ['/account/delete/', '/account/DELETE', '/account/delete/x', '/account', '/auth/logout']) {
      const response = await middleware(scriptRequest({ url: `${APP}${pathname}` }))
      assertPassedThrough(response, `POST ${pathname}`)
      assertNoWipe(response, `POST ${pathname}`)
    }
  })
})

// ===========================================================================
// 8. source text
// ===========================================================================

// Every `headers.get(<arg>)` argument in a comment-stripped source.
function headerGetArgs(stripped: string): string[] {
  return [...stripped.matchAll(/headers\s*\.\s*get\s*\(([^)]*)\)/g)].map((m) => m[1]!.trim())
}

test("89.8: src/storage-wipe.ts, comments stripped, contains no `cookies`, no `console.`, and every headers.get( takes the literal 'origin'", () => {
  const stripped = stripComments(readFileSync(STORAGE_WIPE_PATH, 'utf8'))

  assert.ok(!/cookies/.test(stripped), 'src/storage-wipe.ts must not reference cookies in any form')
  assert.ok(!/console\s*\./.test(stripped), 'src/storage-wipe.ts contains a console. call')

  const args = headerGetArgs(stripped)
  assert.ok(args.length >= 1, 'src/storage-wipe.ts must read the Origin with headers.get(')
  for (const arg of args) {
    assert.ok(arg === "'origin'" || arg === '"origin"', `every headers.get( in src/storage-wipe.ts must take the literal 'origin', found: ${arg}`)
  }
  // No wholesale header reads that would sidestep the .get check.
  assert.ok(
    !/headers\s*(?:\.\s*(?:entries|keys|values|forEach)\b|\[\s*Symbol\.iterator)|\.\.\.\s*headers\b|Object\.\w+\(\s*headers\b/.test(stripped),
    'src/storage-wipe.ts must not iterate the headers',
  )
})

test("89.8: middleware.ts imports wipesStorage from './src/storage-wipe.js'", () => {
  const stripped = stripComments(readFileSync(MIDDLEWARE_PATH, 'utf8'))
  assert.ok(
    /import\s*\{[^}]*\bwipesStorage\b[^}]*\}\s*from\s*(['"])\.\/src\/storage-wipe\.js\1/.test(stripped),
    "middleware.ts must import { wipesStorage } from './src/storage-wipe.js'",
  )
  assert.ok(/\bwipesStorage\s*\(/.test(stripped), 'middleware.ts must call wipesStorage')
})

test("89.8: middleware.ts still contains no `cookies` and no headers.get( but 'next-action' (spec §5.1, test/68 §4.10)", () => {
  const stripped = stripComments(readFileSync(MIDDLEWARE_PATH, 'utf8'))
  assert.ok(!/cookies/.test(stripped), 'middleware.ts must not reference cookies in any form')
  const args = headerGetArgs(stripped)
  assert.ok(args.length >= 1, 'middleware.ts must still read next-action with headers.get(')
  for (const arg of args) {
    assert.ok(arg === "'next-action'" || arg === '"next-action"', `every headers.get( in middleware.ts must take 'next-action', found: ${arg}`)
  }
  // The new call is the one this slice adds; without it the two checks above pass on a tree with no change.
  assert.ok(/\bwipesStorage\b/.test(stripped), 'middleware.ts must use wipesStorage')
})
