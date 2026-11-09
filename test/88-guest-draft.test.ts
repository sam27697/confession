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
// Run with PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
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
const FIXTURE = path.join(REPO_ROOT, 'test', 'fixtures', 'w36', 'guest-signed-out.html')

const PRIVACY_HINT = 'رسالتك بتضل على جهازك وما بتوصلنا قبل ما تكبس ابعت. سجّل دخول ومنرجعك لهون لتبعتها.'
const NOJS_HINT = 'تسجيل الدخول بياخد ثواني، وبعدها منرجعك لهون لتكتب رسالتك.'
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

test('88.8: the two hints carry the exact spec text and the nojs hint has class guest-nojs', () => {
  const region = guestBranch()
  assert.ok(region.includes(PRIVACY_HINT), 'the privacy hint text must match the spec exactly')
  const at = region.indexOf(NOJS_HINT)
  assert.ok(at >= 0, 'the no-JS hint text must match the spec exactly')
  const open = openingTagAt(region, at)
  const tag = region.slice(open, tagEnd(region, open))
  assert.match(tag, /className="[^"]*(?<![\w-])guest-nojs(?![\w-])/, 'the no-JS hint element carries class guest-nojs')
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
  assert.ok(!block.includes(NOJS_HINT), 'the no-JS hint must sit outside the draft block')
  assert.ok(!block.includes('<GuestSignIn'), 'the sign-in link must sit outside the draft block so it shows without JS')
})

test('88.10: order in the branch is pitch, draft block, no-JS hint, sign-in link', () => {
  const region = guestBranch()
  assertOrder(region, [
    ['pitch', indexOfRe(region, PITCH)],
    ['guest-draft', indexOfRe(region, /(?<![\w-])guest-draft(?![\w-])/)],
    ['guest-nojs', indexOfRe(region, /(?<![\w-])guest-nojs(?![\w-])/)],
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

test('88.15: GuestSignIn does nothing at click time: no handler, no value read, no navigation, no href change', () => {
  const src = readGuestSignIn()
  const banned = /\bonClick\b|\bonMouseDown\b|\bonPointerDown\b|addEventListener\(\s*['"](?:click|mousedown|pointerdown|touchstart)|\.value\b|preventDefault|\blocation\b|window\.open|useRouter|\brouter\b|\.href\s*=|setAttribute\(|\bfetch\s*\(|sendBeacon|XMLHttpRequest|<form\b/
  const hit = banned.exec(src)
  assert.equal(hit, null, `forbidden in GuestSignIn: ${hit?.[0]}`)
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

test('88.33: globals.css has a scripting: none block hiding .guest-draft and showing .guest-nojs, and .guest-nojs hidden by default', () => {
  const css = readFileSync(GLOBALS_CSS, 'utf8')
  const at = css.search(/@media\s*\(\s*scripting\s*:\s*none\s*\)/)
  assert.ok(at >= 0, 'an @media (scripting: none) block must exist')
  const open = css.indexOf('{', at)
  let depth = 0
  let end = open
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    else if (css[i] === '}') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const block = css.slice(open + 1, end)
  assert.match(block, /\.guest-draft\s*\{[^}]*display\s*:\s*none/)
  assert.match(block, /\.guest-nojs\s*\{[^}]*display\s*:\s*block/)
  const rest = css.slice(0, at) + css.slice(end + 1)
  assert.match(rest, /\.guest-nojs\s*\{[^}]*display\s*:\s*none/, '.guest-nojs is display: none by default')
})

function fixtureWithCss(): string {
  assert.ok(existsSync(FIXTURE), 'fixture test/fixtures/w36/guest-signed-out.html must exist')
  const html = readFileSync(FIXTURE, 'utf8')
  const css = readFileSync(GLOBALS_CSS, 'utf8')
  const idx = html.indexOf('</head>')
  assert.ok(idx !== -1, 'fixture must contain </head>')
  return html.slice(0, idx) + '<style>' + css + '</style>' + html.slice(idx)
}

test('88.34: the fixture carries no script', () => {
  assert.ok(!/<script/i.test(readFileSync(FIXTURE, 'utf8')))
})

test('88.35: in Chromium with JavaScript on the box shows and the no-JS hint does not', async () => {
  const context = await browser.newContext({ javaScriptEnabled: true, viewport: { width: 390, height: 844 } })
  try {
    const page = await context.newPage()
    await page.setContent(fixtureWithCss())
    assert.equal(await page.locator('textarea').isVisible(), true, 'textarea visible')
    assert.equal(await page.locator('.starter-chip').count(), 1)
    assert.equal(await page.locator('.guest-draft .hint').isVisible(), true, 'privacy hint visible')
    assert.equal(await page.locator('.guest-nojs').isVisible(), false, 'no-JS hint hidden')
    assert.equal(await page.locator('a[href^="/?next=/c/"]').isVisible(), true, 'sign-in link visible')
  } finally {
    await context.close()
  }
})

test('88.36: in Chromium with JavaScript off there is no visible textarea, the old hint and the link show', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } })
  try {
    const page = await context.newPage()
    await page.setContent(fixtureWithCss())
    assert.equal(await page.locator('textarea').isVisible(), false, 'textarea hidden')
    assert.equal(await page.locator('.starter-chip').isVisible(), false, 'chips hidden')
    assert.equal(await page.locator('#draft-status').isVisible(), false, 'status hidden')
    assert.equal(await page.locator('.guest-nojs').isVisible(), true, 'no-JS hint visible')
    assert.equal(await page.locator('a[href^="/?next=/c/"]').isVisible(), true, 'sign-in link visible')
  } finally {
    await context.close()
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
  assert.match(src, /sent === '1' && \([\s\S]*?sessionStorage\.removeItem\('confession_draft_\$\{slug\}'\)/)
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
