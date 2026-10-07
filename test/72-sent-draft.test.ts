// test/72-sent-draft.test.ts
//
// Week 22 acceptance, written from docs/SPEC-week22-sent-draft.md section 4
// (and the 4.1 amendment) without reading the implementation.
//
// SubmitButton.tsx is imported as a namespace rather than by name. On the
// code before week 22 there is no `wireDraft` export, and a named import
// would fail at link time and take the whole file down with it; this way
// each behavioural test fails on its own with a clear message.
//
// Items 9 and 10 are source-text checks on app/c/[slug]/page.tsx, read with
// readFileSync the same way test/31-draft-persistence does.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as SubmitButtonModule from '../app/_components/SubmitButton.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEND_PAGE = path.join(REPO_ROOT, 'app', 'c', '[slug]', 'page.tsx')

// ---------------------------------------------------------------------------
// wireDraft lookup -- see header comment.
// ---------------------------------------------------------------------------

function requireWireDraft() {
  assert.equal(
    typeof SubmitButtonModule.wireDraft,
    'function',
    'app/_components/SubmitButton.tsx must export wireDraft (spec section 1 item 1)',
  )
  return SubmitButtonModule.wireDraft as (button: unknown) => (() => void) | undefined
}

// ---------------------------------------------------------------------------
// Fakes -- plain objects, no DOM. Listener storage is a Map so tests can
// both fire a listener (dispatchEvent) and check it was removed (the Map
// entry disappears from the array removeEventListener spliced it out of).
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
      const arr = listeners.get(event.type) ?? []
      for (const fn of arr.slice()) fn(event)
      return true
    },
  }
}

function makeTextarea({ slug, sent, value = '' }: { slug?: string; sent?: string; value?: string }) {
  const target = makeListenerTarget()
  return {
    ...target,
    value,
    getAttribute(name: string) {
      if (name === 'data-draft-slug') return slug === undefined ? null : slug
      if (name === 'data-draft-sent') return sent === undefined ? null : sent
      return null
    },
  }
}

function makeForm({ textarea, indicator }: { textarea: unknown; indicator: unknown }) {
  const target = makeListenerTarget()
  return {
    ...target,
    querySelector(selector: string) {
      if (selector === 'textarea[name="body"]') return textarea ?? null
      if (selector === '#draft-status') return indicator ?? null
      return null
    },
  }
}

function makeButton(form: unknown) {
  return {
    closest(selector: string) {
      return selector === 'form' ? (form ?? null) : null
    },
  }
}

function makeWiring({
  slug,
  sent,
  textValue = '',
  withIndicator = true,
}: {
  slug?: string
  sent?: string
  textValue?: string
  withIndicator?: boolean
}) {
  const indicator: { textContent: string } | null = withIndicator ? { textContent: '' } : null
  const textarea = makeTextarea({ slug, sent, value: textValue })
  const form = makeForm({ textarea, indicator })
  const button = makeButton(form)
  return { button, form, textarea, indicator }
}

// Fake sessionStorage, recording every call so item 8 can assert storage
// was never touched. Backed by a plain Map, not the real sessionStorage.
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

// A sessionStorage whose every method throws, the way some private-mode
// browsers behave (spec section 1 item 5, section 0 "Storage access stays
// inside try/catch").
function makeThrowingStorage() {
  const boom = () => {
    throw new Error('sessionStorage is unavailable')
  }
  return { getItem: boom, setItem: boom, removeItem: boom, clear: boom }
}

function installStorage(storage: unknown) {
  const hadOwn = Object.prototype.hasOwnProperty.call(globalThis, 'sessionStorage')
  const previous = (globalThis as Record<string, unknown>).sessionStorage
  ;(globalThis as Record<string, unknown>).sessionStorage = storage
  return function restore() {
    if (hadOwn) {
      ;(globalThis as Record<string, unknown>).sessionStorage = previous
    } else {
      delete (globalThis as Record<string, unknown>).sessionStorage
    }
  }
}

// ---------------------------------------------------------------------------
// Item 1
// ---------------------------------------------------------------------------

test('72.1: sent with the key present clears the key and does not restore (spec section 4 item 1)', () => {
  const wireDraft = requireWireDraft()
  const slug = 'sent-slug-1'
  const storage = makeStorage({ ['confession_draft_' + slug]: 'the old message' })
  const restore = installStorage(storage)
  try {
    const { button, textarea, indicator } = makeWiring({ slug, sent: '1', textValue: '' })
    wireDraft(button)
    assert.equal(storage.getItem('confession_draft_' + slug), null, 'the key must be removed')
    assert.equal(textarea.value, '', 'the textarea must still be empty')
    assert.notEqual(indicator?.textContent, 'تم استعادة المسودة', 'status must not claim a restored draft')
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// Item 2
// ---------------------------------------------------------------------------

test('72.2: sent with drafts for two slugs stored only removes its own slug key (spec section 4 item 2)', () => {
  const wireDraft = requireWireDraft()
  const slug = 'sent-slug-2'
  const otherSlug = 'other-slug-2'
  const storage = makeStorage({
    ['confession_draft_' + slug]: 'mine',
    ['confession_draft_' + otherSlug]: 'theirs',
  })
  const restore = installStorage(storage)
  try {
    const { button } = makeWiring({ slug, sent: '1', textValue: '' })
    wireDraft(button)
    assert.equal(storage.getItem('confession_draft_' + slug), null, 'this slug key must be removed')
    assert.equal(storage.getItem('confession_draft_' + otherSlug), 'theirs', 'the other slug key must be untouched')
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// Item 3
// ---------------------------------------------------------------------------

test('72.3: not sent with the key present restores into an empty textarea and dispatches input (spec section 4 item 3)', () => {
  const wireDraft = requireWireDraft()
  const slug = 'draft-slug-3'
  const storage = makeStorage({ ['confession_draft_' + slug]: 'restored text' })
  const restore = installStorage(storage)
  try {
    const { button, textarea, indicator } = makeWiring({ slug, textValue: '' })
    let inputEventSeen = false
    textarea.addEventListener('input', () => {
      inputEventSeen = true
    })
    wireDraft(button)
    assert.equal(textarea.value, 'restored text', 'the stored text must be restored into the textarea')
    assert.equal(indicator?.textContent, 'تم استعادة المسودة', 'the status must read تم استعادة المسودة')
    assert.ok(inputEventSeen, 'an input event must be dispatched after restoring')
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// Item 4
// ---------------------------------------------------------------------------

test('72.4: not sent with the textarea already holding text leaves it alone (spec section 4 item 4)', () => {
  const wireDraft = requireWireDraft()
  const slug = 'draft-slug-4'
  const storage = makeStorage({ ['confession_draft_' + slug]: 'stored text' })
  const restore = installStorage(storage)
  try {
    const { button, textarea } = makeWiring({ slug, textValue: 'already typed' })
    wireDraft(button)
    assert.equal(textarea.value, 'already typed', 'existing text in the textarea must not be overwritten')
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// Item 5
// ---------------------------------------------------------------------------

test('72.5: a storage that throws on every method does not throw out of wireDraft, sent case (spec section 4 item 5)', () => {
  const wireDraft = requireWireDraft()
  const slug = 'throwy-slug-5a'
  const restore = installStorage(makeThrowingStorage())
  try {
    const { button } = makeWiring({ slug, sent: '1', textValue: '' })
    assert.doesNotThrow(() => wireDraft(button))
  } finally {
    restore()
  }
})

test('72.5: a storage that throws on every method does not throw out of wireDraft, not-sent case (spec section 4 item 5)', () => {
  const wireDraft = requireWireDraft()
  const slug = 'throwy-slug-5b'
  const restore = installStorage(makeThrowingStorage())
  try {
    const { button } = makeWiring({ slug, textValue: '' })
    assert.doesNotThrow(() => wireDraft(button))
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// Item 6 -- a real wait after firing input, per the task's instruction: the
// spec's debounce is 150ms, so 250ms real time is the save window plus a
// margin, not a mocked clock.
// ---------------------------------------------------------------------------

test('72.6: typing after a send still saves under the slug key within 150ms (spec section 4 item 6)', async () => {
  const wireDraft = requireWireDraft()
  const slug = 'sent-typing-slug-6'
  const storage = makeStorage({ ['confession_draft_' + slug]: 'old sent text' })
  const restore = installStorage(storage)
  try {
    const { button, textarea } = makeWiring({ slug, sent: '1', textValue: '' })
    wireDraft(button)
    textarea.value = 'a brand new message typed after send'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 250))
    assert.equal(
      storage.getItem('confession_draft_' + slug),
      'a brand new message typed after send',
      'typing after a send must still be saved under the slug key within 150ms plus a margin',
    )
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// Item 7
// ---------------------------------------------------------------------------

test('72.7: the returned cleanup function removes the listeners wireDraft added (spec section 4 item 7)', () => {
  const wireDraft = requireWireDraft()
  const slug = 'cleanup-slug-7'
  const storage = makeStorage({})
  const restore = installStorage(storage)
  try {
    const { button, form, textarea } = makeWiring({ slug, textValue: '' })
    const inputCountBefore = (textarea.listeners.get('input') ?? []).length
    const submitCountBefore = (form.listeners.get('submit') ?? []).length

    const cleanup = wireDraft(button)
    assert.equal(typeof cleanup, 'function', 'wireDraft must return a cleanup function when it wired something')

    const inputCountWired = (textarea.listeners.get('input') ?? []).length
    const submitCountWired = (form.listeners.get('submit') ?? []).length
    assert.ok(inputCountWired > inputCountBefore, 'wireDraft must add an input listener to the textarea')
    assert.ok(submitCountWired > submitCountBefore, 'wireDraft must add a submit listener to the form')

    cleanup?.()

    assert.equal(
      (textarea.listeners.get('input') ?? []).length,
      inputCountBefore,
      'cleanup must remove the input listener it added',
    )
    assert.equal(
      (form.listeners.get('submit') ?? []).length,
      submitCountBefore,
      'cleanup must remove the submit listener it added',
    )
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// Item 8
// ---------------------------------------------------------------------------

test('72.8: a null button touches no storage and returns undefined (spec section 4 item 8)', () => {
  const wireDraft = requireWireDraft()
  const storage = makeStorage({})
  const restore = installStorage(storage)
  try {
    const result = wireDraft(null)
    assert.equal(result, undefined)
    assert.deepEqual(storage.calls, [])
  } finally {
    restore()
  }
})

test('72.8: a button outside a form touches no storage and returns undefined (spec section 4 item 8)', () => {
  const wireDraft = requireWireDraft()
  const storage = makeStorage({})
  const restore = installStorage(storage)
  try {
    const button = { closest: () => null }
    const result = wireDraft(button)
    assert.equal(result, undefined)
    assert.deepEqual(storage.calls, [])
  } finally {
    restore()
  }
})

test('72.8: a form without a body textarea touches no storage and returns undefined (spec section 4 item 8)', () => {
  const wireDraft = requireWireDraft()
  const storage = makeStorage({})
  const restore = installStorage(storage)
  try {
    const form = makeForm({ textarea: null, indicator: null })
    const button = makeButton(form)
    const result = wireDraft(button)
    assert.equal(result, undefined)
    assert.deepEqual(storage.calls, [])
  } finally {
    restore()
  }
})

test('72.8: a textarea without data-draft-slug touches no storage and returns undefined (spec section 4 item 8)', () => {
  const wireDraft = requireWireDraft()
  const storage = makeStorage({})
  const restore = installStorage(storage)
  try {
    const { button } = makeWiring({ textValue: '' })
    const result = wireDraft(button)
    assert.equal(result, undefined)
    assert.deepEqual(storage.calls, [])
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// Item 9 -- source-text checks on app/c/[slug]/page.tsx. Regexes are
// tolerant of attribute order and quote style but exact about meaning: a
// conditional keyed off sent === '1', not any truthy check on `sent`.
// ---------------------------------------------------------------------------

test('72.9: the textarea data-draft-sent is conditional on sent === "1" (spec section 4 item 9)', () => {
  const src = readFileSync(SEND_PAGE, 'utf8')
  assert.match(
    src,
    /data-draft-sent=\{\s*sent\s*===\s*['"]1['"][^}]*\}/,
    'app/c/[slug]/page.tsx must set data-draft-sent on the textarea from a sent === "1" check',
  )
})

// Amended by spec section 4.1 after freeze: test/31-draft-persistence pins
// the literal <form action={action}> tag, so the key moved off the form
// itself onto a wrapping element (in practice a <Fragment key={...}>) that
// opens before the form and closes after it. The form tag itself must stay
// byte-identical to what test 31's AC4 already pins -- this test checks
// that literal tag is unchanged and finds a key-bearing wrapper around it,
// not a key on the form.
test('72.9: the <form action={action}> element is unchanged and wrapped in an element whose key references sent (spec section 4 item 9, amended section 4.1)', () => {
  const src = readFileSync(SEND_PAGE, 'utf8')

  // The form tag itself: byte-identical to the literal test 31's AC4 pins.
  const formTagMatch = src.match(/<form action=\{action\}>/)
  assert.ok(formTagMatch, 'the <form action={action}> tag must be unchanged (test 31 AC4 pins this literal)')
  const formOpenIndex = formTagMatch ? (formTagMatch.index ?? -1) : -1
  assert.ok(formOpenIndex >= 0, 'could not locate the <form action={action}> tag')

  const formCloseMatch = src.slice(formOpenIndex).match(/<\/form>/)
  assert.ok(formCloseMatch, 'expected a matching </form> after the <form action={action}> tag')
  const formCloseIndex = formCloseMatch ? formOpenIndex + (formCloseMatch.index ?? 0) + formCloseMatch[0].length : -1
  assert.ok(formCloseIndex >= 0, 'could not locate the closing </form> tag')

  // Any opening tag, anywhere in the file, carrying a key expression that
  // references sent -- tolerant of the tag name (Fragment, React.Fragment,
  // or anything else) and of attribute order/formatting.
  const keyTagPattern = /<([A-Za-z][\w.]*)\b[^>]*\bkey=\{[^}]*\bsent\b[^}]*\}[^>]*>/g
  let wrapperFound = false
  let match: RegExpExecArray | null
  while ((match = keyTagPattern.exec(src))) {
    const tagName = match[1]
    const openIndex = match.index
    if (openIndex >= formOpenIndex) continue // must open before the form

    const closingTagPattern = new RegExp('</' + tagName.replace(/\./g, '\\.') + '>')
    const closingMatch = closingTagPattern.exec(src.slice(formCloseIndex))
    if (closingMatch) {
      wrapperFound = true
      break
    }
  }

  assert.ok(
    wrapperFound,
    'expected an element with a key referencing sent to open before <form action={action}> and close after </form> (spec section 4.1: the key moved to a wrapping element, e.g. <Fragment key={...sent...}>)',
  )
})

// ---------------------------------------------------------------------------
// Item 10 -- the inline removal script is a keep, pinned by tests 31 and 35
// already; this just confirms it is still inside the sent === '1' block.
// ---------------------------------------------------------------------------

test('72.10: the inline sessionStorage.removeItem script in the sent block is still there (spec section 4 item 10)', () => {
  const src = readFileSync(SEND_PAGE, 'utf8')
  assert.match(
    src,
    /sessionStorage\.removeItem\(\s*['"]confession_draft_/,
    'the inline removal script for confession_draft_<slug> must still be present',
  )
  assert.match(
    src,
    /sent === ['"]1['"][\s\S]*?sessionStorage\.removeItem\(\s*['"]confession_draft_/,
    'the removeItem script must still be inside the sent === "1" block',
  )
})
