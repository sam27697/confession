// test/17-admin-html.test.ts
//
// Written from docs/SPEC-week7-admin.md section 8, specifically §8.2 (the
// html.ts contract), §8.3 (the route rename), §8.4 (the contexts the
// escaper does not cover, and are therefore banned) and §8.6 (the test
// list itself), together with §3.3/§3.3.1 and §4.1-§4.6 for the privacy
// rules the surface has to keep. Not written from app/admin/_lib/html.ts,
// which does not exist in this worktree, and not from
// app/admin/reveal/route.tsx or route.ts, which were never opened while
// writing this file. Every expected string, table entry and signature
// fragment below is transcribed by hand from the spec.
//
// Expected state when this file is run: app/admin/_lib/html.ts does not
// exist yet, so every test that needs html/htmlResponse/revealDocument
// imports the module with a per-test dynamic import() and fails on that
// import rather than on an assertion. app/admin/reveal/route.tsx is still
// the old JSX version that does not build (spec §7/§8.0), so the
// source-level tests (items 9-11) run for real and are expected to fail
// on that file, not on a missing module. Items 1-8 are behaviour; items
// 9-11 are the build-enforced half, in the shape week 6's tripwire
// established (test/14-share-card.test.ts, item 9 there).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { SafeHtml } from '../app/admin/_lib/html.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The module under test does not exist yet in this worktree (see header).
// Every behavioural test (items 1-8) loads it through this dynamic import
// rather than a static top-level one, so a missing module fails only the
// individual test that needed it, and the source-level tests further down
// (items 9-11), which never touch this module, still run and report their
// own real failures instead of being aborted by a load-time crash.
async function loadHtml(): Promise<any> {
  return import('../app/admin/_lib/html.js')
}

// SafeHtml is a branded object, not a string (§8.2: `{ readonly __safeHtml:
// string }`). There is no exported unwrap function, so this is the only way
// a test can look at what `html` actually produced. Used only on values
// that came out of a real `html`/`revealDocument` call in this file, never
// on a hand-forged object -- item 4 explicitly puts forging the brand out
// of scope.
function raw(x: SafeHtml): string {
  return (x as unknown as { __safeHtml: string }).__safeHtml
}

// Reference implementation of the five-character table in §8.2, transcribed
// by hand from the spec, not derived from html.ts. & first, or every other
// replacement below would itself get escaped a second time -- the same
// ordering requirement §8.2 states and item 2 tests directly.
function specEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

// Shared by every item 9/10 sub-test. A missing or empty app/admin/ is a
// failure to report, not an empty glob to pass over silently -- the same
// reasoning test/16-admin-surface.test.ts's item 19 states for the same
// directory.
function getAdminSourceFiles(): string[] {
  const adminDir = path.join(REPO_ROOT, 'app', 'admin')
  assert.ok(
    existsSync(adminDir) && statSync(adminDir).isDirectory(),
    'app/admin/ does not exist: that is a failure to report, not an empty glob to pass over silently',
  )
  const files = listSourceFiles(adminDir)
  assert.ok(files.length > 0, 'app/admin/ exists but contains no .ts/.tsx source files: nothing to check is itself a failure here')
  return files
}

// ---------------------------------------------------------------------------
// item 1: character sweep (§8.6.1)
// ---------------------------------------------------------------------------

test('§8.6.1 every codepoint from U+0000 to U+02FF is escaped per the five-character table and left byte-for-byte otherwise', async () => {
  const { html } = await loadHtml()
  const SPECIAL = new Set(['&', '<', '>', '"', "'"])

  for (let cp = 0; cp <= 0x2ff; cp++) {
    const char = String.fromCodePoint(cp)
    const out = raw(html`${char}`)
    const label = `U+${cp.toString(16).padStart(4, '0')}`
    if (SPECIAL.has(char)) {
      assert.equal(out, specEscape(char), `${label} must map to its table entry, got ${JSON.stringify(out)}`)
    } else {
      assert.equal(out, char, `${label} must pass through unchanged, got ${JSON.stringify(out)}`)
      assert.equal(out.length, char.length, `${label}: output length must equal input length`)
    }
  }

  // Outside the swept range: an Arabic-block codepoint, an emoji, and a
  // codepoint near the top of the valid Unicode range. None of these is
  // one of the five, so all three must pass through untouched, unmangled,
  // as UTF-8 (§8.2: "mangling a display name is its own kind of wrong
  // answer").
  for (const cp of [0x0600, 0x1f600, 0x10ffe]) {
    const char = String.fromCodePoint(cp)
    const out = raw(html`${char}`)
    const label = `U+${cp.toString(16)}`
    assert.equal(out, char, `${label} must pass through unchanged, got ${JSON.stringify(out)}`)
    assert.equal(out.length, char.length, `${label}: output length must equal input length`)
  }
})

// ---------------------------------------------------------------------------
// item 2: ordering (§8.6.2)
// ---------------------------------------------------------------------------

test('§8.6.2 escaping the already-escaped is visible, not silent', async () => {
  const { html } = await loadHtml()
  assert.equal(raw(html`${'<'}`), '&lt;', 'a bare < must become &lt;, not &amp;lt;')
  assert.equal(raw(html`${'&lt;'}`), '&amp;lt;', 'an already-escaped &lt; must itself be escaped again, in full, not left as-is')
})

// ---------------------------------------------------------------------------
// item 3: payloads (§8.6.3)
// ---------------------------------------------------------------------------

test('§8.6.3 attack payloads come out escaped in full, with no unescaped < or " introduced, and the payload itself is present in escaped form', async () => {
  const { html } = await loadHtml()

  const fiveHundredCharacterName = '<b>' + 'x'.repeat(493) + '</b>'
  assert.equal(fiveHundredCharacterName.length, 500, 'sanity check on the fixture itself, not the module under test')

  const PAYLOADS = [
    '<script>alert(1)</script>',
    '"><script>alert(1)</script>',
    "'><img src=x onerror=alert(1)>",
    '</title><script>',
    '</textarea>',
    '" onmouseover="alert(1)',
    'javascript:alert(1)',
    fiveHundredCharacterName,
  ]

  for (const payload of PAYLOADS) {
    const out = raw(html`${payload}`)

    // A test that only asserts "does not equal the payload" is worthless
    // (task instructions): assert the exact escaped form, against the
    // reference table above, not merely "changed somehow".
    assert.equal(
      out,
      specEscape(payload),
      `payload ${JSON.stringify(payload)} must escape to exactly the five-character table's mapping, got ${JSON.stringify(out)}`,
    )

    // No unescaped < or " may survive into the output. Since this
    // template has no literal chunk around the interpolation, the whole
    // output is interpolated content, so this is a strict "none at all".
    assert.ok(!out.includes('<'), `payload ${JSON.stringify(payload)}: escaped output must contain no raw '<', got ${JSON.stringify(out)}`)
    assert.ok(!out.includes('"'), `payload ${JSON.stringify(payload)}: escaped output must contain no raw '"', got ${JSON.stringify(out)}`)

    // The payload must be present in escaped form, not silently dropped or
    // truncated -- a payload containing a special character must produce a
    // strictly longer, different string than the raw payload.
    if (/[&<>"']/.test(payload)) {
      assert.notEqual(out, payload, `payload ${JSON.stringify(payload)} contains a special character and must not pass through unescaped`)
    }
  }

  // Concrete, readable spot checks in addition to the table-driven loop
  // above, on the two payloads most likely to be eyeballed in review.
  assert.ok(raw(html`${'<script>alert(1)</script>'}`).includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  assert.ok(raw(html`${'" onmouseover="alert(1)'}`).includes('&quot; onmouseover=&quot;alert(1)'))
})

// ---------------------------------------------------------------------------
// item 4: the brand (§8.6.4)
// ---------------------------------------------------------------------------

test('§8.6.4 a SafeHtml value nested in another template is inserted verbatim; the same content as a plain string is escaped again', async () => {
  const { html } = await loadHtml()

  const userContent = '<b>from user</b>'
  const inner = html`${userContent}` // a SafeHtml whose raw text is the once-escaped form of userContent
  const nested = html`<div>${inner}</div>`

  // §8.2: "A SafeHtml is inserted verbatim and is not escaped again." The
  // nested document must be exactly the literal wrapper plus inner's raw
  // text, unchanged -- no second escaping of inner's already-escaped &.
  assert.equal(raw(nested), `<div>${raw(inner)}</div>`)
  assert.ok(!raw(nested).includes('&amp;lt;'), 'nesting a SafeHtml must not double-escape its content')

  // The same text, but as a plain string rather than a SafeHtml, must be
  // escaped as ordinary untrusted content -- producing a different, further
  // -escaped result than the nested-SafeHtml case above.
  const innerRawText = raw(inner)
  const asPlainString = html`<div>${innerRawText}</div>`
  assert.equal(raw(asPlainString), `<div>${specEscape(innerRawText)}</div>`)
  assert.notEqual(raw(asPlainString), raw(nested), 'the same text must render differently depending on whether it carries the SafeHtml brand')

  // Out of scope, per item 4's own text: an object shaped like
  // `{ __safeHtml: '<script>' }` that was not produced by `html` is a
  // compile-time guarantee, not a runtime one, and is not tested here.
})

// ---------------------------------------------------------------------------
// item 5: value kinds (§8.6.5)
// ---------------------------------------------------------------------------

test('§8.6.5 null, undefined and false render empty; 0 renders "0" and is not treated as empty', async () => {
  const { html } = await loadHtml()
  assert.equal(raw(html`${null}`), '')
  assert.equal(raw(html`${undefined}`), '')
  assert.equal(raw(html`${false}`), '', 'false must render empty, so that `cond && html`...`` is a legal fragment (§8.2)')
  assert.equal(raw(html`${0}`), '0')
  assert.notEqual(raw(html`${0}`), '', '0 is falsy in JS but must NOT be treated the same as null/undefined/false')
})

test('§8.6.5 an array of SafeHtml values joins with no separator, and a nested array is handled (flattened), not rejected', async () => {
  const { html } = await loadHtml()

  const parts = [html`a`, html`b`, html`c`]
  assert.equal(raw(html`${parts}`), 'abc')

  // Item 5's own wording leaves "nested array: handled or rejected" open
  // and says only "whichever it is, it is asserted". The choice made here:
  // HANDLED (recursively flattened), not rejected/thrown.
  //
  // Reasoning from §8.2's own text, not from the implementation: the array
  // rule reads "An array is mapped element-wise by these same rules and
  // joined with ''" -- "these same rules" is the full value-kind list
  // stated just above it, which includes the array rule itself, with no
  // stated carve-out for an element that is itself an array. A rule that
  // recurses into itself without an exception is a recursive rule, and the
  // literal reading of "these same rules" applied to an array element that
  // is itself an array is: apply the array rule again. Nothing in §8.2
  // describes a thrown error as one of the possible outputs of `html` at
  // all (every other listed case names its exact rendered text). Rejection
  // would be a new failure mode invented for this one case, not implied by
  // the sentence that is actually there.
  const nested = [[html`x`, html`y`], html`z`]
  assert.equal(raw(html`${nested}`), 'xyz')

  const nestedWithEscaping = [['<', '>'], 'ok']
  assert.equal(raw(html`${nestedWithEscaping}`), '&lt;&gt;ok')
})

// ---------------------------------------------------------------------------
// item 6: htmlResponse refuses a string (§8.6.6)
// ---------------------------------------------------------------------------

test('§8.6.6 htmlResponse throws a TypeError, not a Response, for a plain string smuggled through `as any`', async () => {
  const { htmlResponse } = await loadHtml()
  assert.throws(
    () => htmlResponse('<b>' as any, 200),
    (err: unknown) => err instanceof TypeError,
    'htmlResponse must throw a TypeError at runtime for a non-SafeHtml value, even when the type system is bypassed with `as any` (§8.2)',
  )
})

test('§8.6.6 htmlResponse returns the given status with text/html; charset=utf-8 and Cache-Control: no-store for a real SafeHtml', async () => {
  const { html, htmlResponse } = await loadHtml()
  const doc = html`<p>hello</p>`

  const ok = htmlResponse(doc, 200)
  assert.ok(ok instanceof Response, 'htmlResponse must return a real Response for a SafeHtml value')
  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get('content-type'), 'text/html; charset=utf-8')
  assert.equal(ok.headers.get('cache-control'), 'no-store')
  assert.equal(await ok.text(), raw(doc))

  const bad = htmlResponse(doc, 400)
  assert.equal(bad.status, 400, 'the given status code must be honoured, not hardcoded to 200 (§3.3 renders 400 on a rejected reveal)')
})

// ---------------------------------------------------------------------------
// item 7: the type is the enforcement (§8.6.7)
// ---------------------------------------------------------------------------

test("§8.6.7 (source-level) htmlResponse's first parameter is typed SafeHtml, not string", () => {
  const filePath = path.join(REPO_ROOT, 'app', 'admin', '_lib', 'html.ts')
  // No existsSync guard here: a missing file must fail this test loudly
  // (readFileSync throws ENOENT), not be treated as "nothing to check".
  const src = readFileSync(filePath, 'utf8')

  const match = src.match(/export function htmlResponse\s*\(\s*[a-zA-Z_$][\w$]*\s*:\s*([^,)]+)[,)]/)
  assert.ok(match, 'could not find an `export function htmlResponse(x: <type>, ...)` signature in app/admin/_lib/html.ts to check')

  const paramType = match![1]!.trim()
  assert.equal(paramType, 'SafeHtml', `htmlResponse's first parameter must be typed SafeHtml, found "${paramType}" (§8.2, §8.6 item 7)`)
})

// ---------------------------------------------------------------------------
// item 8: the document (§8.6.8)
// ---------------------------------------------------------------------------

test('§8.6.8 revealDocument wraps an escaped body value in the full document, with exactly one <title> and no literal <script anywhere', async () => {
  const { html, revealDocument } = await loadHtml()

  const body = html`<p>${'<script>alert(1)</script>'}</p>`
  const doc = revealDocument('كشف الهوية', body)
  const out = raw(doc)

  assert.ok(out.startsWith('<!DOCTYPE html>'), 'document must start with <!DOCTYPE html>')
  assert.ok(out.includes('lang="ar"'), 'document must declare lang="ar" (§8.2)')
  assert.ok(out.includes('dir="rtl"'), 'document must declare dir="rtl" (§8.2)')
  assert.ok(/charset/i.test(out), 'document must declare a charset')

  const titleCount = (out.match(/<title>/g) ?? []).length
  assert.equal(titleCount, 1, 'exactly one <title> element')

  assert.ok(!out.includes('<script'), 'no literal <script substring may appear anywhere in the rendered document')
  assert.ok(out.includes('&lt;script&gt;'), 'the script payload passed in as a body value must appear in escaped form')
})

// ---------------------------------------------------------------------------
// item 9: §8.4 enforced against the source (§8.6.9)
// ---------------------------------------------------------------------------

test('§8.6.9a no file under app/admin/ contains dangerouslySetInnerHTML', () => {
  const files = getAdminSourceFiles()
  const offenders = files
    .filter((f) => readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML'))
    .map((f) => path.relative(REPO_ROOT, f))
  assert.deepEqual(offenders, [], `dangerouslySetInnerHTML is forbidden anywhere under app/admin/ (§8.4 rule 5): ${offenders.join(', ')}`)
})

test('§8.6.9b no file under app/admin/ contains a <script element', () => {
  const files = getAdminSourceFiles()
  const offenders = files
    .filter((f) => /<script/i.test(readFileSync(f, 'utf8')))
    .map((f) => path.relative(REPO_ROOT, f))
  assert.deepEqual(offenders, [], `no <script> element is permitted under app/admin/, with or without interpolation (§8.4 rule 3): ${offenders.join(', ')}`)
})

test('§8.6.9c no file under app/admin/ contains an on*= event-handler attribute', () => {
  const files = getAdminSourceFiles()
  const EVENT_HANDLER = /\bon[a-zA-Z]+\s*=/
  const offenders: string[] = []
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const rel = path.relative(REPO_ROOT, file)
    content.split('\n').forEach((line, i) => {
      if (EVENT_HANDLER.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`)
    })
  }
  assert.deepEqual(offenders, [], `an on*= event-handler attribute is forbidden anywhere under app/admin/, with or without interpolation (§8.4 rule 3): ${offenders.join(' | ')}`)
})

test('§8.6.9d no file under app/admin/ interpolates into a URL-bearing attribute (href/src/action/formaction/srcset/poster/cite)', () => {
  const files = getAdminSourceFiles()
  // Template-literal form, as §8.6 item 9 states it literally, and the JSX
  // equivalent: any href={...}/src={...}/etc in JSX source is inherently a
  // dynamic expression, since a JSX literal string attribute is written
  // href="..." rather than href={...}.
  // `action` is in the template-literal set but not the JSX one (spec
  // §8.4.1). In hand-built HTML a form's action is a URL string. In JSX,
  // action={fn} is React's server action form and the value is a function
  // reference that never reaches the document as a URL, which is what
  // app/admin/login/page.tsx passes. Every other attribute here is
  // URL-bearing in both forms and stays in both.
  const URL_ATTR_TEMPLATE_LITERAL = /(href|src|action|formaction|srcset|poster|cite)="\$\{/
  const URL_ATTR_JSX = /(href|src|formaction|srcset|poster|cite)=\{/
  const offenders: string[] = []
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const rel = path.relative(REPO_ROOT, file)
    if (URL_ATTR_TEMPLATE_LITERAL.test(content)) offenders.push(`${rel}: template-literal interpolation into a URL-bearing attribute`)
    if (URL_ATTR_JSX.test(content)) offenders.push(`${rel}: JSX expression in a URL-bearing attribute`)
  }
  assert.deepEqual(
    offenders,
    [],
    `href/src/action/formaction/srcset/poster/cite must never receive an interpolated value under app/admin/; the reveal page's only link is the literal /admin (§8.4 rule 2): ${offenders.join(' | ')}`,
  )
})

test('§8.6.9e no <style> block under app/admin/ contains ${ interpolation', () => {
  const files = getAdminSourceFiles()
  const offenders: string[] = []
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const rel = path.relative(REPO_ROOT, file)
    for (const m of content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      if (m[1]!.includes('${')) offenders.push(rel)
    }
  }
  assert.deepEqual(offenders, [], `a <style> block must be static text with no \${ interpolation anywhere under app/admin/, including _lib/html.ts (§8.4 rule 4, §8.2): ${offenders.join(', ')}`)
})

// ---------------------------------------------------------------------------
// item 10: text/html has one origin (§8.6.10)
// ---------------------------------------------------------------------------

test('§8.6.10 the string text/html appears in no file under app/admin/ other than _lib/html.ts', () => {
  const files = getAdminSourceFiles()
  const offenders = files
    .filter((f) => path.relative(REPO_ROOT, f) !== path.join('app', 'admin', '_lib', 'html.ts'))
    .filter((f) => readFileSync(f, 'utf8').includes('text/html'))
    .map((f) => path.relative(REPO_ROOT, f))
  assert.deepEqual(offenders, [], `text/html must have exactly one origin, app/admin/_lib/html.ts; found it elsewhere in: ${offenders.join(', ')}`)
})

// ---------------------------------------------------------------------------
// item 11: nothing was renamed away (§8.6.11)
// ---------------------------------------------------------------------------

test('§8.6.11a app/admin/reveal/route.tsx no longer exists, and app/admin/reveal/route.ts exists in its place', () => {
  const oldPath = path.join(REPO_ROOT, 'app', 'admin', 'reveal', 'route.tsx')
  const newPath = path.join(REPO_ROOT, 'app', 'admin', 'reveal', 'route.ts')
  assert.ok(!existsSync(oldPath), 'app/admin/reveal/route.tsx must be gone: a .tsx file with no JSX in it is a lie about the file (§8.3)')
  assert.ok(existsSync(newPath), 'app/admin/reveal/route.ts must exist in its place (§8.3)')
})

test('§8.6.11b no file under app/ or src/ imports react-dom/server in any form, static or dynamic', () => {
  const files = [...listSourceFiles(path.join(REPO_ROOT, 'app')), ...listSourceFiles(path.join(REPO_ROOT, 'src'))]
  assert.ok(files.length > 0, 'app/ and src/ together contain no .ts/.tsx files: nothing to check is itself a failure here')

  // Deliberately blunt, in the shape of week 6's tripwire (test/14-share-
  // card.test.ts, item 9): the bare substring "react-dom/server" covers the
  // named import, server.edge, server.node, server.browser (all share the
  // same prefix) and a dynamic import('react-dom/server...') alike, and
  // option 5 of §8.1 forbids routing around the check by any of those
  // spellings.
  const REACT_DOM_SERVER = /react-dom\/server(\.\w+)?/
  const offenders = files
    .filter((f) => REACT_DOM_SERVER.test(readFileSync(f, 'utf8')))
    .map((f) => path.relative(REPO_ROOT, f))
  assert.deepEqual(
    offenders,
    [],
    `no file under app/ or src/ may import react-dom/server, react-dom/server.edge, react-dom/server.node or react-dom/server.browser, statically or via dynamic import() (§8.1, §8.6 item 11): ${offenders.join(', ')}`,
  )
})
