// test/84-malformed-posts.test.ts
//
// docs/SPEC-week33-malformed-posts.md §4: acceptance for the body gate that
// answers 400 (empty body) to a POST Next's action handler would otherwise
// answer 500, and for the two route handlers that call request.formData()
// without a guard. Written from the spec only (§4's own rule): neither
// src/body-gate.ts, middleware.ts, app/auth/dev/route.ts nor
// app/admin/reveal/route.ts was opened while writing this file.
//
// Every module is loaded with a dynamic import inside each test body, and the
// source-text reads happen inside their own test bodies too, so before the
// implementation exists each test fails on its own with its own message
// instead of one import error taking the whole file down. The specifier for
// src/body-gate.ts goes through a constant, with the shape the spec fixes
// written out as a local type, so `tsc --noEmit` is not broken by a module
// that does not exist yet; the runtime import is still the real module.
//
// The dev-login handler decides on env.allowDevLogin, which src/env.ts caches
// on first read (getEnv). One process cannot observe both states of that flag,
// so each state is probed in its own subprocess, the way test/18 probes the
// admin method guard.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { NextRequest } from 'next/server'
import { hashAdminPassword } from '../src/admin-auth.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BODY_GATE_PATH = path.join(REPO_ROOT, 'src', 'body-gate.ts')
const MIDDLEWARE_PATH = path.join(REPO_ROOT, 'middleware.ts')
const DEV_ROUTE_PATH = path.join(REPO_ROOT, 'app', 'auth', 'dev', 'route.ts')

type BodyGateModule = {
  bodyGate: (request: Request) => Promise<boolean>
  hasWellFormedFormAction: (form: FormData) => boolean
}

const BODY_GATE_SPECIFIER = '../src/body-gate.js'

function loadBodyGate(): Promise<BodyGateModule> {
  return import(BODY_GATE_SPECIFIER) as Promise<BodyGateModule>
}

function loadMiddleware() {
  return import('../middleware.js')
}

// --- comment stripping ------------------------------------------------
//
// Copied from test/68-action-log-gate.test.ts (itself copied from
// test/63-copy-contract.test.ts).
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

// Copied, not imported, from test/14-share-card.test.ts.
const HEADER_READ_INDICATORS =
  /user-agent|x-forwarded|referer|referrer|remoteAddress|req\.ip|request\.ip|ip address|\bheaders\(\)|from 'next\/headers'.*\bheaders\b/i

// --- fixtures ---------------------------------------------------------

const URL_UNDER_TEST = 'https://w33-gate-test.example/'

// A deterministic run of lowercase hex characters (same helper as test/68).
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

const ID_A = hexOfLength(42, '00')
const ID_B = hexOfLength(42, '7f')

function withOneUppercase(hex: string): string {
  const index = [...hex].findIndex((c) => /[a-f]/.test(c))
  assert.ok(index >= 0, 'fixture needs a letter to upper-case')
  return hex.slice(0, index) + hex[index]!.toUpperCase() + hex.slice(index + 1)
}

// The descriptor React writes under `$ACTION_<n>:0` for a bound action.
function descriptor(id: string): string {
  return JSON.stringify({ id, bound: '$@1' })
}

function formOf(entries: Array<[string, string | Blob]>): FormData {
  const form = new FormData()
  for (const [name, value] of entries) form.append(name, value)
  return form
}

// A form holding one valid $ACTION_REF_ pair, as a no-JS bound action posts.
function refPair(n: number, id: string): Array<[string, string]> {
  return [
    [`$ACTION_REF_${n}`, ''],
    [`$ACTION_${n}:0`, descriptor(id)],
    [`$ACTION_${n}:1`, '["$undefined"]'],
  ]
}

type Init = { headers?: Record<string, string>; method?: string }

// A multipart POST whose body is a real, parseable form.
function multipartRequest(entries: Array<[string, string | Blob]>, init: Init = {}): Request {
  return new Request(URL_UNDER_TEST, { method: init.method ?? 'POST', headers: init.headers, body: formOf(entries) })
}

// A POST that claims multipart and carries bytes that are not.
function brokenMultipartRequest(init: Init = {}): Request {
  return new Request(URL_UNDER_TEST, {
    method: init.method ?? 'POST',
    headers: { 'content-type': 'multipart/form-data; boundary=x', ...init.headers },
    body: 'garbage',
  })
}

function textRequest(body: string, contentType: string | null, init: Init = {}): Request {
  // A Uint8Array body carries no implicit content-type, a string body would
  // add text/plain; the null case needs the former.
  const headers: Record<string, string> = { ...init.headers }
  if (contentType !== null) headers['content-type'] = contentType
  return new Request(URL_UNDER_TEST, {
    method: init.method ?? 'POST',
    headers,
    body: contentType === null ? new TextEncoder().encode(body) : body,
  })
}

const FETCH_ACTION = { 'next-action': ID_A }

// ===========================================================================
// §1.1 rule 1: method is not POST -- pass
// ===========================================================================

test('§1.1 rule 1: a GET passes, even carrying a multipart content-type and a next-action header', async () => {
  const { bodyGate } = await loadBodyGate()
  const request = new Request(URL_UNDER_TEST, {
    method: 'GET',
    headers: { 'content-type': 'multipart/form-data; boundary=x', ...FETCH_ACTION },
  })
  assert.equal(await bodyGate(request), true)
})

test('§1.1 rule 1: PUT, PATCH and DELETE with a broken multipart body pass', async () => {
  const { bodyGate } = await loadBodyGate()
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    assert.equal(await bodyGate(brokenMultipartRequest({ method })), true, `${method} with broken multipart must pass`)
    assert.equal(
      await bodyGate(brokenMultipartRequest({ method, headers: FETCH_ACTION })),
      true,
      `${method} with broken multipart and next-action must pass`,
    )
    assert.equal(
      await bodyGate(textRequest('{{{', 'text/plain', { method, headers: FETCH_ACTION })),
      true,
      `${method} with a non-JSON body and next-action must pass`,
    )
  }
})

// ===========================================================================
// §1.1 rule 2: the content-type is compared as is, case sensitive
// ===========================================================================

test('§1.1 rule 2: a differently-cased multipart content-type is not multipart, so a junk body without next-action passes', async () => {
  const { bodyGate } = await loadBodyGate()
  for (const ct of ['Multipart/Form-Data; boundary=x', 'MULTIPART/FORM-DATA; boundary=x']) {
    assert.equal(await bodyGate(textRequest('garbage', ct)), true, `content-type ${ct} is not an action to Next`)
  }
})

test('§1.1 rule 2: a differently-cased multipart content-type with next-action is judged as a JSON reply', async () => {
  const { bodyGate } = await loadBodyGate()
  const ct = 'Multipart/Form-Data; boundary=x'
  assert.equal(await bodyGate(textRequest('garbage', ct, { headers: FETCH_ACTION })), false)
  assert.equal(await bodyGate(textRequest('["$K1"]', ct, { headers: FETCH_ACTION })), true)
})

test('§1.1 rule 2: an absent content-type is treated as not multipart', async () => {
  const { bodyGate } = await loadBodyGate()
  const noType = new Request(URL_UNDER_TEST, { method: 'POST' })
  assert.equal(noType.headers.get('content-type'), null, 'fixture: the request really has no content-type')
  assert.equal(await bodyGate(noType), true, 'no content-type and no next-action: rule 5, pass')
  assert.equal(await bodyGate(textRequest('{{{', null)), true, 'bytes with no content-type and no next-action: pass')
  assert.equal(await bodyGate(textRequest('{{{', null, { headers: FETCH_ACTION })), false, 'no content-type, next-action, not JSON: reject')
  assert.equal(await bodyGate(textRequest('{}', null, { headers: FETCH_ACTION })), true, 'no content-type, next-action, JSON: pass')
})

// ===========================================================================
// §1.1 rule 3: multipart
// ===========================================================================

test('§1.1 rule 3: a multipart body that does not parse is rejected, with and without next-action', async () => {
  const { bodyGate } = await loadBodyGate()
  assert.equal(await bodyGate(brokenMultipartRequest()), false, 'spec §0 row 1')
  assert.equal(await bodyGate(brokenMultipartRequest({ headers: FETCH_ACTION })), false, 'spec §0 row 3')
})

test('§1.1 rule 3: a multipart content-type with no boundary and a body is rejected', async () => {
  const { bodyGate } = await loadBodyGate()
  const request = new Request(URL_UNDER_TEST, {
    method: 'POST',
    headers: { 'content-type': 'multipart/form-data' },
    body: 'garbage',
  })
  assert.equal(await bodyGate(request), false)
})

test('§1.1 rule 3: a multipart content-type with a prefix match only (multipart/form-data-x) is still judged as multipart', async () => {
  const { bodyGate } = await loadBodyGate()
  // Next's own test is startsWith('multipart/form-data'); the gate must agree.
  const request = new Request(URL_UNDER_TEST, {
    method: 'POST',
    headers: { 'content-type': 'multipart/form-data-x; boundary=x' },
    body: 'garbage',
  })
  assert.equal(await bodyGate(request), false)
})

test('§1.1 rule 3: with next-action and a body that parses, the fields are not inspected -- pass', async () => {
  const { bodyGate } = await loadBodyGate()
  assert.equal(await bodyGate(multipartRequest([['1_x', 'anything']], { headers: FETCH_ACTION })), true)
  assert.equal(await bodyGate(multipartRequest([], { headers: FETCH_ACTION })), true, 'an empty form parses')
  assert.equal(
    await bodyGate(multipartRequest([['$ACTION_ID_zzz', '']], { headers: FETCH_ACTION })),
    true,
    'a malformed $ACTION_ID_ is only judged when there is no next-action header',
  )
})

test('§1.1 rule 3: without next-action, a form with a well-formed $ACTION_ID_ passes', async () => {
  const { bodyGate } = await loadBodyGate()
  assert.equal(await bodyGate(multipartRequest([[`$ACTION_ID_${ID_A}`, ''], ['text', 'hello']])), true)
  assert.equal(await bodyGate(multipartRequest([[`$ACTION_ID_${ID_B}`, '']])), true)
})

test('§1.1 rule 3: without next-action, a form with a valid $ACTION_REF_ pair passes', async () => {
  const { bodyGate } = await loadBodyGate()
  assert.equal(await bodyGate(multipartRequest(refPair(1, ID_A))), true)
})

test('§1.1 rule 3: without next-action, a well-formed form with no $ACTION_ field is rejected (spec §0 row 2)', async () => {
  const { bodyGate } = await loadBodyGate()
  assert.equal(await bodyGate(multipartRequest([['text', 'hello']])), false)
  assert.equal(await bodyGate(multipartRequest([])), false, 'an empty form')
})

test('§1.1 rule 3: without next-action, $ACTION_ID_zzz is rejected (spec §0 row 2)', async () => {
  const { bodyGate } = await loadBodyGate()
  assert.equal(await bodyGate(multipartRequest([['$ACTION_ID_zzz', '']])), false)
})

test('§1.1 rule 3: without next-action, three $ACTION_REF_ keys are rejected even when each is valid', async () => {
  const { bodyGate } = await loadBodyGate()
  const three = [...refPair(1, ID_A), ...refPair(2, ID_B), ...refPair(3, ID_A)]
  assert.equal(await bodyGate(multipartRequest(three)), false)
})

test('§1.1 rule 3: without next-action, a $ACTION_REF_ without its :0 field is rejected', async () => {
  const { bodyGate } = await loadBodyGate()
  assert.equal(await bodyGate(multipartRequest([['$ACTION_REF_1', '']])), false)
})

test('§1.1 rule 3: without next-action, a descriptor with a 41-character id is rejected', async () => {
  const { bodyGate } = await loadBodyGate()
  const short = hexOfLength(41, '00')
  assert.equal(await bodyGate(multipartRequest([['$ACTION_REF_1', ''], ['$ACTION_1:0', descriptor(short)]])), false)
})

test('§1.1 rule 3: without next-action, a descriptor with uppercase hex in the id is rejected', async () => {
  const { bodyGate } = await loadBodyGate()
  const upper = withOneUppercase(ID_A)
  assert.equal(upper.length, 42)
  assert.equal(await bodyGate(multipartRequest([['$ACTION_REF_1', ''], ['$ACTION_1:0', descriptor(upper)]])), false)
})

// ===========================================================================
// §1.1 rule 4: next-action with a body that is not multipart
// ===========================================================================

test('§1.1 rule 4: next-action with an empty body is rejected (spec §0 row 5)', async () => {
  const { bodyGate } = await loadBodyGate()
  assert.equal(await bodyGate(new Request(URL_UNDER_TEST, { method: 'POST', headers: FETCH_ACTION })), false, 'no body at all')
  assert.equal(await bodyGate(textRequest('', 'text/plain', { headers: FETCH_ACTION })), false, 'an empty text body')
  assert.equal(await bodyGate(textRequest('', 'application/json', { headers: FETCH_ACTION })), false, 'an empty json body')
})

test('§1.1 rule 4: next-action with a body that is not JSON is rejected (spec §0 row 4)', async () => {
  const { bodyGate } = await loadBodyGate()
  assert.equal(await bodyGate(textRequest('{{{', 'text/plain', { headers: FETCH_ACTION })), false)
  assert.equal(await bodyGate(textRequest('garbage', 'application/json', { headers: FETCH_ACTION })), false)
  assert.equal(await bodyGate(textRequest('a=b&c=d', 'application/x-www-form-urlencoded', { headers: FETCH_ACTION })), false)
  assert.equal(await bodyGate(textRequest('["a",', 'text/plain;charset=UTF-8', { headers: FETCH_ACTION })), false, 'truncated JSON')
})

test('§1.1 rule 4: next-action with a body that is valid JSON passes, whatever its shape', async () => {
  const { bodyGate } = await loadBodyGate()
  for (const body of ['[]', '{}', '["$K1"]', '"x"', '0', 'null', 'true', '[{"a":1},"b"]']) {
    assert.equal(
      await bodyGate(textRequest(body, 'text/plain;charset=UTF-8', { headers: FETCH_ACTION })),
      true,
      `valid JSON ${body} must pass`,
    )
  }
  assert.equal(await bodyGate(textRequest('["$K1"]', 'application/json', { headers: FETCH_ACTION })), true)
})

// ===========================================================================
// §1.1 rule 5: anything else passes
// ===========================================================================

test('§1.1 rule 5: a POST without next-action and without a multipart content-type passes, whatever the body', async () => {
  const { bodyGate } = await loadBodyGate()
  assert.equal(await bodyGate(new Request(URL_UNDER_TEST, { method: 'POST' })), true, 'bodiless')
  assert.equal(await bodyGate(textRequest('a=b&c=d', 'application/x-www-form-urlencoded')), true, 'urlencoded')
  assert.equal(await bodyGate(textRequest('{{{', 'text/plain')), true, 'text')
  assert.equal(await bodyGate(textRequest('garbage', 'application/json')), true, 'json content-type with junk')
})

// ===========================================================================
// hasWellFormedFormAction (§1.1)
// ===========================================================================

test('hasWellFormedFormAction: no keys, or no $ACTION_ key, is false (no action counted)', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  assert.equal(hasWellFormedFormAction(new FormData()), false)
  assert.equal(hasWellFormedFormAction(formOf([['text', 'hello'], ['1_a', 'b']])), false)
})

test('hasWellFormedFormAction: a $ACTION_ID_ with 42 lowercase hex is true, other keys are ignored', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  assert.equal(hasWellFormedFormAction(formOf([[`$ACTION_ID_${ID_A}`, '']])), true)
  assert.equal(hasWellFormedFormAction(formOf([[`$ACTION_ID_${ID_B}`, '']])), true)
  assert.equal(
    hasWellFormedFormAction(formOf([['text', 'hello'], [`$ACTION_ID_${ID_A}`, ''], ['more', 'x']])),
    true,
  )
})

test('hasWellFormedFormAction: a $ACTION_ID_ whose rest is not 42 lowercase hex is false', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  const cases: Record<string, string> = {
    empty: '',
    zzz: 'zzz',
    hex40: hexOfLength(40, '00'),
    hex41: hexOfLength(41, '00'),
    hex43: hexOfLength(43, '00'),
    oneUppercase: withOneUppercase(ID_A),
    oneG: 'g' + ID_A.slice(1),
    trailingNewline: ID_A + '\n',
    leadingSpace: ' ' + ID_A,
  }
  for (const [label, rest] of Object.entries(cases)) {
    assert.equal(
      hasWellFormedFormAction(formOf([[`$ACTION_ID_${rest}`, '']])),
      false,
      `expected $ACTION_ID_ with rest "${label}" to be rejected`,
    )
  }
})

test('hasWellFormedFormAction: one bad $ACTION_ID_ spoils the form even beside a good one', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  assert.equal(hasWellFormedFormAction(formOf([[`$ACTION_ID_${ID_A}`, ''], ['$ACTION_ID_zzz', '']])), false)
  assert.equal(hasWellFormedFormAction(formOf([['$ACTION_ID_zzz', ''], [`$ACTION_ID_${ID_A}`, '']])), false)
})

test('hasWellFormedFormAction: a valid $ACTION_REF_ pair is true', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  assert.equal(hasWellFormedFormAction(formOf(refPair(1, ID_A))), true)
  assert.equal(hasWellFormedFormAction(formOf(refPair(7, ID_B))), true, 'the number is not fixed to 1')
  assert.equal(
    hasWellFormedFormAction(formOf([['$ACTION_REF_1', ''], ['$ACTION_1:0', descriptor(ID_A)]])),
    true,
    'the :1 field is not required by the shape check',
  )
})

test('hasWellFormedFormAction: two refs are allowed, three are not', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  assert.equal(hasWellFormedFormAction(formOf([...refPair(1, ID_A), ...refPair(2, ID_B)])), true)
  assert.equal(hasWellFormedFormAction(formOf([...refPair(1, ID_A), ...refPair(2, ID_B), ...refPair(3, ID_A)])), false)
})

test('hasWellFormedFormAction: a ref without its :0 field is false', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  assert.equal(hasWellFormedFormAction(formOf([['$ACTION_REF_1', '']])), false)
  assert.equal(
    hasWellFormedFormAction(formOf([['$ACTION_REF_1', ''], ['$ACTION_2:0', descriptor(ID_A)]])),
    false,
    'a :0 field under another number does not count',
  )
  assert.equal(
    hasWellFormedFormAction(formOf([...refPair(1, ID_A), ['$ACTION_REF_2', '']])),
    false,
    'a second ref with no :0 spoils the form',
  )
})

test('hasWellFormedFormAction: the :0 field must hold exactly one value', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  assert.equal(
    hasWellFormedFormAction(formOf([['$ACTION_REF_1', ''], ['$ACTION_1:0', descriptor(ID_A)], ['$ACTION_1:0', descriptor(ID_A)]])),
    false,
    'two values under one :0 key',
  )
})

test('hasWellFormedFormAction: the :0 value must be a string, not a file', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  const file = new File([descriptor(ID_A)], 'descriptor.json', { type: 'application/json' })
  assert.equal(hasWellFormedFormAction(formOf([['$ACTION_REF_1', ''], ['$ACTION_1:0', file]])), false)
})

test('hasWellFormedFormAction: the :0 value must start {"id":" exactly', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  const reordered = `{"bound":"$@1","id":"${ID_A}"}`
  const spaced = `{ "id":"${ID_A}","bound":"$@1"}`
  const prefixed = ` {"id":"${ID_A}","bound":"$@1"}`
  for (const [label, value] of Object.entries({ reordered, spaced, prefixed, empty: '', plain: ID_A })) {
    assert.equal(
      hasWellFormedFormAction(formOf([['$ACTION_REF_1', ''], ['$ACTION_1:0', value]])),
      false,
      `descriptor "${label}" must be rejected`,
    )
  }
})

test('hasWellFormedFormAction: a descriptor id of 41 characters, 43 characters or uppercase hex is false', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  for (const [label, id] of Object.entries({
    hex41: hexOfLength(41, '00'),
    hex43: hexOfLength(43, '00'),
    hex40: hexOfLength(40, '00'),
    uppercase: withOneUppercase(ID_A),
    empty: '',
    junk: 'zzz',
  })) {
    assert.equal(
      hasWellFormedFormAction(formOf([['$ACTION_REF_1', ''], ['$ACTION_1:0', descriptor(id)]])),
      false,
      `descriptor id "${label}" must be rejected`,
    )
  }
})

test('hasWellFormedFormAction: a descriptor whose id is correct only up to the next quote is read to that quote', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  // 42 hex then a quote is the whole id; 42 hex followed by more id text
  // before the quote is a 43-or-longer id.
  const longer = `{"id":"${ID_A}f","bound":"$@1"}`
  assert.equal(hasWellFormedFormAction(formOf([['$ACTION_REF_1', ''], ['$ACTION_1:0', longer]])), false)
})

test('hasWellFormedFormAction: a descriptor with no closing quote is false (spec §5)', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  assert.equal(hasWellFormedFormAction(formOf([['$ACTION_REF_1', ''], ['$ACTION_1:0', `{"id":"${ID_A}`]])), false, '42 hex, then the string ends')
  assert.equal(hasWellFormedFormAction(formOf([['$ACTION_REF_1', ''], ['$ACTION_1:0', '{"id":"']])), false, 'nothing after the opening')
  // The control: the same id with its closing quote is accepted.
  assert.equal(hasWellFormedFormAction(formOf([['$ACTION_REF_1', ''], ['$ACTION_1:0', `{"id":"${ID_A}"}`]])), true)
})

test('hasWellFormedFormAction: repeated $ACTION_REF_ keys count once per occurrence (spec §5)', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  const ref = (): [string, string] => ['$ACTION_REF_1', '']
  const zero: [string, string] = ['$ACTION_1:0', descriptor(ID_A)]

  assert.equal(hasWellFormedFormAction(formOf([ref(), zero])), true, 'one occurrence')
  assert.equal(hasWellFormedFormAction(formOf([ref(), ref(), zero])), true, 'the same key twice is two refs, which is allowed')
  assert.equal(hasWellFormedFormAction(formOf([ref(), ref(), ref(), zero])), false, 'the same key three times is three refs')
  assert.equal(
    hasWellFormedFormAction(formOf([ref(), ref(), ref(), ref(), zero])),
    false,
    'and four is still too many',
  )
})

test('hasWellFormedFormAction: other $ACTION_ keys are ignored -- alone they count for nothing', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  assert.equal(hasWellFormedFormAction(formOf([['$ACTION_1:0', descriptor(ID_A)]])), false, ':0 with no REF')
  assert.equal(hasWellFormedFormAction(formOf([['$ACTION_KEY', 'x']])), false)
  assert.equal(hasWellFormedFormAction(formOf([['$ACTION_', ''], ['$ACTION_1:1', '[]']])), false)
})

test('hasWellFormedFormAction: other $ACTION_ keys beside a good action do not spoil it', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  assert.equal(
    hasWellFormedFormAction(formOf([[`$ACTION_ID_${ID_A}`, ''], ['$ACTION_KEY', 'junk'], ['$ACTION_9:0', 'not json']])),
    true,
  )
  assert.equal(hasWellFormedFormAction(formOf([...refPair(1, ID_A), ['$ACTION_KEY', 'junk']])), true)
})

test('hasWellFormedFormAction: the $ACTION_ prefix is case sensitive', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  assert.equal(hasWellFormedFormAction(formOf([[`$action_id_${ID_A}`, '']])), false, 'lower-case prefix is not an action')
  assert.equal(
    hasWellFormedFormAction(formOf([[`$ACTION_ID_${ID_A}`, ''], ['$action_id_zzz', '']])),
    true,
    'and a lower-case junk key is ignored, not judged',
  )
})

test('hasWellFormedFormAction: an id and a ref together, both valid, is true; a valid id with a broken ref is false', async () => {
  const { hasWellFormedFormAction } = await loadBodyGate()
  assert.equal(hasWellFormedFormAction(formOf([[`$ACTION_ID_${ID_A}`, ''], ...refPair(1, ID_B)])), true)
  assert.equal(hasWellFormedFormAction(formOf([[`$ACTION_ID_${ID_A}`, ''], ['$ACTION_REF_1', '']])), false)
})

// ===========================================================================
// §1.2 middleware
// ===========================================================================

function nextRequest(body: BodyInit | null, headers: Record<string, string>, method = 'POST'): NextRequest {
  return new NextRequest(URL_UNDER_TEST, { method, headers, body })
}

function nextMultipart(entries: Array<[string, string | Blob]>, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(URL_UNDER_TEST, { method: 'POST', headers, body: formOf(entries) })
}

async function assertRejected400(response: Response, label: string) {
  assert.ok(response, `${label}: middleware must return a response`)
  assert.equal(response.status, 400, `${label}: status`)
  assert.equal(await response.text(), '', `${label}: the body must be empty`)
  assert.equal(response.headers.get('set-cookie'), null, `${label}: no set-cookie`)
  assert.notEqual(response.headers.get('x-middleware-next'), '1', `${label}: must not be a pass-through`)
}

function assertPassedThrough(response: Response, label: string) {
  assert.ok(response, `${label}: middleware must return a response`)
  assert.notEqual(response.status, 400, `${label}: status`)
  assert.notEqual(response.status, 404, `${label}: status`)
  assert.equal(response.headers.get('x-middleware-next'), '1', `${label}: a pass-through NextResponse.next() sets x-middleware-next`)
}

test('§1.2 middleware(): a POST with a broken multipart body and no next-action answers 400, empty body, no set-cookie', async () => {
  const { middleware } = await loadMiddleware()
  const request = nextRequest('garbage', { 'content-type': 'multipart/form-data; boundary=x' })
  await assertRejected400(await middleware(request), 'broken multipart')
})

test('§1.2 middleware(): a well-formed multipart POST with no $ACTION_ field answers 400, empty body, no set-cookie', async () => {
  const { middleware } = await loadMiddleware()
  await assertRejected400(await middleware(nextMultipart([['text', 'hello']])), 'multipart without action')
  await assertRejected400(await middleware(nextMultipart([['$ACTION_ID_zzz', '']])), 'multipart with $ACTION_ID_zzz')
})

test('§1.2 middleware(): a fetch action with a broken multipart body answers 400', async () => {
  const { middleware } = await loadMiddleware()
  const request = nextRequest('garbage', { 'content-type': 'multipart/form-data; boundary=x', ...FETCH_ACTION })
  await assertRejected400(await middleware(request), 'fetch action, broken multipart')
})

test('§1.2 middleware(): a fetch action with a non-JSON or empty body answers 400', async () => {
  const { middleware } = await loadMiddleware()
  await assertRejected400(
    await middleware(nextRequest('{{{', { 'content-type': 'text/plain', ...FETCH_ACTION })),
    'fetch action, text body',
  )
  await assertRejected400(await middleware(nextRequest(null, { ...FETCH_ACTION })), 'fetch action, no body')
  await assertRejected400(
    await middleware(nextRequest('', { 'content-type': 'text/plain', ...FETCH_ACTION })),
    'fetch action, empty text body',
  )
})

test('§1.2 middleware(): a fetch action with a JSON body passes through', async () => {
  const { middleware } = await loadMiddleware()
  assertPassedThrough(
    await middleware(nextRequest('["$K1"]', { 'content-type': 'text/plain;charset=UTF-8', ...FETCH_ACTION })),
    'fetch action, JSON body',
  )
})

test('§1.2 middleware(): a fetch action with a parseable multipart body passes through', async () => {
  const { middleware } = await loadMiddleware()
  assertPassedThrough(await middleware(nextMultipart([['1_text', 'hello']], FETCH_ACTION)), 'fetch action, multipart')
})

test('§1.2 middleware(): a no-JS form with a well-formed $ACTION_ID_ passes through', async () => {
  const { middleware } = await loadMiddleware()
  assertPassedThrough(await middleware(nextMultipart([[`$ACTION_ID_${ID_A}`, ''], ['text', 'hello']])), '$ACTION_ID_ form')
})

test('§1.2 middleware(): a no-JS form with a valid $ACTION_REF_ pair passes through; three refs answer 400', async () => {
  const { middleware } = await loadMiddleware()
  assertPassedThrough(await middleware(nextMultipart(refPair(1, ID_A))), 'one ref')
  await assertRejected400(
    await middleware(nextMultipart([...refPair(1, ID_A), ...refPair(2, ID_B), ...refPair(3, ID_A)])),
    'three refs',
  )
})

test('§1.2 middleware(): a plain POST, a urlencoded POST and a GET pass through', async () => {
  const { middleware } = await loadMiddleware()
  assertPassedThrough(await middleware(nextRequest(null, {})), 'bodiless POST')
  assertPassedThrough(
    await middleware(nextRequest('a=b', { 'content-type': 'application/x-www-form-urlencoded' })),
    'urlencoded POST',
  )
  assertPassedThrough(await middleware(nextRequest(null, {}, 'GET')), 'GET')
  assertPassedThrough(
    await middleware(nextRequest(null, { 'content-type': 'multipart/form-data; boundary=x' }, 'GET')),
    'GET with a multipart content-type',
  )
})

test('§1.2 the week 18 id check stays first: a malformed next-action answers 404, not 400, whatever the body', async () => {
  const { middleware } = await loadMiddleware()
  const bad = { 'next-action': 'canary-7f3a9' }

  const brokenMultipart = await middleware(nextRequest('garbage', { 'content-type': 'multipart/form-data; boundary=x', ...bad }))
  assert.equal(brokenMultipart.status, 404)
  assert.equal(await brokenMultipart.text(), '')
  assert.equal(brokenMultipart.headers.get('set-cookie'), null)

  const notJson = await middleware(nextRequest('{{{', { 'content-type': 'text/plain', ...bad }))
  assert.equal(notJson.status, 404)
  assert.equal(await notJson.text(), '')

  const emptyBody = await middleware(nextRequest(null, bad))
  assert.equal(emptyBody.status, 404)
})

test('§1.2 an empty next-action value answers 404 before the body gate runs (spec §5)', async () => {
  const { middleware } = await loadMiddleware()
  const empty = { 'next-action': '' }
  assert.equal(new Headers(empty).get('next-action'), '', 'fixture: the header is present with an empty value')

  const cases: Array<[string, NextRequest]> = [
    ['broken multipart', nextRequest('garbage', { 'content-type': 'multipart/form-data; boundary=x', ...empty })],
    ['non-JSON text', nextRequest('{{{', { 'content-type': 'text/plain', ...empty })],
    ['empty body', nextRequest(null, empty)],
    // A body the gate would let through: only the id check can answer these.
    ['JSON body', nextRequest('[]', { 'content-type': 'text/plain;charset=UTF-8', ...empty })],
    ['parseable multipart', nextMultipart([[`$ACTION_ID_${ID_A}`, '']], empty)],
    ['GET', nextRequest(null, empty, 'GET')],
  ]
  for (const [label, request] of cases) {
    const response = await middleware(request)
    assert.equal(response.status, 404, `${label}: status`)
    assert.equal(await response.text(), '', `${label}: empty body`)
    assert.equal(response.headers.get('set-cookie'), null, `${label}: no set-cookie`)
  }
})

test('§1.2 the 400 never echoes request content, in body or in any header', async () => {
  const { middleware } = await loadMiddleware()
  const canary = 'canary-w33-7f3a9'
  const response = await middleware(
    nextRequest(`{{{${canary}`, { 'content-type': 'text/plain', 'next-action': ID_A, 'x-canary': canary }),
  )
  assert.equal(response.status, 400)
  assert.ok(!(await response.text()).includes(canary))
  for (const [key, value] of response.headers.entries()) {
    assert.ok(!value.includes(canary), `header "${key}" echoes request content: ${value}`)
  }
})

// ---------------------------------------------------------------------------
// The body Next would read is still readable after the gate ran
// ---------------------------------------------------------------------------

test('§1.2 bodyGate leaves a JSON body readable on the original request, passing or rejecting', async () => {
  const { bodyGate } = await loadBodyGate()

  const good = textRequest('["$K1","a"]', 'text/plain;charset=UTF-8', { headers: FETCH_ACTION })
  assert.equal(await bodyGate(good), true)
  assert.equal(good.bodyUsed, false, 'the gate must read through a clone')
  assert.equal(await good.text(), '["$K1","a"]')

  const bad = textRequest('{{{', 'text/plain', { headers: FETCH_ACTION })
  assert.equal(await bodyGate(bad), false)
  assert.equal(bad.bodyUsed, false)
  assert.equal(await bad.text(), '{{{')
})

test('§1.2 bodyGate leaves a multipart body readable on the original request, passing or rejecting', async () => {
  const { bodyGate } = await loadBodyGate()

  const good = multipartRequest([[`$ACTION_ID_${ID_A}`, ''], ['text', 'مرحبا hello']])
  assert.equal(await bodyGate(good), true)
  assert.equal(good.bodyUsed, false, 'the gate must read through a clone')
  const form = await good.formData()
  assert.equal(form.get('text'), 'مرحبا hello')
  assert.equal(form.get(`$ACTION_ID_${ID_A}`), '')

  const bad = brokenMultipartRequest()
  assert.equal(await bodyGate(bad), false)
  assert.equal(bad.bodyUsed, false)
  assert.equal(await bad.text(), 'garbage')

  const noAction = multipartRequest([['text', 'hello']])
  assert.equal(await bodyGate(noAction), false)
  assert.equal(noAction.bodyUsed, false)
  assert.equal((await noAction.formData()).get('text'), 'hello')
})

test('§1.2 bodyGate does not consume the body even when it is asked twice', async () => {
  const { bodyGate } = await loadBodyGate()
  const request = multipartRequest([[`$ACTION_ID_${ID_A}`, ''], ['text', 'hello']])
  assert.equal(await bodyGate(request), true)
  assert.equal(await bodyGate(request), true)
  assert.equal((await request.formData()).get('text'), 'hello')
})

test('§1.2 middleware() leaves the request body readable, passing or rejecting', async () => {
  const { middleware } = await loadMiddleware()

  const multipart = nextMultipart([[`$ACTION_ID_${ID_A}`, ''], ['text', 'مرحبا hello']])
  assertPassedThrough(await middleware(multipart), 'multipart pass')
  assert.equal(multipart.bodyUsed, false, 'middleware must not consume the multipart body')
  assert.equal((await multipart.formData()).get('text'), 'مرحبا hello')

  const json = nextRequest('["$K1","a"]', { 'content-type': 'text/plain;charset=UTF-8', ...FETCH_ACTION })
  assertPassedThrough(await middleware(json), 'json pass')
  assert.equal(json.bodyUsed, false, 'middleware must not consume the JSON body')
  assert.equal(await json.text(), '["$K1","a"]')

  const rejected = nextRequest('garbage', { 'content-type': 'multipart/form-data; boundary=x' })
  await assertRejected400(await middleware(rejected), 'multipart reject')
  assert.equal(rejected.bodyUsed, false)
  assert.equal(await rejected.text(), 'garbage')
})

// ---------------------------------------------------------------------------
// config.matcher: exactly two entries (supersedes week 18 §2's single entry)
// ---------------------------------------------------------------------------

test('§1.2 config.matcher is exactly two entries: the next-action entry, then the multipart content-type entry', async () => {
  const { config } = await loadMiddleware()
  const matcher = config.matcher as unknown

  assert.ok(Array.isArray(matcher), 'config.matcher must be an array')
  assert.equal(matcher.length, 2, 'config.matcher must hold exactly two entries')
  assert.deepEqual(matcher[0], { source: '/:path*', has: [{ type: 'header', key: 'next-action' }] })
  assert.deepEqual(matcher[1], {
    source: '/:path*',
    has: [{ type: 'header', key: 'content-type', value: 'multipart/form-data.*' }],
  })
})

// ---------------------------------------------------------------------------
// No logging, no header or cookie reads beyond the spec
// ---------------------------------------------------------------------------

test('§1.2 middleware.ts and src/body-gate.ts contain no console or process.stdout/stderr calls, comments stripped', () => {
  for (const filePath of [MIDDLEWARE_PATH, BODY_GATE_PATH]) {
    const relative = path.relative(REPO_ROOT, filePath)
    const stripped = stripComments(readFileSync(filePath, 'utf8'))

    assert.ok(!/console\s*\./.test(stripped), `${relative} contains a console. call`)
    assert.ok(!/process\s*\.\s*stdout/.test(stripped), `${relative} contains process.stdout`)
    assert.ok(!/process\s*\.\s*stderr/.test(stripped), `${relative} contains process.stderr`)
  }
})

test('§1.2 src/body-gate.ts reads no cookie and no header the week 6 tripwire names, comments stripped', () => {
  const stripped = stripComments(readFileSync(BODY_GATE_PATH, 'utf8'))
  assert.ok(!/cookies/.test(stripped), 'src/body-gate.ts must not reference cookies in any form')

  const matches = stripped
    .split(/\r?\n/)
    .map((text, i) => ({ line: i + 1, text: text.trim() }))
    .filter(({ text }) => HEADER_READ_INDICATORS.test(text))
  assert.deepEqual(matches, [], `header-read indicators matched in src/body-gate.ts: ${JSON.stringify(matches)}`)
})

// ===========================================================================
// §1.3 the dev-login handler
// ===========================================================================
//
// Each probe runs the handler in a fresh process with the env it is given, so
// both states of ALLOW_DEV_LOGIN are observed for real. The probe reports the
// status, the body, whether a cookie was set, which body readers were called
// on the request, and whether the body was consumed. Only inputs that stop
// before any database work are used: a body that parses as a form would go on
// to create an account, and that path is not this slice's to test.

type DevScenario = {
  contentType: string | null
  body: string | null
}

type DevProbeResult = {
  status: number | null
  report: {
    threw?: string
    status?: number
    text?: string
    setCookie?: string | null
    calls?: string[]
    bodyUsed?: boolean
  } | null
  stderr: string
}

function runDevLoginProbe(devLoginOn: boolean, scenario: DevScenario): DevProbeResult {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'w33-dev-probe-'))
  try {
    const probe = path.join(dir, 'probe.mts')
    writeFileSync(
      probe,
      [
        // The probe lives in a temp dir, outside the repo's node_modules
        // lookup, so next/server is reached by file URL.
        `const nextServer: any = await import(${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, 'node_modules', 'next', 'server.js')).href)})`,
        'const NextRequest = nextServer.NextRequest ?? nextServer.default.NextRequest',
        `const mod = await import(${JSON.stringify(pathToFileURL(DEV_ROUTE_PATH).href)})`,
        "const scenario = JSON.parse(process.env.W33_SCENARIO ?? '{}')",
        "const headers: Record<string, string> = {}",
        "if (scenario.contentType !== null) headers['content-type'] = scenario.contentType",
        "const request = new NextRequest('http://localhost:3000/auth/dev', {",
        "  method: 'POST',",
        '  headers,',
        '  body: scenario.body === null ? null : scenario.body,',
        '})',
        'const calls: string[] = []',
        "for (const name of ['formData', 'text', 'json', 'arrayBuffer', 'blob', 'bytes']) {",
        '  const original = (request as any)[name]',
        '  if (typeof original !== "function") continue',
        '  ;(request as any)[name] = (...args: unknown[]) => { calls.push(name); return original.apply(request, args) }',
        '}',
        'let report',
        'try {',
        '  const response = await mod.POST(request)',
        '  report = {',
        '    status: response.status,',
        '    text: await response.text(),',
        "    setCookie: response.headers.get('set-cookie'),",
        '    calls,',
        '    bodyUsed: request.bodyUsed,',
        '  }',
        '} catch (error) {',
        '  report = { threw: String(error), calls, bodyUsed: request.bodyUsed }',
        '}',
        "console.log('W33_REPORT ' + JSON.stringify(report))",
        'process.exit(0)',
      ].join('\n'),
    )
    const result = spawnSync('node', ['--import', 'tsx', probe], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      timeout: 90_000,
      // An explicit env, not a copy of this process's: nothing inherited can
      // switch dev login on or off behind the probe's back.
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://user:pass@localhost:1/confession',
        SESSION_SECRET: 'd'.repeat(32),
        APP_ORIGIN: 'http://localhost:3000',
        ALLOW_DEV_LOGIN: devLoginOn ? '1' : '',
        W33_SCENARIO: JSON.stringify(scenario),
      },
    })
    const line = (result.stdout ?? '').split('\n').find((l) => l.startsWith('W33_REPORT '))
    return {
      status: result.status,
      report: line ? JSON.parse(line.slice('W33_REPORT '.length)) : null,
      stderr: result.stderr ?? '',
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function assertDevProbeRan(result: DevProbeResult) {
  assert.equal(result.status, 0, `the probe process must run cleanly; stderr:\n${result.stderr}`)
  assert.ok(result.report, `the probe must report; stderr:\n${result.stderr}`)
  assert.equal(result.report.threw, undefined, `POST /auth/dev must answer, not throw: ${result.report.threw}`)
}

const DEV_ON_400_CASES: Array<[string, DevScenario]> = [
  ['a bodiless POST (spec §0 row 6)', { contentType: null, body: null }],
  ['a text/plain body', { contentType: 'text/plain', body: 'hello' }],
  ['a JSON body', { contentType: 'application/json', body: '{"a":1}' }],
  ['a broken multipart body', { contentType: 'multipart/form-data; boundary=x', body: 'garbage' }],
  ['a multipart content-type with no boundary', { contentType: 'multipart/form-data', body: 'garbage' }],
]

for (const [label, scenario] of DEV_ON_400_CASES) {
  test(`§1.3 /auth/dev with dev login on answers 400 "bad request" to ${label}`, () => {
    const result = runDevLoginProbe(true, scenario)
    assertDevProbeRan(result)
    assert.equal(result.report!.status, 400)
    assert.equal(result.report!.text, 'bad request')
    assert.equal(result.report!.setCookie, null, 'a rejected login sets no cookie')
  })
}

test('§1.3 /auth/dev with dev login off answers 404 to a bodiless POST', () => {
  const result = runDevLoginProbe(false, { contentType: null, body: null })
  assertDevProbeRan(result)
  assert.equal(result.report!.status, 404)
  assert.equal(result.report!.setCookie, null)
})

test('§1.3 /auth/dev with dev login off answers 404 without touching the body, whatever it holds', () => {
  const scenarios: Array<[string, DevScenario]> = [
    ['broken multipart', { contentType: 'multipart/form-data; boundary=x', body: 'garbage' }],
    ['text', { contentType: 'text/plain', body: 'hello' }],
    ['urlencoded', { contentType: 'application/x-www-form-urlencoded', body: 'a=b' }],
  ]
  for (const [label, scenario] of scenarios) {
    const result = runDevLoginProbe(false, scenario)
    assertDevProbeRan(result)
    assert.equal(result.report!.status, 404, `${label}: status`)
    assert.deepEqual(result.report!.calls, [], `${label}: no body reader may be called when dev login is off`)
    assert.equal(result.report!.bodyUsed, false, `${label}: the body must be left unread when dev login is off`)
    assert.equal(result.report!.setCookie, null, `${label}: no cookie`)
  }
})

// ===========================================================================
// §5 /admin/reveal with an admin session
// ===========================================================================
//
// No earlier test drives POST /admin/reveal itself (test/17 and test/18 only
// check the file's existence and its method exports), so this harness is new.
// The handler is run in a subprocess, again because the env is cached, with
// the two things it needs from outside the repo's own code swapped for test
// doubles through node:test's module mocks:
//
//   - src/pool.ts getDb(): returns a drizzle handle over PGlite, migrated by
//     test/harness.ts like every other database test;
//   - next/headers cookies(): returns an admin_sid signed with the probe's
//     SESSION_SECRET (or no cookie at all), since cookies() is only valid
//     inside a Next request scope.
//
// Everything between those two, including the route, the admin session check
// and the audit write, is the real code. A positive control (a form that
// parses and carries a confession id and a reason) must write exactly one
// audit row, so "zero new rows" for the malformed bodies cannot be the
// harness failing to reach the handler.

type RevealScenario = {
  session: boolean
  contentType: string | null
  body: string | null
  control: boolean
}

type RevealProbeResult = {
  status: number | null
  stderr: string
  report: {
    threw?: string
    status?: number
    text?: string
    contentType?: string | null
    setCookie?: string | null
    auditRowsBefore?: number
    auditRowsAfter?: number
    calls?: string[]
    bodyUsed?: boolean
  } | null
}

function runRevealProbe(scenario: RevealScenario): RevealProbeResult {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'w33-reveal-probe-'))
  try {
    const href = (...parts: string[]) => JSON.stringify(pathToFileURL(path.join(REPO_ROOT, ...parts)).href)
    const requireFromRepo = createRequire(path.join(REPO_ROOT, 'package.json'))
    const nextHeadersUrl = JSON.stringify(pathToFileURL(requireFromRepo.resolve('next/headers')).href)
    const nextServerUrl = JSON.stringify(pathToFileURL(requireFromRepo.resolve('next/server')).href)

    const probe = path.join(dir, 'probe.mts')
    writeFileSync(
      probe,
      [
        "import { mock } from 'node:test'",
        "const scenario = JSON.parse(process.env.W33_SCENARIO ?? '{}')",
        `const { freshDb } = await import(${href('test', 'harness.ts')})`,
        `const { createAccount, createLink, createConfession } = await import(${href('test', 'fixtures.ts')})`,
        `const { signAdminSession } = await import(${href('src', 'admin-auth.ts')})`,
        'const { db, client } = await freshDb()',
        'const adminRow = await client.query(',
        '  "insert into admin_users (username, password_hash) values ($1, $2) returning id",',
        '  ["revealprobe", process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH],',
        ')',
        'const adminUserId = adminRow.rows[0].id',
        'const sender = await createAccount(db)',
        'const recipient = await createAccount(db)',
        'const link = await createLink(db, recipient.id)',
        'const confession = await createConfession(db, { linkId: link.id, senderAccountId: sender.id })',
        'const cookieValue = signAdminSession(process.env.SESSION_SECRET, { adminUserId })',
        'const store = {',
        "  get: (name: string) => (scenario.session && name === 'admin_sid' ? { name, value: cookieValue } : undefined),",
        "  getAll: () => (scenario.session ? [{ name: 'admin_sid', value: cookieValue }] : []),",
        "  has: (name: string) => scenario.session && name === 'admin_sid',",
        '}',
        `mock.module(${href('src', 'pool.ts')}, { namedExports: { getDb: () => db } })`,
        `mock.module(${nextHeadersUrl}, { namedExports: { cookies: async () => store, headers: async () => new Headers(), draftMode: async () => ({ isEnabled: false }) } })`,
        `const nextServer: any = await import(${nextServerUrl})`,
        'const NextRequest = nextServer.NextRequest ?? nextServer.default.NextRequest',
        `const mod = await import(${href('app', 'admin', 'reveal', 'route.ts')})`,
        'const headers: Record<string, string> = {}',
        "if (scenario.contentType !== null) headers['content-type'] = scenario.contentType",
        'let body: string | null = scenario.body',
        'if (scenario.control) {',
        "  body = new URLSearchParams({ confessionId: confession.id, reason: 'reported, checking the sender' }).toString()",
        "  headers['content-type'] = 'application/x-www-form-urlencoded'",
        '}',
        "const request = new NextRequest('http://localhost:3000/admin/reveal', { method: 'POST', headers, body })",
        'const calls: string[] = []',
        "for (const name of ['formData', 'text', 'json', 'arrayBuffer', 'blob', 'bytes']) {",
        '  const original = (request as any)[name]',
        '  if (typeof original !== "function") continue',
        '  ;(request as any)[name] = (...args: unknown[]) => { calls.push(name); return original.apply(request, args) }',
        '}',
        'const count = async () => (await client.query("select count(*)::int as c from admin_reveal_log")).rows[0].c',
        'const auditRowsBefore = await count()',
        'let report',
        'try {',
        '  const response = await mod.POST(request)',
        '  report = {',
        '    status: response.status,',
        '    text: await response.text(),',
        "    contentType: response.headers.get('content-type'),",
        "    setCookie: response.headers.get('set-cookie'),",
        '    auditRowsBefore,',
        '    auditRowsAfter: await count(),',
        '    calls,',
        '    bodyUsed: request.bodyUsed,',
        '  }',
        '} catch (error) {',
        '  report = { threw: String(error), auditRowsBefore, auditRowsAfter: await count(), calls, bodyUsed: request.bodyUsed }',
        '}',
        "console.log('W33_REPORT ' + JSON.stringify(report))",
        'process.exit(0)',
      ].join('\n'),
    )
    const result = spawnSync('node', ['--import', 'tsx', '--experimental-test-module-mocks', probe], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      timeout: 120_000,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://user:pass@localhost:1/confession',
        SESSION_SECRET: 'r'.repeat(32),
        APP_ORIGIN: 'http://localhost:3000',
        ADMIN_BOOTSTRAP_USERNAME: 'revealprobe',
        ADMIN_BOOTSTRAP_PASSWORD_HASH: hashAdminPassword('a password for the reveal probe'),
        W33_SCENARIO: JSON.stringify(scenario),
      },
    })
    const line = (result.stdout ?? '').split('\n').find((l) => l.startsWith('W33_REPORT '))
    return {
      status: result.status,
      report: line ? JSON.parse(line.slice('W33_REPORT '.length)) : null,
      stderr: result.stderr ?? '',
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function assertRevealProbeRan(result: RevealProbeResult) {
  assert.equal(result.status, 0, `the probe process must run cleanly; stderr:\n${result.stderr}`)
  assert.ok(result.report, `the probe must report; stderr:\n${result.stderr}`)
}

test('§5 /admin/reveal harness control: a form that parses, with a confession id and a reason, is answered and writes exactly one audit row', () => {
  const result = runRevealProbe({ session: true, contentType: null, body: null, control: true })
  assertRevealProbeRan(result)
  const report = result.report!
  assert.equal(report.threw, undefined, `the control must be answered, not thrown: ${report.threw}`)
  assert.equal(report.status, 200, `the control reveal must succeed; body: ${report.text}`)
  assert.equal(report.auditRowsBefore, 0)
  assert.equal(report.auditRowsAfter, 1, 'a successful reveal writes exactly one audit row')
})

const REVEAL_400_CASES: Array<[string, Pick<RevealScenario, 'contentType' | 'body'>]> = [
  ['a bodiless POST', { contentType: null, body: null }],
  ['a text/plain body', { contentType: 'text/plain', body: 'hello' }],
  ['a broken multipart body', { contentType: 'multipart/form-data; boundary=x', body: 'garbage' }],
]

for (const [label, input] of REVEAL_400_CASES) {
  test(`§5 /admin/reveal with an admin session answers 400 with the error document to ${label}, and writes no audit row`, () => {
    const result = runRevealProbe({ session: true, control: false, ...input })
    assertRevealProbeRan(result)
    const report = result.report!
    assert.equal(report.threw, undefined, `POST /admin/reveal must answer, not throw: ${report.threw}`)
    assert.equal(report.status, 400)
    assert.ok(
      (report.text ?? '').includes('صار خطأ'),
      `the 400 must be the «صار خطأ» document a failed reveal already uses; got: ${report.text}`,
    )
    assert.match(report.contentType ?? '', /text\/html/, 'it is an html document')
    assert.equal(report.setCookie, null)
    assert.equal(report.auditRowsBefore, 0)
    assert.equal(report.auditRowsAfter, 0, 'a body that does not parse must write no audit row')
  })
}

test('§5 /admin/reveal without an admin session leaves the body unread and writes no audit row (spec §1.3: the admin check is before the body)', () => {
  const result = runRevealProbe({
    session: false,
    control: false,
    contentType: 'multipart/form-data; boundary=x',
    body: 'garbage',
  })
  assertRevealProbeRan(result)
  const report = result.report!
  assert.notEqual(report.status, 400, `without a session the answer is the admin redirect, not the body error; ${JSON.stringify(report)}`)
  assert.ok(
    report.threw?.includes('NEXT_REDIRECT') || (report.status !== undefined && report.status >= 300 && report.status < 400),
    `without a session the handler must take the admin redirect; ${JSON.stringify(report)}`,
  )
  assert.deepEqual(report.calls, [], 'no body reader may be called before the admin session is checked')
  assert.equal(report.bodyUsed, false)
  assert.equal(report.auditRowsAfter, 0)
})
