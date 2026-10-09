// test/73-inline-handlers.test.ts
//
// Week 23 acceptance, written from docs/SPEC-week23-inline-scripts.md section 4.
// Source-text checks on the five handler files in spec section 0.2; the
// browser behaviour is the drive in spec section 5, not this file.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

type Handler = {
  rel: string
  file: string
  selector: string
  id: string
  label: string
  snippet: string
}

// Spec section 0.2 files, section 1.2 ids, section 4.7 distinctive substrings
// copied from the handler text as it stands on this tree.
const HANDLERS: Handler[] = [
  {
    rel: 'app/c/[slug]/page.tsx',
    file: path.join(APP_DIR, 'c', '[slug]', 'page.tsx'),
    selector: 'button[data-starter-prompt]',
    id: 'starter-chips',
    label: 'starter chips',
    snippet: "ta.dispatchEvent(new Event('input',{bubbles:true}))",
  },
  {
    rel: 'app/inbox/page.tsx',
    file: path.join(APP_DIR, 'inbox', 'page.tsx'),
    selector: '.daily-spark__copy',
    id: 'daily-spark-copy',
    label: 'daily spark copy',
    snippet: "b.getAttribute('data-spark-text')||''",
  },
  {
    rel: 'app/_components/RevealCard.tsx',
    file: path.join(APP_DIR, '_components', 'RevealCard.tsx'),
    selector: 'button[data-target][data-prompt]',
    id: 'reveal-chips',
    label: 'reveal chips',
    snippet: "e.target&&e.target.closest('button[data-target][data-prompt]')",
  },
  {
    rel: 'app/offer/[offerId]/page.tsx',
    file: path.join(APP_DIR, 'offer', '[offerId]', 'page.tsx'),
    selector: 'button[data-response-prompt]',
    id: 'response-starters',
    label: 'response starters',
    snippet: 'textarea[name="senderAnswer"]',
  },
  {
    rel: 'app/sent/page.tsx',
    file: path.join(APP_DIR, 'sent', 'page.tsx'),
    selector: 'button[data-copy-text]',
    id: 'sent-copy',
    label: 'copy button',
    snippet: "document.execCommand('copy')",
  },
]

function readSource(file: string, rel: string): string {
  assert.ok(existsSync(file), `${rel} must exist`)
  return readFileSync(file, 'utf8')
}

// A script opener is <Script or <script followed by whitespace or >.
function lastOpenerBefore(
  src: string,
  before: number,
): { index: number; name: 'script' | 'Script' } | null {
  const region = src.slice(0, before)
  const re = /<(script|Script)(?=[\s>])/g
  let found: { index: number; name: 'script' | 'Script' } | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(region)) !== null) {
    found = { index: m.index, name: m[1] as 'script' | 'Script' }
  }
  return found
}

function skipTagName(src: string, openerIndex: number): number {
  let i = openerIndex + 1
  while (i < src.length && /[A-Za-z]/.test(src[i]!)) i += 1
  return i
}

// Scan from after the tag name to the matching '>' that closes the start tag,
// ignoring '>' inside quotes, braces, parens, or brackets so a multiline
// dangerouslySetInnerHTML prop is still one opening tag.
function openingTagClose(src: string, openerIndex: number): number {
  let i = skipTagName(src, openerIndex)
  let quote: string | null = null
  let brace = 0
  let paren = 0
  let bracket = 0
  for (; i < src.length; i += 1) {
    const c = src[i]!
    if (quote) {
      if (c === '\\' && (quote === '"' || quote === "'" || quote === '`')) {
        i += 1
        continue
      }
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c
      continue
    }
    if (c === '{') {
      brace += 1
      continue
    }
    if (c === '}' && brace > 0) {
      brace -= 1
      continue
    }
    if (c === '(') {
      paren += 1
      continue
    }
    if (c === ')' && paren > 0) {
      paren -= 1
      continue
    }
    if (c === '[') {
      bracket += 1
      continue
    }
    if (c === ']' && bracket > 0) {
      bracket -= 1
      continue
    }
    if (c === '>' && brace === 0 && paren === 0 && bracket === 0) return i
  }
  return src.length
}

function openingTagAttrs(src: string, openerIndex: number): string {
  const nameEnd = skipTagName(src, openerIndex)
  const close = openingTagClose(src, openerIndex)
  return src.slice(nameEnd, close)
}

function attrValue(attrs: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:\\{\\s*)?(['"])([^'"]+)\\1`)
  const m = attrs.match(re)
  return m ? m[2]! : null
}

function lowercaseScriptBodies(src: string): string[] {
  const bodies: string[] = []
  const re = /<script(?=[\s>])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const afterName = skipTagName(src, m.index)
    const rest = src.slice(afterName)
    const selfClose = rest.indexOf('/>')
    const closeTag = rest.indexOf('</script>')
    let rel: number
    if (selfClose === -1 && closeTag === -1) {
      rel = rest.length
    } else if (selfClose === -1) {
      rel = closeTag
    } else if (closeTag === -1) {
      rel = selfClose
    } else {
      rel = Math.min(selfClose, closeTag)
    }
    bodies.push(src.slice(m.index, afterName + rel))
  }
  return bodies
}

function importsDefaultNextScript(src: string): boolean {
  return /import\s+(?!type\b)[A-Za-z_$][\w$]*\s+from\s+['"]next\/script(?:\.js)?['"]/.test(src)
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

function enclosingOpener(src: string, selector: string, rel: string) {
  const selIdx = src.indexOf(selector)
  assert.ok(selIdx >= 0, `${rel} must contain handler selector ${selector}`)
  const opener = lastOpenerBefore(src, selIdx)
  assert.ok(
    opener,
    `${rel}: selector ${selector} must sit inside an element opened with <Script or <script`,
  )
  return opener
}

// ---------------------------------------------------------------------------
// 4.1 each of the five files imports the default export of next/script
// ---------------------------------------------------------------------------

for (const h of HANDLERS) {
  test(`4.1 ${h.rel} imports the default export of next/script`, () => {
    const src = readSource(h.file, h.rel)
    assert.ok(
      importsDefaultNextScript(src),
      `${h.rel} must import the default export of next/script`,
    )
  })
}

// ---------------------------------------------------------------------------
// 4.2 handler selector sits in a <Script> with afterInteractive and the id
// ---------------------------------------------------------------------------

for (const h of HANDLERS) {
  test(`4.2 ${h.label} handler is inside a Script element`, () => {
    const src = readSource(h.file, h.rel)
    const opener = enclosingOpener(src, h.selector, h.rel)
    assert.equal(
      opener.name,
      'Script',
      `${h.rel}: selector ${h.selector} must be enclosed by <Script, not <${opener.name}`,
    )
    const attrs = openingTagAttrs(src, opener.index)
    assert.equal(
      attrValue(attrs, 'strategy'),
      'afterInteractive',
      `${h.rel}: enclosing <Script must set strategy="afterInteractive"`,
    )
    assert.equal(
      attrValue(attrs, 'id'),
      h.id,
      `${h.rel}: enclosing <Script must set id="${h.id}"`,
    )
  })
}

// ---------------------------------------------------------------------------
// 4.3 the five ids are pairwise different
// ---------------------------------------------------------------------------

test('4.3 the five handler Script ids are pairwise different', () => {
  const ids: string[] = []
  for (const h of HANDLERS) {
    const src = readSource(h.file, h.rel)
    const opener = enclosingOpener(src, h.selector, h.rel)
    const attrs = openingTagAttrs(src, opener.index)
    const id = attrValue(attrs, 'id')
    assert.ok(id, `${h.rel}: handler element must carry an id attribute`)
    ids.push(id)
  }
  assert.equal(ids.length, 5, 'expected one id per handler file')
  const unique = new Set(ids)
  assert.equal(
    unique.size,
    ids.length,
    `handler ids must be pairwise different; got ${ids.join(', ')}`,
  )
})

// ---------------------------------------------------------------------------
// 4.4 no lowercase <script> in the five files carries addEventListener
// ---------------------------------------------------------------------------

for (const h of HANDLERS) {
  test(`4.4 ${h.rel} has no lowercase script element that calls addEventListener`, () => {
    const src = readSource(h.file, h.rel)
    const hits = lowercaseScriptBodies(src).filter((body) => body.includes('addEventListener'))
    assert.equal(
      hits.length,
      0,
      `${h.rel} must not contain a lowercase <script element whose text includes addEventListener`,
    )
  })
}

// ---------------------------------------------------------------------------
// 4.5 compose page keeps the plain draft-removal script
// ---------------------------------------------------------------------------

test("4.5 compose page still has the plain script that removes the confession draft", () => {
  const h = HANDLERS[0]!
  const src = readSource(h.file, h.rel)
  const needle = "sessionStorage.removeItem('confession_draft_"
  const hit = lowercaseScriptBodies(src).some((body) => body.includes(needle))
  assert.ok(
    hit,
    `${h.rel} must still contain a lowercase <script element whose text includes ${needle}`,
  )
})

// ---------------------------------------------------------------------------
// 4.6 RevealCard keeps the once-per-document guard
// ---------------------------------------------------------------------------

test('4.6 RevealCard still contains __revealChipInit', () => {
  const h = HANDLERS[2]!
  const src = readSource(h.file, h.rel)
  assert.ok(src.includes('__revealChipInit'), `${h.rel} must still contain __revealChipInit`)
})

// ---------------------------------------------------------------------------
// 4.7 handler bodies are unchanged: one distinctive substring per file
// ---------------------------------------------------------------------------

for (const h of HANDLERS) {
  test(`4.7 ${h.label} handler still contains its distinctive substring`, () => {
    const src = readSource(h.file, h.rel)
    assert.ok(
      src.includes(h.snippet),
      `${h.rel} must still contain ${JSON.stringify(h.snippet)}`,
    )
  })
}

// ---------------------------------------------------------------------------
// 4.8 next/script stays out of app/admin (test 17 forbids scripts there)
// ---------------------------------------------------------------------------

test('4.8 no file under app/admin/ imports next/script', () => {
  const adminDir = path.join(APP_DIR, 'admin')
  assert.ok(
    existsSync(adminDir) && statSync(adminDir).isDirectory(),
    'app/admin/ must exist so there is something to check',
  )
  const files = listSourceFiles(adminDir)
  assert.ok(files.length > 0, 'app/admin/ must contain .ts/.tsx source files')
  const spec = /(?:from\s+|require\s*\(\s*)['"]next\/script(?:\.js)?['"]/
  const offenders = files.filter((file) => spec.test(readFileSync(file, 'utf8')))
  assert.deepEqual(
    offenders.map((file) => path.relative(REPO_ROOT, file)),
    [],
    'no file under app/admin/ may import next/script',
  )
})
