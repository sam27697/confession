// test/88-guest-draft.test.ts
//
// Week 36 acceptance, written from docs/SPEC-week36-write-before-sign-in.md
// sections 1, 2 and the parts of 4 that need no running server.
//
// SubmitButton.tsx is imported as a namespace and wireDraftBox is looked up
// by name, so a tree without the export fails the one test that needs it and
// not the whole file. GuestSignIn.tsx is read as text for the same reason.
//
// The signed-out branch of app/c/[slug]/page.tsx is found by text: the span
// between <OpenInBrowser and </OpenInBrowser>, with local function
// components used inside it expanded in place and comments removed.
//
// Spec section 5.2 (review pass 1) is tested in section 8 and in the tests
// marked "5.2" below. Four child-process probes under test/fixtures/w36/ run
// the real code with test doubles for what Next supplies: the page rendered to
// markup (probe-page.mts), the logout handler (probe-logout.mts), the mount
// effect of GuestSignIn against a fake DOM and a fake sessionStorage
// (probe-guest-effect.mts) and OpenInBrowser's state machine
// (probe-open-in-browser.mts).
//
// Run with PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium, type Browser } from 'playwright'
import * as SubmitButtonModule from '../app/_components/SubmitButton.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')
const SEND_PAGE = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
const SUBMIT_BUTTON = path.join(APP_DIR, '_components', 'SubmitButton.tsx')
const GUEST_SIGN_IN = path.join(APP_DIR, '_components', 'GuestSignIn.tsx')
const GLOBALS_CSS = path.join(APP_DIR, 'globals.css')
const LOGOUT_ROUTE = path.join(APP_DIR, 'auth', 'logout', 'route.ts')
const FIXTURE_DIR = path.join(REPO_ROOT, 'test', 'fixtures', 'w36')
const FIXTURE = path.join(FIXTURE_DIR, 'guest-signed-out.html')

const PRIVACY_HINT = 'رسالتك بتضل على جهازك وما بتوصلنا قبل ما تكبس ابعت. سجّل دخول ومنرجعك لهون لتبعتها.'
const FALLBACK_HINT = 'تسجيل الدخول بياخد ثواني، وبعدها منرجعك لهون لتكتب رسالتك.'
const PITCH = /صارح \{[^}]+\} باللي بقلبك بدون ما يعرف هويتك\./
const SIGN_IN_LABEL = /سجل دخول وكمّل\s*(?:\{ACTION_EMOJI\.send\}|\u{1F680})/u
const PLACEHOLDER = 'اكتب اللي بقلبك...'
const RESTORED = 'تم استعادة المسودة'
const SAVED = 'تم الحفظ تلقائياً'
const SAVING = 'عم يحفظ...'

const PROMPTS = [
  'صارحني بشي ما بتسترجي تقوله بوجهي...',
  'شو أكتر موقف حلو ما بتنساه معي؟',
  'كلمة بقلبك من زمان وحابب توصلني...',
  'نصيحة صادقة من قلبك بتفيدني بهالفترة...',
]

const OLD_CHIPS_SCRIPT =
  `(function(){document.addEventListener('click',function(e){var t=e.target.closest('button[data-starter-prompt]');if(!t)return;var f=t.closest('form');if(!f)return;var ta=f.querySelector('textarea[name="body"]');if(!ta)return;ta.value=t.getAttribute('data-starter-prompt')||'';ta.focus();ta.dispatchEvent(new Event('input',{bubbles:true}));});})();`
const NEW_CHIPS_SCRIPT = OLD_CHIPS_SCRIPT.replace("t.closest('form')", "t.closest('form,[data-compose]')")

// ---------------------------------------------------------------------------
// Source helpers
// ---------------------------------------------------------------------------

function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
}

function readPage(): string {
  assert.ok(existsSync(SEND_PAGE), 'app/c/[slug]/page.tsx must exist')
  return stripComments(readFileSync(SEND_PAGE, 'utf8'))
}

// Index just past the '>' that closes the opening tag starting at i.
function tagEnd(src: string, i: number): number {
  let depth = 0
  let quote: string | null = null
  for (let k = i + 1; k < src.length; k += 1) {
    const ch = src[k]!
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (depth === 0 && (ch === '"' || ch === "'")) quote = ch
    else if (ch === '{') depth += 1
    else if (ch === '}') depth -= 1
    else if (ch === '>' && depth === 0) return k + 1
  }
  return src.length
}

function openingTagAt(src: string, attrIndex: number): number {
  return src.lastIndexOf('<', attrIndex)
}

// [start, end) of the element whose opening tag starts at openIdx.
function elementSpan(src: string, openIdx: number): [number, number] {
  const name = /^<([A-Za-z][\w.]*)/.exec(src.slice(openIdx))?.[1]
  assert.ok(name, 'expected an element at the given index')
  const firstEnd = tagEnd(src, openIdx)
  if (src[firstEnd - 2] === '/') return [openIdx, firstEnd]
  const re = new RegExp(`<${name.replace('.', '\\.')}(?![\\w.])|</${name.replace('.', '\\.')}>`, 'g')
  re.lastIndex = firstEnd
  let depth = 1
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    if (m[0].startsWith('</')) {
      depth -= 1
      if (depth === 0) return [openIdx, m.index + m[0].length]
    } else {
      const end = tagEnd(src, m.index)
      if (src[end - 2] !== '/') depth += 1
    }
  }
  return [openIdx, src.length]
}

function localFunctionBody(src: string, name: string): string | null {
  const m = new RegExp(`function\\s+${name}\\s*\\(`).exec(src)
  if (!m) return null
  const end = src.indexOf('\n}\n', m.index)
  return src.slice(m.index, end === -1 ? src.length : end + 2)
}

// The signed-out branch, local components expanded in place.
function guestBranch(): string {
  const src = readPage()
  const start = src.indexOf('<OpenInBrowser')
  const close = src.indexOf('</OpenInBrowser>')
  assert.ok(start !== -1 && close > start, 'page.tsx must render the signed-out branch inside <OpenInBrowser>...</OpenInBrowser>')
  let region = src.slice(start, close + '</OpenInBrowser>'.length)
  for (let pass = 0; pass < 3; pass += 1) {
    region = region.replace(/<([A-Z]\w*)\b[^>]*?\/>/g, (whole, name: string) => {
      if (['OpenInBrowser', 'GuestSignIn', 'Script', 'SubmitButton', 'SendPage'].includes(name)) return whole
      return localFunctionBody(src, name) ?? whole
    })
  }
  return region
}

function withoutChipsScript(region: string): string {
  return region.replace(/<Script\b[\s\S]*?\/>/g, '')
}

function readGuestSignIn(): string {
  assert.ok(existsSync(GUEST_SIGN_IN), 'app/_components/GuestSignIn.tsx must exist (spec section 1.3)')
  return stripComments(readFileSync(GUEST_SIGN_IN, 'utf8'))
}

function assertOrder(text: string, markers: Array<[string, number]>) {
  let prev = -1
  let prevName = 'start'
  for (const [name, idx] of markers) {
    assert.ok(idx >= 0, `${name} must be present`)
    assert.ok(idx > prev, `${name} must come after ${prevName}`)
    prev = idx
    prevName = name
  }
  void text
}

function indexOfRe(text: string, re: RegExp): number {
  const m = re.exec(text)
  return m ? m.index : -1
}

// ---------------------------------------------------------------------------
// Fakes for wireDraftBox and wireDraft (plain objects, no DOM), as in tests
// 31 and 72.
// ---------------------------------------------------------------------------

type Listener = (event: { type: string }) => void

function makeListenerTarget() {
  const listeners = new Map<string, Listener[]>()
  return {
    listeners,
    addEventListener(type: string, fn: Listener) {
      const arr = listeners.get(type) ?? []
      arr.push(fn)
      listeners.set(type, arr)
    },
    removeEventListener(type: string, fn: Listener) {
      const arr = listeners.get(type)
      if (!arr) return
      const i = arr.indexOf(fn)
      if (i >= 0) arr.splice(i, 1)
    },
    dispatchEvent(event: { type: string }) {
      for (const fn of (listeners.get(event.type) ?? []).slice()) fn(event)
      return true
    },
  }
}

function makeTextarea({ slug, sent, value = '' }: { slug?: string; sent?: string; value?: string }) {
  return {
    ...makeListenerTarget(),
    value,
    getAttribute(name: string) {
      if (name === 'data-draft-slug') return slug === undefined ? null : slug
      if (name === 'data-draft-sent') return sent === undefined ? null : sent
      return null
    },
  }
}

function makeRoot(indicator: unknown, textarea?: unknown) {
  return {
    ...makeListenerTarget(),
    querySelector(selector: string) {
      if (selector === '#draft-status') return indicator ?? null
      if (selector === 'textarea[name="body"]') return textarea ?? null
      return null
    },
  }
}

function makeBox({ slug, textValue = '', withIndicator = true }: { slug?: string; textValue?: string; withIndicator?: boolean }) {
  const indicator: { textContent: string } | null = withIndicator ? { textContent: '' } : null
  const textarea = makeTextarea({ slug, value: textValue })
  const root = makeRoot(indicator)
  return { root, textarea, indicator }
}

function makeFormWiring({ slug, sent, textValue = '' }: { slug?: string; sent?: string; textValue?: string }) {
  const indicator = { textContent: '' }
  const textarea = makeTextarea({ slug, sent, value: textValue })
  const form = makeRoot(indicator, textarea)
  const button = { closest: (sel: string) => (sel === 'form' ? form : null) }
  return { button, form, textarea, indicator }
}

function makeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  const calls: unknown[][] = []
  return {
    calls,
    getItem(key: string) {
      calls.push(['getItem', key])
      return store.has(key) ? (store.get(key) as string) : null
    },
    setItem(key: string, value: string) {
      calls.push(['setItem', key, value])
      store.set(key, String(value))
    },
    removeItem(key: string) {
      calls.push(['removeItem', key])
      store.delete(key)
    },
    clear() {
      calls.push(['clear'])
      store.clear()
    },
  }
}

function makeThrowingStorage() {
  const boom = () => {
    throw new Error('sessionStorage is unavailable')
  }
  return { getItem: boom, setItem: boom, removeItem: boom, clear: boom }
}

function install(name: string, value: unknown) {
  const g = globalThis as Record<string, unknown>
  const hadOwn = Object.prototype.hasOwnProperty.call(g, name)
  const previous = g[name]
  Object.defineProperty(g, name, { value, configurable: true, writable: true })
  return function restore() {
    if (hadOwn) Object.defineProperty(g, name, { value: previous, configurable: true, writable: true })
    else delete g[name]
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type WireBox = (root: unknown, textarea: unknown) => (() => void) | undefined
type WireDraft = (button: unknown) => (() => void) | undefined

function requireWireDraftBox(): WireBox {
  const fn = (SubmitButtonModule as unknown as Record<string, unknown>).wireDraftBox
  assert.equal(typeof fn, 'function', 'SubmitButton.tsx must export wireDraftBox (spec section 1.3)')
  return fn as WireBox
}

function requireWireDraft(): WireDraft {
  const fn = (SubmitButtonModule as unknown as Record<string, unknown>).wireDraft
  assert.equal(typeof fn, 'function', 'SubmitButton.tsx must keep exporting wireDraft')
  return fn as WireDraft
}

// ---------------------------------------------------------------------------
// 1. Signed-out branch of page.tsx (spec section 1.1)
// ---------------------------------------------------------------------------

test('88.1: the page imports OpenInBrowser and GuestSignIn and the signed-out branch sits inside OpenInBrowser', () => {
  const src = readPage()
  assert.match(src, /import\s*\{\s*OpenInBrowser\s*\}\s*from\s*['"][^'"]*OpenInBrowser(?:\.js)?['"]/)
  assert.match(src, /import\s*\{\s*GuestSignIn\s*\}\s*from\s*['"][^'"]*GuestSignIn(?:\.js)?['"]/)
  const region = guestBranch()
  assert.ok(region.includes('<GuestSignIn'), 'the sign-in link component must be inside <OpenInBrowser>')
})

test('88.2: the signed-out branch is not a form and not inside one; the signed-in form is not inside OpenInBrowser', () => {
  const src = readPage()
  const region = guestBranch()
  assert.ok(!/<form\b/.test(region), 'no <form> anywhere in the signed-out branch')
  const formIdx = src.search(/<form action=\{action\}>/)
  assert.ok(formIdx >= 0, 'the signed-in <form action={action}> must still exist')
  const [fs, fe] = elementSpan(src, formIdx)
  const open = src.indexOf('<OpenInBrowser')
  assert.ok(open !== -1, 'page.tsx must use <OpenInBrowser>')
  assert.ok(!(open > fs && open < fe), 'the signed-out branch must not sit inside the signed-in form')
  assert.ok(!(fs > open && fs < src.indexOf('</OpenInBrowser>')), 'the signed-in form must not sit inside OpenInBrowser')
})

test('88.3: the container is a div carrying data-compose and holds the textarea, #draft-status and the sign-in link', () => {
  const region = guestBranch()
  const attr = /\sdata-compose(?![\w-])/.exec(region)
  assert.ok(attr, 'a container with the data-compose attribute must exist in the signed-out branch')
  const open = openingTagAt(region, attr!.index)
  assert.match(region.slice(open, open + 8), /^<div\b/, 'the data-compose container must be a div')
  const [s, e] = elementSpan(region, open)
  for (const [name, idx] of [
    ['textarea', region.indexOf('<textarea')],
    ['#draft-status', region.indexOf('id="draft-status"')],
    ['GuestSignIn', region.indexOf('<GuestSignIn')],
  ] as Array<[string, number]>) {
    assert.ok(idx > s && idx < e, `${name} must be inside the data-compose container`)
  }
})

test('88.4: one textarea id="body" name="body" with data-draft-slug and maxLength 4000, rows 5, placeholder, no data-draft-sent', () => {
  const region = guestBranch()
  assert.equal(region.split('<textarea').length - 1, 1, 'exactly one textarea in the signed-out branch')
  const start = region.indexOf('<textarea')
  const tag = region.slice(start, tagEnd(region, start))
  assert.match(tag, /\bid="body"/)
  assert.match(tag, /\bname="body"/)
  assert.match(tag, /data-draft-slug=\{slug\}/)
  assert.match(tag, /maxLength=\{4000\}/)
  assert.match(tag, /rows=\{5\}/)
  assert.ok(tag.includes(`placeholder="${PLACEHOLDER}"`), 'placeholder must be the spec text')
  assert.ok(!tag.includes('data-draft-sent'), 'no data-draft-sent on the guest textarea')
  assert.ok(!region.includes('data-draft-sent'), 'no data-draft-sent anywhere in the signed-out branch')
})

test('88.5: a visually hidden label «رسالتك» for the textarea', () => {
  const region = guestBranch()
  assert.match(region, /<label\b[^>]*className="sr-only"[^>]*htmlFor="body"[^>]*>\s*رسالتك\s*<\/label>|<label\b[^>]*htmlFor="body"[^>]*className="sr-only"[^>]*>\s*رسالتك\s*<\/label>/)
})

test('88.6: the four starter chips: STARTER_PROMPTS unchanged, button type="button" data-starter-prompt rendered in the branch', () => {
  const src = readPage()
  const arr = /const STARTER_PROMPTS\s*=\s*\[([\s\S]*?)\]/.exec(src)
  assert.ok(arr, 'STARTER_PROMPTS must still exist')
  for (const p of PROMPTS) assert.ok(arr![1]!.includes(`'${p}'`), `STARTER_PROMPTS must keep: ${p}`)
  assert.equal((arr![1]!.match(/'[^']*'/g) ?? []).length, 4, 'exactly four prompts')
  const region = guestBranch()
  assert.ok(region.includes('STARTER_PROMPTS.map'), 'the branch must render STARTER_PROMPTS')
  const btn = /<button\b[^>]*data-starter-prompt[^>]*>/.exec(region)
  assert.ok(btn, 'chips must be buttons with data-starter-prompt')
  assert.match(btn![0], /type="button"/)
})

test('88.7: #draft-status with aria-live="polite" in the signed-out branch', () => {
  const region = guestBranch()
  assert.equal(region.split('id="draft-status"').length - 1, 1)
  const idx = region.indexOf('id="draft-status"')
  const tag = region.slice(openingTagAt(region, idx), tagEnd(region, openingTagAt(region, idx)))
  assert.match(tag, /aria-live="polite"/)
})

// Re-aimed for spec 5.2: the old hint is now class guest-fallback (renamed from
// guest-nojs) and the draft hint is class guest-draft__hint.
test('88.8: the two hints carry the exact spec text; the draft hint has class guest-draft__hint and the old hint has class guest-fallback', () => {
  const region = guestBranch()
  const hintAt = region.indexOf(PRIVACY_HINT)
  assert.ok(hintAt >= 0, 'the privacy hint text must match the spec exactly')
  const hintOpen = openingTagAt(region, hintAt)
  const hintTag = region.slice(hintOpen, tagEnd(region, hintOpen))
  assert.match(hintTag, /className="[^"]*(?<![\w-])guest-draft__hint(?![\w-])/, 'the draft hint element carries class guest-draft__hint')
  const at = region.indexOf(FALLBACK_HINT)
  assert.ok(at >= 0, 'the old hint text must match the spec exactly')
  const open = openingTagAt(region, at)
  const tag = region.slice(open, tagEnd(region, open))
  assert.match(tag, /className="[^"]*(?<![\w-])guest-fallback(?![\w-])/, 'the old hint element carries class guest-fallback')
  assert.ok(!/guest-nojs/.test(region), 'guest-nojs is renamed guest-fallback, nothing in the branch still uses it')
})

test('88.9: the draft block has class guest-draft and holds chips, label, textarea, status and privacy hint in that order', () => {
  const region = guestBranch()
  const m = /className="[^"]*(?<![\w-])guest-draft(?![\w-])/.exec(region)
  assert.ok(m, 'an element with class guest-draft must exist')
  const open = openingTagAt(region, m!.index)
  const [s, e] = elementSpan(region, open)
  const block = region.slice(s, e)
  assertOrder(block, [
    ['chips', block.indexOf('data-starter-prompt')],
    ['label', block.indexOf('htmlFor="body"')],
    ['textarea', block.indexOf('<textarea')],
    ['#draft-status', block.indexOf('id="draft-status"')],
    ['privacy hint', block.indexOf(PRIVACY_HINT)],
  ])
  assert.ok(!block.includes(FALLBACK_HINT), 'the old hint (guest-fallback) must sit outside the draft block')
  assert.ok(!block.includes('<GuestSignIn'), 'the sign-in link must sit outside the draft block so it shows without JS')
})

test('88.10: order in the branch is pitch, draft block, old hint, sign-in link', () => {
  const region = guestBranch()
  assertOrder(region, [
    ['pitch', indexOfRe(region, PITCH)],
    ['guest-draft', indexOfRe(region, /(?<![\w-])guest-draft(?![\w-])/)],
    ['guest-fallback', indexOfRe(region, /(?<![\w-])guest-fallback(?![\w-])/)],
    ['GuestSignIn', region.indexOf('<GuestSignIn')],
  ])
})

test('88.11: the sign-in link still targets /?next=/c/<encoded slug> with the spec label', () => {
  const combined = guestBranch() + '\n' + readGuestSignIn()
  assert.match(combined, /`\/\?next=\/c\/\$\{encodeURIComponent\(\w+\)\}`/, 'href must be /?next=/c/ plus the encoded slug')
  assert.match(combined, SIGN_IN_LABEL, 'label must be «سجل دخول وكمّل» plus the send emoji')
  assert.match(readGuestSignIn(), /<a\b/, 'GuestSignIn renders the anchor')
})

test('88.12: nothing in the signed-out branch can transmit the textarea value', () => {
  const region = withoutChipsScript(guestBranch())
  const banned = /\baction=|\bformAction\b|\bformaction\b|\bmethod=|<form\b|\bfetch\s*\(|XMLHttpRequest|sendBeacon|type="submit"|<SubmitButton|\bonSubmit\b/i
  const hit = banned.exec(region)
  assert.equal(hit, null, `forbidden in the signed-out branch: ${hit?.[0]}`)
  assert.ok(!/\.value\b/.test(region), 'the branch must not read the textarea value')
  const encodes = region.match(/encodeURIComponent\(([^)]*)\)/g) ?? []
  for (const e of encodes) assert.equal(e, 'encodeURIComponent(slug)', 'only the slug may be encoded into a URL')
})

test('88.13: the page adds no header or cookie read and no browser storage other than sessionStorage', () => {
  const src = readPage()
  assert.ok(!/next\/headers/.test(src), 'page.tsx must not import next/headers')
  assert.ok(!/localStorage|document\.cookie/.test(src))
  for (const file of [SUBMIT_BUTTON, GUEST_SIGN_IN]) {
    if (!existsSync(file)) continue
    const text = stripComments(readFileSync(file, 'utf8'))
    assert.ok(!/localStorage|document\.cookie/.test(text), `${path.basename(file)} must not use localStorage or cookies`)
  }
})

// ---------------------------------------------------------------------------
// 2. GuestSignIn (spec section 1.3)
// ---------------------------------------------------------------------------

test('88.14: GuestSignIn is a client component that exports GuestSignIn and wires wireDraftBox in an effect', () => {
  const src = readGuestSignIn()
  assert.match(src, /^\s*['"]use client['"]/, 'must be a client component')
  assert.match(src, /export\s+(?:function|const)\s+GuestSignIn\b/)
  assert.match(src, /import\s*\{[^}]*\bwireDraftBox\b[^}]*\}\s*from\s*['"][^'"]*SubmitButton(?:\.js)?['"]/)
  assert.match(src, /useEffect\(/)
  assert.match(src, /wireDraftBox\(/)
  assert.match(src, /closest\(\s*['"]\[data-compose\]['"]\s*\)/, 'finds the closest [data-compose] ancestor')
  assert.match(src, /textarea\[data-draft-slug\]/, 'finds textarea[data-draft-slug] inside it')
})

test('88.14b: GuestSignIn imports only react and ./SubmitButton.js (spec section 5.1)', () => {
  const src = readGuestSignIn()
  const sources: string[] = []
  for (const m of src.matchAll(/\b(?:import|export)\b[^;'"`]*?\bfrom\s*['"]([^'"]+)['"]/g)) sources.push(m[1]!)
  for (const m of src.matchAll(/(?:^|[;\n])\s*import\s*['"]([^'"]+)['"]/g)) sources.push(m[1]!)
  for (const m of src.matchAll(/\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]/g)) sources.push(m[1]!)
  assert.ok(sources.includes('react'), 'GuestSignIn imports react')
  assert.ok(sources.includes('./SubmitButton.js'), 'GuestSignIn imports ./SubmitButton.js')
  const extra = sources.filter((s) => s !== 'react' && s !== './SubmitButton.js')
  assert.deepEqual(extra, [], `GuestSignIn may import only react and ./SubmitButton.js, found: ${JSON.stringify(extra)}`)
})

// Re-aimed for spec 5.2 and 5.3: the effect may now set exactly one attribute,
// data-draft-ready, on the [data-compose] root and set textarea.disabled =
// false, and its cleanup may remove that same attribute. The ban on
// setAttribute( is narrowed to "any other attribute", removeAttribute( is
// allowed for data-draft-ready only; every other ban is unchanged.
test('88.15: GuestSignIn does nothing at click time: no handler, no value read, no navigation, no href change; its only writes are data-draft-ready (set, then removed in the cleanup) and textarea.disabled = false', () => {
  const src = readGuestSignIn()
  const banned = /\bonClick\b|\bonMouseDown\b|\bonPointerDown\b|addEventListener\(\s*['"](?:click|mousedown|pointerdown|touchstart)|\.value\b|preventDefault|\blocation\b|window\.open|useRouter|\brouter\b|\.href\s*=|\bfetch\s*\(|sendBeacon|XMLHttpRequest|<form\b/
  const hit = banned.exec(src)
  assert.equal(hit, null, `forbidden in GuestSignIn: ${hit?.[0]}`)
  const attrNames = [...src.matchAll(/\bsetAttribute\(\s*(['"])([^'"]*)\1/g)].map((m) => m[2])
  const attrCalls = src.match(/\bsetAttribute\(/g) ?? []
  assert.equal(attrCalls.length, attrNames.length, 'every setAttribute call names its attribute with a string literal')
  for (const name of attrNames) assert.equal(name, 'data-draft-ready', `the only attribute GuestSignIn may set is data-draft-ready, found ${name}`)
  const removeNames = [...src.matchAll(/\bremoveAttribute\(\s*(['"])([^'"]*)\1/g)].map((m) => m[2])
  assert.equal((src.match(/\bremoveAttribute\(/g) ?? []).length, removeNames.length, 'every removeAttribute call names its attribute with a string literal')
  for (const name of removeNames) assert.equal(name, 'data-draft-ready', `the only attribute GuestSignIn may remove is data-draft-ready, found ${name}`)
  for (const m of src.matchAll(/\.dataset\.(\w+)/g)) assert.equal(m[1], 'draftReady', 'dataset may only carry draftReady')
  assert.ok(!/\b(?:toggleAttribute|classList|innerHTML|outerHTML|insertAdjacent\w*|appendChild|textContent\s*=)/.test(src), 'no other DOM writes')
  for (const m of src.matchAll(/\.(\w+)\s*=(?!=)/g)) assert.equal(m[1], 'disabled', `the only property GuestSignIn may assign is disabled, found .${m[1]}`)
  for (const m of src.matchAll(/\.disabled\s*=\s*(\w+)/g)) assert.equal(m[1], 'false', 'the textarea is only ever enabled, never disabled, by the component')
})

// ---------------------------------------------------------------------------
// 3. wireDraftBox (spec section 1.3)
// ---------------------------------------------------------------------------

test('88.16: wireDraftBox is exported with (root, textarea)', () => {
  const fn = requireWireDraftBox()
  assert.equal(fn.length, 2)
})

test('88.17: wireDraftBox restores a stored draft into an empty textarea and says «تم استعادة المسودة»', () => {
  const wireDraftBox = requireWireDraftBox()
  const slug = 'box-restore'
  const storage = makeStorage({ ['confession_draft_' + slug]: 'kept text' })
  const restore = install('sessionStorage', storage)
  try {
    const { root, textarea, indicator } = makeBox({ slug })
    wireDraftBox(root, textarea)
    assert.equal(textarea.value, 'kept text')
    assert.equal(indicator?.textContent, RESTORED)
  } finally {
    restore()
  }
})

test('88.18: wireDraftBox does not overwrite text already in the box', () => {
  const wireDraftBox = requireWireDraftBox()
  const slug = 'box-keep'
  const storage = makeStorage({ ['confession_draft_' + slug]: 'stored' })
  const restore = install('sessionStorage', storage)
  try {
    const { root, textarea, indicator } = makeBox({ slug, textValue: 'typed already' })
    wireDraftBox(root, textarea)
    assert.equal(textarea.value, 'typed already')
    assert.notEqual(indicator?.textContent, RESTORED)
  } finally {
    restore()
  }
})

test('88.19: wireDraftBox autosaves to confession_draft_<slug> after the debounce and says «تم الحفظ تلقائياً», with no network call', async () => {
  const wireDraftBox = requireWireDraftBox()
  const slug = 'box-save'
  const key = 'confession_draft_' + slug
  const storage = makeStorage({})
  const fetched: unknown[] = []
  const restoreStorage = install('sessionStorage', storage)
  const restoreFetch = install('fetch', (...args: unknown[]) => {
    fetched.push(args)
    return Promise.reject(new Error('no network expected'))
  })
  try {
    const { root, textarea, indicator } = makeBox({ slug })
    wireDraftBox(root, textarea)
    textarea.value = 'something I mean'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    assert.equal(indicator?.textContent, SAVING, 'the indicator says saving right after typing')
    await sleep(40)
    assert.equal(storage.getItem(key), null, 'nothing is written before the 150 ms debounce')
    await sleep(250)
    assert.equal(storage.getItem(key), 'something I mean')
    assert.equal(indicator?.textContent, SAVED)
    assert.deepEqual(fetched, [], 'typing must not call fetch')
  } finally {
    restoreFetch()
    restoreStorage()
  }
})

test('88.20: wireDraftBox keys the draft by its own slug and leaves other slugs alone', async () => {
  const wireDraftBox = requireWireDraftBox()
  const storage = makeStorage({ confession_draft_other: 'theirs' })
  const restore = install('sessionStorage', storage)
  try {
    const { root, textarea } = makeBox({ slug: 'mine' })
    wireDraftBox(root, textarea)
    textarea.value = 'mine text'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await sleep(300)
    assert.equal(storage.getItem('confession_draft_mine'), 'mine text')
    assert.equal(storage.getItem('confession_draft_other'), 'theirs')
  } finally {
    restore()
  }
})

test('88.21: wireDraftBox survives a sessionStorage that throws, on mount and on typing', async () => {
  const wireDraftBox = requireWireDraftBox()
  const restore = install('sessionStorage', makeThrowingStorage())
  try {
    const { root, textarea } = makeBox({ slug: 'box-throw' })
    assert.doesNotThrow(() => wireDraftBox(root, textarea))
    textarea.value = 'text'
    assert.doesNotThrow(() => textarea.dispatchEvent(new Event('input', { bubbles: true })))
    await sleep(300)
  } finally {
    restore()
  }
})

test('88.22: wireDraftBox works without a #draft-status element', async () => {
  const wireDraftBox = requireWireDraftBox()
  const storage = makeStorage({ confession_draft_noind: 'x' })
  const restore = install('sessionStorage', storage)
  try {
    const { root, textarea } = makeBox({ slug: 'noind', withIndicator: false })
    assert.doesNotThrow(() => wireDraftBox(root, textarea))
    assert.equal(textarea.value, 'x')
    textarea.value = 'y'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await sleep(300)
    assert.equal(storage.getItem('confession_draft_noind'), 'y')
  } finally {
    restore()
  }
})

test('88.23: the cleanup wireDraftBox returns removes the input listener', async () => {
  const wireDraftBox = requireWireDraftBox()
  const storage = makeStorage({})
  const restore = install('sessionStorage', storage)
  try {
    const { root, textarea } = makeBox({ slug: 'box-clean' })
    const before = (textarea.listeners.get('input') ?? []).length
    const cleanup = wireDraftBox(root, textarea)
    assert.equal(typeof cleanup, 'function')
    assert.ok((textarea.listeners.get('input') ?? []).length > before, 'an input listener was added')
    cleanup?.()
    assert.equal((textarea.listeners.get('input') ?? []).length, before, 'cleanup removes it')
    textarea.value = 'after cleanup'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await sleep(300)
    assert.equal(storage.getItem('confession_draft_box-clean'), null)
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// 4. wireDraft keeps its week 22 behaviour (spec sections 1.3 and 2)
// ---------------------------------------------------------------------------

test('88.24: wireDraft delegates the restore and autosave to wireDraftBox and keeps the data-draft-sent removal', () => {
  const src = stripComments(readFileSync(SUBMIT_BUTTON, 'utf8'))
  assert.match(src, /export\s+function\s+wireDraftBox\s*\(/)
  const start = src.search(/export\s+function\s+wireDraft\s*\(/)
  assert.ok(start >= 0, 'wireDraft must stay exported')
  const next = src.indexOf('export function SubmitButton', start)
  const body = src.slice(start, next)
  assert.ok(/wireDraftBox\(/.test(body), 'wireDraft must call wireDraftBox')
  assert.match(body, /data-draft-sent/)
  assert.match(body, /removeItem\(\s*'confession_draft_'/)
})

test('88.25: wireDraft with data-draft-sent="1" removes the key and restores nothing', () => {
  const wireDraft = requireWireDraft()
  const slug = 'wd-sent'
  const storage = makeStorage({ ['confession_draft_' + slug]: 'old', confession_draft_keep: 'keep' })
  const restore = install('sessionStorage', storage)
  try {
    const { button, textarea, indicator } = makeFormWiring({ slug, sent: '1' })
    wireDraft(button)
    assert.equal(storage.getItem('confession_draft_' + slug), null)
    assert.equal(storage.getItem('confession_draft_keep'), 'keep')
    assert.equal(textarea.value, '')
    assert.notEqual(indicator.textContent, RESTORED)
  } finally {
    restore()
  }
})

test('88.26: wireDraft restores into an empty box, dispatches input, and does not overwrite typed text', () => {
  const wireDraft = requireWireDraft()
  const slug = 'wd-restore'
  const storage = makeStorage({ ['confession_draft_' + slug]: 'restored' })
  const restore = install('sessionStorage', storage)
  try {
    const a = makeFormWiring({ slug })
    let seen = false
    a.textarea.addEventListener('input', () => {
      seen = true
    })
    wireDraft(a.button)
    assert.equal(a.textarea.value, 'restored')
    assert.equal(a.indicator.textContent, RESTORED)
    assert.ok(seen, 'an input event follows the restore')

    const b = makeFormWiring({ slug, textValue: 'typed' })
    wireDraft(b.button)
    assert.equal(b.textarea.value, 'typed')
  } finally {
    restore()
  }
})

test('88.27: wireDraft still autosaves, clears the indicator on submit, and its cleanup removes input and submit listeners', async () => {
  const wireDraft = requireWireDraft()
  const slug = 'wd-save'
  const storage = makeStorage({})
  const restore = install('sessionStorage', storage)
  try {
    const { button, form, textarea, indicator } = makeFormWiring({ slug })
    const inputBefore = (textarea.listeners.get('input') ?? []).length
    const submitBefore = (form.listeners.get('submit') ?? []).length
    const cleanup = wireDraft(button)
    assert.equal(typeof cleanup, 'function')
    textarea.value = 'hello'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await sleep(300)
    assert.equal(storage.getItem('confession_draft_' + slug), 'hello')
    assert.equal(indicator.textContent, SAVED)
    form.dispatchEvent({ type: 'submit' })
    assert.equal(indicator.textContent, '')
    cleanup?.()
    assert.equal((textarea.listeners.get('input') ?? []).length, inputBefore)
    assert.equal((form.listeners.get('submit') ?? []).length, submitBefore)
  } finally {
    restore()
  }
})

test('88.28: wireDraft with no button, no form, no textarea or no slug touches no storage', () => {
  const wireDraft = requireWireDraft()
  const storage = makeStorage({})
  const restore = install('sessionStorage', storage)
  try {
    assert.equal(wireDraft(null), undefined)
    assert.equal(wireDraft({ closest: () => null }), undefined)
    const noTextarea = { closest: () => makeRoot(null, null) }
    assert.equal(wireDraft(noTextarea), undefined)
    assert.equal(wireDraft(makeFormWiring({}).button), undefined)
    assert.deepEqual(storage.calls, [])
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// 5. Starter chips (spec section 1.4)
// ---------------------------------------------------------------------------

test('88.29: the starter-chips script uses closest(\'form,[data-compose]\'), is otherwise unchanged, and is rendered once', () => {
  const src = readPage()
  const ids = src.match(/id="starter-chips"/g) ?? []
  assert.equal(ids.length, 1, 'the starter-chips script is rendered once')
  const dispatch = "ta.dispatchEvent(new Event('input',{bubbles:true}))"
  assert.equal(src.split(dispatch).length - 1, 1, 'the input dispatch appears once')
  assert.ok(src.includes(NEW_CHIPS_SCRIPT), 'the script must equal the week 23 text with closest(\'form,[data-compose]\') as the only change')
  assert.ok(!src.includes("var f=t.closest('form');"), 'the old form-only lookup is gone')
})

test('88.30: the starter-chips script is reachable by a signed-out visitor, not only inside the signed-in form', () => {
  const src = readPage()
  const formIdx = src.search(/<form action=\{action\}>/)
  assert.ok(formIdx >= 0)
  const [fs, fe] = elementSpan(src, formIdx)
  const outsideForm = src.slice(0, fs) + src.slice(fe)
  const reachable = guestBranch().includes('id="starter-chips"') || outsideForm.includes('id="starter-chips"')
  assert.ok(reachable, 'a guest must get the script that makes the chips work')
})

function extractChipsScript(): string {
  const src = readPage()
  const m = /id="starter-chips"[\s\S]*?__html:\s*`([\s\S]*?)`/.exec(src)
  assert.ok(m, 'the starter-chips script text must be in page.tsx')
  return m![1]!
}

// ---------------------------------------------------------------------------
// 6. Chromium: the chips script on a form and on a data-compose div, and the
// no-JS stylesheet rules (spec sections 1.2, 1.4, 4 item 5)
// ---------------------------------------------------------------------------

let browser: Browser

before(async () => {
  browser = await chromium.launch()
})

after(async () => {
  if (browser) await browser.close()
})

async function runChips(wrapperOpen: string, wrapperClose: string) {
  const script = extractChipsScript()
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    await page.setContent(
      `<!DOCTYPE html><html><body>${wrapperOpen}<button type="button" data-starter-prompt="chip text">chip text</button><textarea name="body"></textarea>${wrapperClose}</body></html>`,
    )
    await page.evaluate(() => {
      ;(window as unknown as { inputs: number }).inputs = 0
      document.querySelector('textarea')!.addEventListener('input', () => {
        ;(window as unknown as { inputs: number }).inputs += 1
      })
    })
    await page.addScriptTag({ content: script })
    await page.click('button[data-starter-prompt]')
    return await page.evaluate(() => ({
      value: document.querySelector('textarea')!.value,
      inputs: (window as unknown as { inputs: number }).inputs,
    }))
  } finally {
    await context.close()
  }
}

test('88.31: in Chromium a chip fills a textarea inside a data-compose div and fires input', async () => {
  const r = await runChips('<div data-compose>', '</div>')
  assert.equal(r.value, 'chip text')
  assert.equal(r.inputs, 1)
})

test('88.32: in Chromium a chip still fills a textarea inside a form and fires input', async () => {
  const r = await runChips('<form onsubmit="return false">', '</form>')
  assert.equal(r.value, 'chip text')
  assert.equal(r.inputs, 1)
})

// Re-aimed for spec 5.2: .guest-nojs is renamed .guest-fallback and is no
// longer display: none by default; .guest-draft__hint is hidden by default and
// shown on [data-draft-ready]; the scripting: none block still hides
// .guest-draft. What each rule does to the page is proved in Chromium below;
// this test pins the stylesheet's shape.
function cssRules(css: string): { media: Array<{ query: string; rules: Array<[string, string]> }>; top: Array<[string, string]> } {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const top: Array<[string, string]> = []
  const media: Array<{ query: string; rules: Array<[string, string]> }> = []
  let i = 0
  while (i < src.length) {
    const open = src.indexOf('{', i)
    if (open === -1) break
    const head = src.slice(i, open).trim()
    let depth = 0
    let end = open
    for (let k = open; k < src.length; k += 1) {
      if (src[k] === '{') depth += 1
      else if (src[k] === '}') {
        depth -= 1
        if (depth === 0) {
          end = k
          break
        }
      }
    }
    const body = src.slice(open + 1, end)
    if (head.startsWith('@media')) {
      const rules: Array<[string, string]> = []
      for (const m of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) rules.push([m[1]!.trim(), m[2]!])
      media.push({ query: head, rules })
    } else if (!head.startsWith('@')) top.push([head, body])
    i = end + 1
  }
  return { media, top }
}

const HIDES = /display\s*:\s*none/

test('88.33: globals.css hides .guest-draft under scripting: none, keeps .guest-fallback visible by default, hides .guest-draft__hint until [data-draft-ready]', () => {
  const css = readFileSync(GLOBALS_CSS, 'utf8')
  assert.ok(!/guest-nojs/.test(css), '.guest-nojs is renamed .guest-fallback, no rule may still name it')
  const { media, top } = cssRules(css)
  const scripting = media.filter((m) => /\(\s*scripting\s*:\s*none\s*\)/.test(m.query))
  assert.equal(scripting.length, 1, 'one @media (scripting: none) block')
  const inBlock = scripting[0]!.rules
  assert.ok(inBlock.some(([sel, body]) => sel.split(',').map((s) => s.trim()).includes('.guest-draft') && HIDES.test(body)), 'the block hides .guest-draft')
  assert.ok(!inBlock.some(([sel, body]) => /\.guest-fallback/.test(sel) && HIDES.test(body)), 'the block does not hide .guest-fallback')

  const fallbackDefault = top.filter(([sel]) => sel.split(',').map((s) => s.trim()).includes('.guest-fallback'))
  assert.ok(!fallbackDefault.some(([, body]) => HIDES.test(body)), '.guest-fallback has no default display: none')

  const hintDefault = top.filter(([sel]) => /\.guest-draft__hint/.test(sel) && !/data-draft-ready/.test(sel))
  assert.ok(hintDefault.some(([, body]) => HIDES.test(body)), '.guest-draft__hint is display: none by default')

  const onReady = top.filter(([sel]) => /\[data-draft-ready\]/.test(sel))
  assert.ok(onReady.some(([sel, body]) => /\.guest-draft__hint/.test(sel) && !HIDES.test(body) && /display\s*:/.test(body)), 'a [data-draft-ready] rule shows .guest-draft__hint')
  assert.ok(onReady.some(([sel, body]) => /\.guest-fallback/.test(sel) && HIDES.test(body)), 'a [data-draft-ready] rule hides .guest-fallback')
})

function fixtureWithCss(): string {
  assert.ok(existsSync(FIXTURE), 'fixture test/fixtures/w36/guest-signed-out.html must exist')
  const html = readFileSync(FIXTURE, 'utf8')
  const css = readFileSync(GLOBALS_CSS, 'utf8')
  const idx = html.indexOf('</head>')
  assert.ok(idx !== -1, 'fixture must contain </head>')
  return html.slice(0, idx) + '<style>' + css + '</style>' + html.slice(idx)
}

// The signed-out markup the page really renders, in a document with the real
// stylesheet, next to the hand-written fixture: the fixture cannot drift from
// the page without one of the two failing.
function liveWithCss(): string {
  const guest = renderedPages().guest
  assert.ok(guest && !guest.startsWith('THREW'), `the page must render for a signed-out viewer: ${guest?.slice(0, 200)}`)
  const css = readFileSync(GLOBALS_CSS, 'utf8')
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><main>${guest}</main></body></html>`
}

const CSS_SOURCES: Array<[string, () => string]> = [
  ['fixture', fixtureWithCss],
  ['rendered page', liveWithCss],
]

test('88.34: the fixture carries no script', () => {
  assert.ok(!/<script/i.test(readFileSync(FIXTURE, 'utf8')))
})

async function visibility(html: string, opts: { js: boolean; ready: boolean }) {
  const context = await browser.newContext({ javaScriptEnabled: opts.js, viewport: { width: 390, height: 844 } })
  try {
    const page = await context.newPage()
    await page.setContent(html)
    if (opts.ready) await page.evaluate(() => document.querySelector('[data-compose]')!.setAttribute('data-draft-ready', ''))
    const vis = async (selector: string) => {
      const loc = page.locator(selector)
      assert.equal(await loc.count(), 1, `${selector} must match exactly one element`)
      return loc.isVisible()
    }
    return {
      textarea: await vis('textarea'),
      chips: await page.locator('.starter-chip').first().isVisible(),
      status: await vis('#draft-status'),
      draftHint: await vis('.guest-draft__hint'),
      fallback: await vis('.guest-fallback'),
      link: await vis('a[href^="/?next=/c/"]'),
    }
  } finally {
    await context.close()
  }
}

test('88.35: in Chromium with JavaScript on and no data-draft-ready the box shows, the old hint shows and the draft hint does not', async () => {
  for (const [name, html] of CSS_SOURCES) {
    const v = await visibility(html(), { js: true, ready: false })
    assert.equal(v.textarea, true, `${name}: textarea visible`)
    assert.equal(v.chips, true, `${name}: chips visible`)
    assert.equal(v.fallback, true, `${name}: old hint (guest-fallback) visible`)
    assert.equal(v.draftHint, false, `${name}: draft hint (guest-draft__hint) hidden`)
    assert.equal(v.link, true, `${name}: sign-in link visible`)
  }
})

test('88.35b: in Chromium with JavaScript on and data-draft-ready on the root the draft hint shows and the old hint does not', async () => {
  for (const [name, html] of CSS_SOURCES) {
    const v = await visibility(html(), { js: true, ready: true })
    assert.equal(v.textarea, true, `${name}: textarea visible`)
    assert.equal(v.draftHint, true, `${name}: draft hint (guest-draft__hint) visible`)
    assert.equal(v.fallback, false, `${name}: old hint (guest-fallback) hidden`)
    assert.equal(v.link, true, `${name}: sign-in link visible`)
  }
})

test('88.36: in Chromium with JavaScript off there is no visible textarea, the old hint and the link show', async () => {
  for (const [name, html] of CSS_SOURCES) {
    const v = await visibility(html(), { js: false, ready: false })
    assert.equal(v.textarea, false, `${name}: textarea hidden`)
    assert.equal(v.chips, false, `${name}: chips hidden`)
    assert.equal(v.status, false, `${name}: status hidden`)
    assert.equal(v.draftHint, false, `${name}: draft hint hidden`)
    assert.equal(v.fallback, true, `${name}: old hint (guest-fallback) visible`)
    assert.equal(v.link, true, `${name}: sign-in link visible`)
  }
})

// ---------------------------------------------------------------------------
// 7. Section 2: what must not change, pinned from source
// ---------------------------------------------------------------------------

test('88.37: sendConfessionAction binding and the signed-in form are unchanged', () => {
  const src = readPage()
  assert.match(src, /const action = sendConfessionAction\.bind\(null, slug\)/)
  const formIdx = src.search(/<form action=\{action\}>/)
  assert.ok(formIdx >= 0)
  const [fs, fe] = elementSpan(src, formIdx)
  const form = src.slice(fs, fe)
  assert.match(form, /<SubmitButton className="btn btn--primary btn--block" loadingText="عم يبعت...">/)
  assert.match(form, /<textarea[\s\S]*?id="body"[\s\S]*?name="body"[\s\S]*?data-draft-slug=\{slug\}[\s\S]*?data-draft-sent=\{sent === '1' \? '1' : undefined\}[\s\S]*?required[\s\S]*?minLength=\{1\}[\s\S]*?maxLength=\{4000\}/)
  assert.ok(form.includes('id="draft-status"'))
  assert.ok(!form.includes('guest-draft') && !form.includes('data-compose'), 'the signed-in form carries no guest markup')
})

test('88.38: the signed-in form keeps the sent key wrapper and the ?sent=1 draft cleanup script', () => {
  const src = readPage()
  assert.match(src, /<Fragment key=\{sent === '1' \? randomUUID\(\) : 'compose'\}>/)
  // Re-aimed for spec 5.2 (F5): the sent block's condition now also names the
  // viewer, so the old "sent === '1' && (" opening is no longer required. The
  // cleanup script itself, and that it hangs off sent === '1', are unchanged.
  assert.match(src, /\{[^{}()]*\bsent === '1'[^{}()]*&&\s*\(\s*<>[\s\S]*?sessionStorage\.removeItem\('confession_draft_\$\{slug\}'\)/)
})

test('88.39: the SubmitButton signature and pending behaviour are unchanged', () => {
  const src = readFileSync(SUBMIT_BUTTON, 'utf8')
  assert.match(src, /export function SubmitButton\(\{\s*children,\s*className,\s*loadingText,\s*\}: \{\s*children: ReactNode\s*className\?: string\s*loadingText\?: string\s*\}\)/)
  assert.match(src, /useFormStatus\(\)/)
  assert.match(src, /useEffect\(\(\) => wireDraft\(buttonRef\.current\), \[\]\)/)
  assert.match(src, /disabled=\{pending\}/)
  assert.match(src, /aria-busy=\{pending\}/)
})

test('88.40: the owner view and the disabled-link view are unchanged', () => {
  const src = readPage()
  assert.ok(src.includes('<p className="hint">ما فيك تصارح حالك، هيدا رابطك إنت.</p>'))
  assert.ok(src.includes('<p>هالرابط مش عم يستقبل رسايل هلق.</p>'))
  assert.ok(src.includes('<p>صاحبه طفّاه لفترة. فيك ترجع بعدين، أو تفتح صندوقك وتخلي رفقاتك يصارحوك.</p>'))
  assert.match(src, /<a className="btn btn--secondary btn--sm" href="\/inbox">\s*افتح صندوقك السري\s*<\/a>/)
  const spans: Array<[number, number]> = []
  const re = /<OpenInBrowser\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) spans.push(elementSpan(src, m.index))
  for (const needle of ['<p className="hint">ما فيك تصارح حالك', '<p>هالرابط مش عم يستقبل رسايل هلق.</p>']) {
    const at = src.indexOf(needle)
    assert.ok(at >= 0)
    assert.ok(!spans.some(([s, e]) => at > s && at < e), 'the owner and disabled views are not inside OpenInBrowser')
  }
})

test('88.41: the landing page keeps its own OpenInBrowser', () => {
  const landing = path.join(APP_DIR, 'page.tsx')
  assert.ok(existsSync(landing))
  assert.match(readFileSync(landing, 'utf8'), /<OpenInBrowser>/)
})

// ---------------------------------------------------------------------------
// 8. Spec section 5.2: review pass 1
// ---------------------------------------------------------------------------

type ProbeResult = { status: number | null; stderr: string; report: any }
const probeCache = new Map<string, ProbeResult>()

function runProbe(file: string): ProbeResult {
  const cached = probeCache.get(file)
  if (cached) return cached
  const result = spawnSync('node', ['--import', 'tsx', '--experimental-test-module-mocks', path.join(FIXTURE_DIR, file)], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
    timeout: 120_000,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://user:pass@localhost:1/confession',
      SESSION_SECRET: 'w'.repeat(32),
      APP_ORIGIN: 'http://localhost:3000',
    },
  })
  const line = (result.stdout ?? '').split('\n').find((l) => l.startsWith('W36_REPORT '))
  const out: ProbeResult = {
    status: result.status,
    stderr: result.stderr ?? '',
    report: line ? JSON.parse(line.slice('W36_REPORT '.length)) : null,
  }
  probeCache.set(file, out)
  return out
}

function probeReport(file: string): any {
  const r = runProbe(file)
  assert.ok(r.report, `${file} must print a report; exit ${r.status}; stderr:\n${r.stderr.slice(-1500)}`)
  return r.report
}

function renderedPages(): Record<'guest' | 'guestSent' | 'user' | 'userSent', string> {
  return probeReport('probe-page.mts')
}

// F1 -------------------------------------------------------------------------

type LogoutRun = { threw?: string; status?: number; location?: string | null; clearSiteData?: string | null; setCookie?: unknown; calls?: unknown[][] }
function logoutReports(): { sid: string; withSid: LogoutRun; noSid: LogoutRun; otherCookie: LogoutRun } {
  return probeReport('probe-logout.mts')
}

// Re-aimed for spec 5.3: Clear-Site-Data is sent only when the request carries
// the session cookie. The 303, the Location and the exact header value are
// asserted for the request that has it, as before; the probe now passes a
// request (Next always does) with the cookie in both cookies() and the Cookie
// header, so a handler may read either.
test('88.42 (5.2 F1, 5.3): POST /auth/logout for a request carrying the session cookie answers 303 with Location "/" and Clear-Site-Data exactly "\\"storage\\""', () => {
  const res = logoutReports().withSid
  assert.equal(res.threw, undefined, `the handler must return a response, not throw (a redirect() throws): ${res.threw}`)
  assert.equal(res.status, 303, 'status')
  assert.equal(res.location, '/', 'Location is the relative path /')
  assert.equal(res.clearSiteData, '"storage"', 'Clear-Site-Data is exactly "storage" with the quotes')
})

test('88.42b (5.3): a request without the session cookie still gets 303 and Location "/" but no Clear-Site-Data header', () => {
  const r = logoutReports()
  // Control: the same handler does send the header when the cookie is there.
  assert.equal(r.withSid.clearSiteData, '"storage"', 'control: with the cookie the header is sent')
  for (const [name, res] of [['no cookie at all', r.noSid], ['only an unrelated cookie', r.otherCookie]] as const) {
    assert.equal(res.threw, undefined, `${name}: the handler must return a response: ${res.threw}`)
    assert.equal(res.status, 303, `${name}: status`)
    assert.equal(res.location, '/', `${name}: Location`)
    assert.equal(res.clearSiteData, null, `${name}: no Clear-Site-Data header`)
  }
})

test('88.43 (5.2 F1): POST /auth/logout deletes the session cookie with or without the cookie on the request', () => {
  const r = logoutReports()
  const cleared = (res: LogoutRun): boolean => {
    const calls: unknown[][] = res.calls ?? []
    const viaStore = calls.some((c) => {
      if (c[0] === 'delete') return c[1] === r.sid || (typeof c[1] === 'object' && c[1] !== null && (c[1] as any).name === r.sid)
      if (c[0] !== 'set') return false
      const named = typeof c[1] === 'object' && c[1] !== null ? (c[1] as any) : { name: c[1], value: c[2], ...(c[3] as object) }
      const opts = typeof c[1] === 'object' && c[1] !== null ? named : { ...(c[3] as any) }
      return named.name === r.sid && named.value === '' && (opts.maxAge === 0 || (opts.expires !== undefined && new Date(opts.expires).getTime() <= 1000))
    })
    const header = ([] as string[]).concat((res.setCookie as string | string[] | null) ?? []).join('\n')
    const viaHeader = new RegExp(`(^|\\n)${r.sid}=;`).test(header) && /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(header)
    return viaStore || viaHeader
  }
  for (const [name, res] of [['with the cookie', r.withSid], ['without it', r.noSid], ['with an unrelated cookie', r.otherCookie]] as const) {
    assert.equal(res.threw, undefined, `${name}: the handler must return a response: ${res.threw}`)
    assert.ok(cleared(res), `${name}: the session cookie "${r.sid}" must be deleted; saw ${JSON.stringify(res)}`)
  }
})

test('88.44 (5.2 F1): the redirect target does not come from the request: Location is "/" whatever the request URL says, and the source never reads request.url', () => {
  const r = logoutReports()
  for (const [name, res] of [['with the cookie', r.withSid], ['without it', r.noSid]] as const) {
    assert.equal(res.location, '/', `${name}: a request whose URL is http://0.0.0.0:3000/auth/logout still gets Location /`)
    assert.ok(!/^[a-z][a-z0-9+.-]*:/i.test(String(res.location)), `${name}: the Location is relative`)
  }
  const src = stripComments(readFileSync(LOGOUT_ROUTE, 'utf8'))
  assert.ok(!/\.url\b/.test(src), 'app/auth/logout/route.ts must not read a request URL (the rule test/17 pins for the admin logout)')
})

// F2, F3 ---------------------------------------------------------------------

function guestTextareaTag(markup: string): string {
  const m = /<textarea\b[^>]*>/.exec(markup)
  assert.ok(m, 'the markup must contain a textarea')
  return m![0]
}

test('88.45 (5.2 F2): the signed-out textarea renders disabled, the signed-in one does not', () => {
  const pages = renderedPages()
  assert.ok(!pages.guest.startsWith('THREW'), pages.guest.slice(0, 300))
  assert.match(guestTextareaTag(pages.guest), /\sdisabled(?=[\s=>/])(?!=\s*"?false)/, 'the guest textarea carries disabled in the server markup')
  assert.ok(!/\sdisabled\b/.test(guestTextareaTag(pages.user)), 'the signed-in textarea is not disabled')
  const src = guestBranch()
  const start = src.indexOf('<textarea')
  const tag = src.slice(start, tagEnd(src, start))
  assert.match(tag, /\sdisabled(?![\w-])(?!=\{false\})/, 'the guest textarea in page.tsx carries disabled')
})

test('88.46 (5.2 F2): the server markup of the signed-out page carries both hints and no data-draft-ready, so before any script runs the old hint is the visible one', () => {
  const guest = renderedPages().guest
  assert.match(guest, /class="[^"]*(?<![\w-])guest-fallback(?![\w-])[^"]*"[^>]*>تسجيل الدخول بياخد ثواني، وبعدها منرجعك لهون لتكتب رسالتك\./)
  assert.match(guest, /class="[^"]*(?<![\w-])guest-draft__hint(?![\w-])[^"]*"[^>]*>رسالتك بتضل على جهازك/)
  assert.ok(!/data-draft-ready/.test(guest), 'the server markup never carries data-draft-ready')
})

type EffectRun = {
  log: string[]
  logAfterCleanup: string[]
  threw: string | null
  returned: string
  effectCount: number
  disabledAfter: boolean
  storageAfter: Record<string, string>
  attrAfterMount: boolean
  attrAfterCleanup: boolean
  cleanupThrew: string | null
}
const effectReports = () => probeReport('probe-guest-effect.mts') as Record<'ok' | 'throwSet' | 'throwRemove' | 'noCleanup' | 'existing', EffectRun>

const READY = 'root.attr data-draft-ready'
const ENABLE = 'textarea.disabled=false'

test('88.47 (5.2 F3): the effect writes and removes a probe key, then wires the box, and only then sets data-draft-ready and enables the textarea', () => {
  const run = effectReports().ok
  assert.equal(run.threw, null, `the effect must not throw: ${run.threw}`)
  assert.ok(run.effectCount >= 1, 'GuestSignIn registers an effect')
  const set = run.log.findIndex((l) => l.startsWith('storage.setItem '))
  assert.ok(set >= 0, `the effect must write a probe key to sessionStorage; log: ${JSON.stringify(run.log)}`)
  const key = run.log[set]!.slice('storage.setItem '.length)
  const remove = run.log.indexOf(`storage.removeItem ${key}`)
  const wire = run.log.indexOf('wire')
  const ready = run.log.indexOf(READY)
  const enable = run.log.indexOf(ENABLE)
  assert.ok(remove > set, 'the probe key is removed again after it is written')
  assert.ok(wire > remove, 'wireDraftBox runs after the probe has been written and removed')
  assert.ok(ready > wire, 'data-draft-ready is set after wireDraftBox returned')
  assert.ok(enable > wire, 'textarea.disabled = false happens after wireDraftBox returned')
  assert.equal(run.log.filter((l) => l === READY).length, 1, 'data-draft-ready is set once')
  assert.equal(run.disabledAfter, false, 'the textarea ends enabled')
  assert.equal(run.log.filter((l) => /^(root|textarea)\.(attr|removeAttr) /.test(l) && l !== READY).length, 0, 'no attribute other than data-draft-ready is touched')
  assert.notEqual(key, 'confession_draft_abc', 'the probe key is not the draft key')
})

// Spec 5.3: React reuses the [data-compose] element when OpenInBrowser swaps to
// its escape card, so the attribute set by hand must not outlive the effect.
test('88.55 (5.3): the effect cleanup removes data-draft-ready from the [data-compose] root and still runs the wiring cleanup', () => {
  const run = effectReports().ok
  assert.equal(run.threw, null)
  assert.equal(run.returned, 'function', 'the effect returns a cleanup')
  assert.equal(run.attrAfterMount, true, 'control: the attribute is on the root after mount')
  assert.equal(run.cleanupThrew, null, `the cleanup must not throw: ${run.cleanupThrew}`)
  assert.equal(run.attrAfterCleanup, false, `data-draft-ready is gone after the cleanup; cleanup log: ${JSON.stringify(run.logAfterCleanup)}`)
  assert.ok(run.logAfterCleanup.includes('cleanup'), 'the wireDraftBox cleanup is still called')
})

for (const which of ['throwSet', 'throwRemove'] as const) {
  test(`88.48${which === 'throwSet' ? 'a' : 'b'} (5.2 F3): when sessionStorage.${which === 'throwSet' ? 'setItem' : 'removeItem'} throws the box stays disabled and data-draft-ready is not set`, () => {
    const reports = effectReports()
    // Control: the same fake DOM with a working storage does become ready, so
    // the absence below is the effect declining and not the probe missing.
    assert.ok(reports.ok.log.includes(READY) && reports.ok.log.includes(ENABLE), 'control: a working storage enables the box')
    const run = reports[which]
    assert.equal(run.threw, null, `the exception is caught inside the effect: ${run.threw}`)
    assert.ok(!run.log.includes(READY), `data-draft-ready must not be set; log: ${JSON.stringify(run.log)}`)
    assert.ok(!run.log.includes(ENABLE), 'textarea.disabled = false must not run')
    assert.equal(run.disabledAfter, true, 'the textarea stays disabled')
  })
}

test('88.49 (5.2 F3): when wireDraftBox returns no cleanup the box stays disabled and data-draft-ready is not set', () => {
  const reports = effectReports()
  assert.ok(reports.ok.log.includes(READY), 'control: with a cleanup the box is enabled')
  const run = reports.noCleanup
  assert.equal(run.threw, null)
  assert.ok(run.log.includes('wire'), 'wireDraftBox was reached')
  assert.ok(!run.log.includes(READY), 'data-draft-ready is not set without a cleanup')
  assert.ok(!run.log.includes(ENABLE), 'the textarea is not enabled without a cleanup')
  assert.equal(run.disabledAfter, true)
})

test('88.50 (5.2 F3): the probe leaves a stored draft alone (its key is not the draft key)', () => {
  const run = effectReports().existing
  assert.equal(run.threw, null)
  assert.equal(run.storageAfter.confession_draft_abc, 'kept text', 'the stored draft survives the probe')
  assert.ok(!run.log.some((l) => /^storage\.(setItem|removeItem|clear)\b.*confession_draft_abc|^storage\.clear/.test(l)), 'the probe does not write, remove or clear the draft key')
  assert.ok(run.log.includes(READY), 'a stored draft does not stop the box from being enabled')
})

test('88.51 (5.2 F2/F3): GuestSignIn source: probe in try/catch before wireDraftBox, enabling after it', () => {
  const src = readGuestSignIn()
  const set = src.search(/sessionStorage\.setItem\(/)
  const remove = src.search(/sessionStorage\.removeItem\(/)
  const wire = src.search(/wireDraftBox\(/)
  const ready = src.search(/data-draft-ready|draftReady/)
  const enable = src.search(/\.disabled\s*=\s*false/)
  assertOrder(src, [
    ['setItem probe', set],
    ['removeItem probe', remove],
    ['wireDraftBox call', wire],
    ['data-draft-ready', ready],
  ])
  assert.ok(enable > wire, 'textarea.disabled = false comes after the wireDraftBox call')
  const tryAt = src.search(/\btry\s*\{/)
  assert.ok(tryAt >= 0 && tryAt < set, 'a try block opens before the probe write')
  assert.match(src, /\bcatch\b/, 'the probe has a catch')
  const catchAt = src.search(/\bcatch\b/)
  assert.ok(catchAt > remove, 'the catch closes over the probe write and removal')
})

// F5 -------------------------------------------------------------------------

test('88.52 (5.2 F5): ?sent=1 renders the delivered notice, the draft removal and the reciprocal card only for a signed-in viewer', () => {
  const pages = renderedPages()
  for (const name of ['guest', 'guestSent', 'user', 'userSent'] as const) assert.ok(!pages[name].startsWith('THREW'), `${name}: ${pages[name].slice(0, 300)}`)
  // Control: the signed-in viewer still gets the block, so the guest result
  // below is the gate and not a page that stopped rendering it for everyone.
  assert.ok(pages.userSent.includes('الرسالة وصلت'), 'control: a signed-in viewer with ?sent=1 still sees the notice')
  assert.ok(pages.userSent.includes("sessionStorage.removeItem('confession_draft_abc')"), 'control: and the draft removal script')
  assert.ok(pages.userSent.includes('reciprocal-card'), 'control: and the reciprocal card')
  assert.ok(!pages.guestSent.includes('الرسالة وصلت'), 'a signed-out viewer with ?sent=1 is not told the message arrived')
  assert.ok(!pages.guestSent.includes('removeItem'), 'a signed-out viewer with ?sent=1 does not get the draft removal script')
  assert.ok(!pages.guestSent.includes('reciprocal-card'), 'nor the reciprocal card')
  assert.ok(pages.guestSent.includes('data-compose'), 'a signed-out viewer with ?sent=1 still gets the guest box')
})

// F6 -------------------------------------------------------------------------

test('88.53 (5.2 F6a): no form attribute on the guest textarea or on any element of the signed-out branch', () => {
  const guest = renderedPages().guest
  assert.ok(!guest.startsWith('THREW'), guest.slice(0, 300))
  assert.ok(guest.includes('data-compose'), 'control: the guest box is in the markup')
  const hit = /\s(?:form|formaction|formmethod|formtarget|formenctype)\s*=/i.exec(guest)
  assert.equal(hit, null, `no element of the rendered signed-out page may carry ${hit?.[0]}`)
  const src = withoutChipsScript(guestBranch())
  const srcHit = /\s(?:form|formAction|formMethod|formTarget|formEncType)\s*=/.exec(src)
  assert.equal(srcHit, null, `no element of the signed-out branch source may carry ${srcHit?.[0]}`)
})

type OibState = { hasBox: boolean; hasEscape: boolean; hasOverrideLabel: boolean }
type OibRun = { before: OibState; hasOverrideButton: boolean; after: OibState | null }

test('88.54 (5.2 F6b): OpenInBrowser returns its children outside an in-app browser and renders the escape inside one, until the override is pressed', () => {
  const r = probeReport('probe-open-in-browser.mts') as Record<'desktop' | 'instagramIos' | 'facebookAndroid', OibRun>
  assert.deepEqual(r.desktop.before, { hasBox: true, hasEscape: false, hasOverrideLabel: false }, 'a normal browser gets the children and no escape')
  for (const name of ['instagramIos', 'facebookAndroid'] as const) {
    const run = r[name]
    assert.equal(run.before.hasBox, false, `${name}: the children are not rendered inside an in-app browser`)
    assert.equal(run.before.hasEscape, true, `${name}: the escape «افتح بالمتصفح» is rendered`)
    assert.equal(run.hasOverrideButton, true, `${name}: the override «جرّب تسجيل الدخول هون على كل حال» is a pressable control`)
    assert.ok(run.after, `${name}: the override could be pressed`)
    assert.equal(run.after!.hasBox, true, `${name}: after the override the children are rendered`)
    assert.equal(run.after!.hasEscape, false, `${name}: after the override the escape is gone`)
  }
})
