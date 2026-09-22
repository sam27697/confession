// test/63-copy-contract.test.ts
//
// docs/SPEC-week14-copy-contract.md §3: the tripwire against a product claim
// that outruns what the schema actually does. `confessions.sender_account_id`
// is NOT NULL and `admin_reveal_log` exists so an operator can resolve a
// confession back to the sender's account -- that is terms clause 1, and it
// is Sam's own instruction of 2026-08-25: «بدنا نضحي بالسرية شوي وما شرط
// نعومها او نتفاخر فيها» (we sacrifice some secrecy and there is no need to
// gloss it or boast about it). Any copy that claims otherwise is a false
// claim shipped on the front door, and this file is what turns that false
// claim into a red build instead of a sentence in a spec nobody re-reads.
//
// This file reads source text. It opens no database and no browser.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')
const GLOBALS_CSS_PATH = path.join(APP_DIR, 'globals.css')
const HOME_PAGE_PATH = path.join(APP_DIR, 'page.tsx')
const ONBOARDING_PAGE_PATH = path.join(APP_DIR, 'onboarding', 'page.tsx')
const SEND_PAGE_PATH = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')

const GLOBALS_CSS = readFileSync(GLOBALS_CSS_PATH, 'utf8')
const HOME_PAGE_SRC = readFileSync(HOME_PAGE_PATH, 'utf8')
const ONBOARDING_PAGE_SRC = readFileSync(ONBOARDING_PAGE_PATH, 'utf8')
const SEND_PAGE_SRC = readFileSync(SEND_PAGE_PATH, 'utf8')

// The two sentences pinned in §3.3, and the sender-disclosure line pinned in
// §3.4, are copied character for character out of the frozen specs, never
// out of the file this test is pinning. §3.3's sentences come from
// SPEC-week13-landing.md §3.1/§3.2 (work/confession-app/BRIEF.md is not
// present in this worktree; the landing spec quotes the same BRIEF.md text
// and both specs agree on it byte for byte, checked by eye against
// docs/SPEC-week14-copy-contract.md §2.1 and §3.3 as well).
const APPROVED_HERO = 'تطبيق مصارحة سرية.'
const APPROVED_EXPLAINER =
  'الناس تقدر تبعتلك أي شي وهي متخفية عنك. وإذا حدا حب يصارحك أكتر، فيه ميزة اسمها «صارحني بدورك» بتكشف مين هو، بس إذا هو وافق.'

// terms clause 1, src/terms.ts TERMS_TEXT_AR.clauses[0], carried in every
// §3.1 violation message so the person who trips this rule reads the reason
// and not only the rule (the week-2 column-tripwire precedent).
const TERMS_CLAUSE_1 =
  'الرسائل يلي بتوصلك ما بتشوف مين باعتها. هوية المُرسِل مخفية عنك. بس لازم تعرف: إدارة التطبيق بتقدر تشوف حساب المُرسِل، ومنستخدم هالشي فقط لمنع الإساءة أو إذا اضطرينا قانونياً.'
const SAM_20260825 = 'بدنا نضحي بالسرية شوي وما شرط نعومها او نتفاخر فيها'

function footer(): string {
  return (
    ` Terms clause 1: «${TERMS_CLAUSE_1}». ` +
    `Sam, 2026-08-25: «${SAM_20260825}».`
  )
}

// --- comment stripping ---------------------------------------------------
//
// A rule that fires on the prose explaining itself is a rule that gets
// deleted (spec §3.1), so the sweep below must never see a comment. This is
// a small state machine rather than a line-comment regex, because a regex
// that starts stripping at the first "//" it finds would also eat the "//"
// inside "https://" string literals and corrupt live code before the search
// even runs. Strings (single, double, template) are copied through
// untouched; `//` to end of line and `/* ... */` (which is also what a JSX
// comment `{/* ... */}` reduces to once the surrounding braces are left in
// place) are dropped.
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

test('3.1.0: the comment stripper removes // and /* */ and {/* */} but leaves strings, including ones containing "//" and "/*", intact', () => {
  const fixture = [
    '// a line comment carrying سري تماما, which must never fire the sweep',
    '/* a block comment carrying',
    '   بدون أي تتبع across two lines, which must never fire the sweep either */',
    '{/* a jsx comment carrying بحرية تامة, same rule */}',
    'const real = "a string that keeps // not a comment and /* also not a comment */ intact";',
    'const claim = "مجهول تماما"; // trailing comment noise, stripped',
    '',
  ].join('\n')

  const stripped = stripComments(fixture)

  for (const commentOnly of ['سري تماما', 'بدون أي تتبع', 'بحرية تامة']) {
    assert.ok(
      !stripped.includes(commentOnly),
      `stripComments left "${commentOnly}" behind; it only ever appeared inside a comment in the fixture`,
    )
  }

  assert.ok(
    stripped.includes('a string that keeps // not a comment and /* also not a comment */ intact'),
    'stripComments corrupted a string literal that itself contains // and /* sequences',
  )

  assert.ok(
    stripped.includes('مجهول تماما'),
    'stripComments dropped live code; "مجهول تماما" in the fixture also appears inside a real string, not only in comments, and must survive',
  )

  // Prove the stripper and the sweep compose correctly, not just each in
  // isolation: run the actual §3.1 scanner (defined below) over the
  // stripped fixture and confirm it flags only the live-code occurrence.
  const hits = FORBIDDEN_RULES.flatMap((rule) => rule.find(stripped).map((hit) => ({ rule: rule.id, hit })))
  const hitTexts = hits.map((h) => h.hit)
  assert.ok(
    hitTexts.some((h) => h.includes('مجهول تماما')),
    'the sweep must still catch the live-code "مجهول تماما" once comments are stripped',
  )
  for (const commentOnly of ['سري تماما', 'بدون أي تتبع', 'بحرية تامة']) {
    assert.ok(
      !hitTexts.some((h) => h.includes(commentOnly)),
      `the sweep fired on "${commentOnly}", which only ever appeared inside a comment`,
    )
  }
})

// --- §3.1 forbidden-claim sweep, encoded as data --------------------------
//
// Each row is the table in spec §3.1. `find` returns the offending excerpts
// so a failure message can show exactly what matched and where, the same
// discipline as test/02's column denylist.

const ARABIC = /[؀-ۿ]/
const SECRECY_WORD = /(مجهول|سري|خصوصية|أمان)/
const IDENTITY_WORD = /(كشف|هوية)/

function windowsAround(text: string, matchRe: RegExp, radius: number): Array<{ index: number; match: string; window: string }> {
  const out: Array<{ index: number; match: string; window: string }> = []
  const re = new RegExp(matchRe.source, matchRe.flags.includes('g') ? matchRe.flags : matchRe.flags + 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const start = Math.max(0, m.index - radius)
    const end = Math.min(text.length, m.index + m[0].length + radius)
    out.push({ index: m.index, match: m[0], window: text.slice(start, end) })
    if (m[0].length === 0) re.lastIndex++
  }
  return out
}

function literalHits(text: string, phrases: string[]): string[] {
  const hits: string[] = []
  for (const phrase of phrases) {
    if (text.includes(phrase)) hits.push(phrase)
  }
  return hits
}

type ForbiddenRule = {
  id: string
  reason: string
  find: (text: string) => string[]
}

const FORBIDDEN_RULES: ForbiddenRule[] = [
  {
    id: '3.1.a',
    reason:
      '"100%" is a quantified absolute this product cannot keep, whether it sits beside a secrecy/anonymity word or stands alone in a claim sentence',
    find: (text) =>
      windowsAround(text, /100%/g, 60)
        .filter((h) => SECRECY_WORD.test(h.window) || ARABIC.test(h.window))
        .map((h) => h.window.trim()),
  },
  {
    id: '3.1.b',
    reason:
      'the sender\'s account is recorded, always -- "no tracking", "we do not track", "we do not log" and "without registration" are all false',
    find: (text) => literalHits(text, ['بدون أي تتبع', 'ما منتبع', 'ما منسجل', 'بلا تسجيل']),
  },
  {
    id: '3.1.c',
    reason: 'absolute secrecy, which terms clause 1 denies',
    find: (text) =>
      literalHits(text, [
        'مجهول تماما',
        'مجهول تماماً',
        'مجهولة تماما',
        'سري تماما',
        'سرية تامة',
        'بحرية تامة',
      ]),
  },
  {
    id: '3.1.d',
    reason: 'the operator knows, by Sam\'s decision of 2026-08-25',
    find: (text) => literalHits(text, ['ما منعرف مين', 'ما حد يعرف مين', 'ولا حد يعرف']),
  },
  {
    id: '3.1.e',
    reason: 'a mutual reveal discloses identity by design, so "no fear at all" cannot be said about identity disclosure',
    find: (text) =>
      windowsAround(text, /(بدون أي خوف|ما في خوف)/g, 60)
        .filter((h) => IDENTITY_WORD.test(h.window))
        .map((h) => h.window.trim()),
  },
  {
    id: '3.1.f',
    reason: 'same rule, other language -- "anonymous"/"anonymity" needs the admin clause in the same element',
    find: (text) => {
      const hits: string[] = []
      const re = /\b(anonymous|anonymity)\b/gi
      let m: RegExpExecArray | null
      while ((m = re.exec(text))) {
        const start = text.lastIndexOf('>', m.index) + 1
        let end = text.indexOf('<', m.index)
        if (end === -1) end = text.length
        const element = text.slice(start, end)
        if (!/admin/i.test(element)) hits.push(element.trim())
      }
      return hits
    },
  },
]

// --- the sweep target: every *.tsx and *.ts under app/ --------------------

function walkAppSourceFiles(): string[] {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        files.push(full)
      }
    }
  }
  walk(APP_DIR)
  return files
}

const APP_SOURCE_FILES = walkAppSourceFiles()

function sweepFor(rule: ForbiddenRule): Array<{ file: string; hits: string[] }> {
  const offenders: Array<{ file: string; hits: string[] }> = []
  for (const file of APP_SOURCE_FILES) {
    const raw = readFileSync(file, 'utf8')
    const stripped = stripComments(raw)
    const hits = rule.find(stripped)
    if (hits.length > 0) {
      offenders.push({ file: path.relative(REPO_ROOT, file), hits })
    }
  }
  return offenders
}

for (const rule of FORBIDDEN_RULES) {
  test(`3.1: forbidden-claim sweep -- ${rule.id}: ${rule.reason}`, () => {
    const offenders = sweepFor(rule)
    assert.deepEqual(
      offenders,
      [],
      `${rule.id} fired: ${rule.reason}.${footer()} Found in: ${JSON.stringify(offenders)}`,
    )
  })
}

// --- §3.2 the paired-truth invariant on the landing page -------------------

test('3.2: if app/page.tsx describes the anonymity half of the system, it must describe the operator half on the same screen', () => {
  const stripped = stripComments(HOME_PAGE_SRC)
  const anonymityWords = ['مخفية', 'متخفية', 'بلا اسم', 'سرية']
  const present = anonymityWords.filter((w) => stripped.includes(w))
  if (present.length === 0) {
    // Nothing on the page claims the anonymity half at all -- vacuously fine,
    // there is nothing to pair.
    return
  }
  assert.ok(
    stripped.includes('إدارة التطبيق'),
    'app/page.tsx describes the anonymity half of the system ' +
      `(found: ${JSON.stringify(present)}) without describing the operator half on the same screen. ` +
      'The landing page is not allowed to describe one half of terms clause 1 without the other.' +
      footer(),
  )
})

// --- §3.3 Sam's approved sentences are pinned -------------------------------

test('3.3: app/page.tsx contains Sam\'s approved hero sentence byte for byte', () => {
  assert.ok(
    HOME_PAGE_SRC.includes(APPROVED_HERO),
    `app/page.tsx must contain «${APPROVED_HERO}» byte for byte (spec §2.1, §3.3, and SPEC-week13-landing.md §3.1)`,
  )
})

test('3.3: app/page.tsx contains Sam\'s approved explainer sentence byte for byte', () => {
  assert.ok(
    HOME_PAGE_SRC.includes(APPROVED_EXPLAINER),
    `app/page.tsx must contain «${APPROVED_EXPLAINER}» byte for byte (spec §2.1, §3.3, and SPEC-week13-landing.md §3.2)`,
  )
})

// --- §3.4 the sender disclosure is still where it was ----------------------

test('3.4: the sender-disclosure line above the send button is still present under app/', () => {
  const disclosure =
    'اسمك ما بيوصل للي عم تبعتله. بس رسالتك مربوطة بحسابك عنا، وإدارة التطبيق بتقدر تشوفه.'
  assert.ok(
    SEND_PAGE_SRC.includes(disclosure),
    `app/c/[slug]/page.tsx must still contain «${disclosure}». §3.1's sweep must never be ` +
      'satisfiable by deleting the truthful sentence instead of the false one.',
  )
})

// --- §3.5 the terms affordance ---------------------------------------------
//
// This work item is out of scope of this test file's own worktree (spec
// hands §2 the copy repair and §4.2's affordance to a different author in a
// different worktree). These assertions are written to the spec regardless
// and are expected to fail here until that work lands.

type Elem = {
  id: number
  parent: number | null
  tag: string
  className: string
  openStart: number
  openEnd: number
  closeStart: number
  closeEnd: number
}

function parseElements(src: string): Elem[] {
  const tagRe = /<\/?([A-Za-z][A-Za-z0-9.]*)((?:\s+[^<>]*?)?)\s*(\/?)>/g
  const stack: Array<{ id: number; tag: string }> = []
  const elems: Elem[] = []
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(src))) {
    const isClose = m[0].startsWith('</')
    const tag = m[1]
    const attrs = m[2] ?? ''
    const selfClose = m[3] === '/'
    if (isClose) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          const id = stack[i].id
          elems[id].closeStart = m.index
          elems[id].closeEnd = tagRe.lastIndex
          stack.length = i
          break
        }
      }
      continue
    }
    const doubleQuoted = attrs.match(/className=\s*"([^"]*)"/)
    const singleQuoted = attrs.match(/className=\s*'([^']*)'/)
    const templated = attrs.match(/className=\{\s*`([^`]*)`\s*\}/)
    const className = doubleQuoted?.[1] ?? singleQuoted?.[1] ?? templated?.[1] ?? ''
    const parent = stack.length > 0 ? stack[stack.length - 1].id : null
    const id = elems.length
    elems.push({
      id,
      parent,
      tag,
      className,
      openStart: m.index,
      openEnd: tagRe.lastIndex,
      closeStart: selfClose ? m.index : -1,
      closeEnd: selfClose ? tagRe.lastIndex : -1,
    })
    if (!selfClose) stack.push({ id, tag })
  }
  return elems
}

function classSelectorRule(css: string, className: string): string | null {
  if (!className) return null
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp('\\.' + escaped + '\\s*\\{[^}]*\\}'))
  return match ? match[0] : null
}

function classSelectorDefinitionCount(css: string, className: string): number {
  if (!className) return 0
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = css.match(new RegExp('\\.' + escaped + '\\s*\\{', 'g'))
  return matches ? matches.length : 0
}

function findFadeSibling(): { wrapper: Elem; card: Elem; fade: Elem } | null {
  const elems = parseElements(ONBOARDING_PAGE_SRC)
  const card = elems.find((e) => e.className.split(/\s+/).includes('card--inset'))
  if (!card || card.parent === null) return null
  const wrapper = elems[card.parent]
  const siblings = elems.filter((e) => e.parent === card.parent && e.openStart > card.closeEnd)
  for (const sibling of siblings) {
    for (const cls of sibling.className.split(/\s+/).filter(Boolean)) {
      const rule = classSelectorRule(GLOBALS_CSS, cls)
      if (rule && /pointer-events\s*:\s*none/.test(rule) && rule.includes('var(--veil-fade-bottom)')) {
        return { wrapper, card, fade: sibling }
      }
    }
  }
  return null
}

test('3.5: the onboarding terms card sits in a positioned wrapper with the fade as its sibling, not its child', () => {
  const found = findFadeSibling()
  assert.ok(
    found,
    'app/onboarding/page.tsx must render .card--inset inside a wrapper element that also carries, as a sibling ' +
      'of the card (not nested inside it), an element whose globals.css rule sets pointer-events:none and uses ' +
      'var(--veil-fade-bottom). No such sibling was found.',
  )
  if (!found) return
  assert.ok(
    found.wrapper.className.trim().length > 0,
    'the element directly wrapping .card--inset must carry its own class (a positioned wrapper), ' +
      'not be the bare, class-less page root div it is today',
  )
})

test('3.5: the fade rule carries pointer-events:none', () => {
  const found = findFadeSibling()
  assert.ok(found, 'no fade sibling of .card--inset was found; see the previous test')
  if (!found) return
  for (const cls of found.fade.className.split(/\s+/).filter(Boolean)) {
    const rule = classSelectorRule(GLOBALS_CSS, cls)
    if (rule && /pointer-events\s*:\s*none/.test(rule)) return
  }
  assert.fail('the fade element\'s globals.css rule must set pointer-events:none')
})

test('3.5: the fade uses var(--veil-fade-bottom)', () => {
  const found = findFadeSibling()
  assert.ok(found, 'no fade sibling of .card--inset was found; see the previous test')
  if (!found) return
  for (const cls of found.fade.className.split(/\s+/).filter(Boolean)) {
    const rule = classSelectorRule(GLOBALS_CSS, cls)
    if (rule && rule.includes('var(--veil-fade-bottom)')) return
  }
  assert.fail('the fade element\'s globals.css rule must reference var(--veil-fade-bottom)')
})

test('3.5: the scroll hint "مرّر لتقرا كل الشروط." is present on app/onboarding/page.tsx', () => {
  assert.ok(
    ONBOARDING_PAGE_SRC.includes('مرّر لتقرا كل الشروط.'),
    'app/onboarding/page.tsx must render the hint copy «مرّر لتقرا كل الشروط.» beneath the terms card (spec §2.4)',
  )
})

test('3.5: every class this slice adds to app/onboarding/page.tsx is defined exactly once in globals.css and used at least once under app/', () => {
  const found = findFadeSibling()
  assert.ok(found, 'no fade sibling of .card--inset was found; see the earlier test in this section')
  if (!found) return

  const newClasses = new Set<string>()
  for (const cls of found.wrapper.className.split(/\s+/).filter(Boolean)) newClasses.add(cls)
  for (const cls of found.fade.className.split(/\s+/).filter(Boolean)) newClasses.add(cls)

  const appSources = APP_SOURCE_FILES.filter((f) => f.endsWith('.tsx')).map((f) => readFileSync(f, 'utf8')).join('\n')

  for (const cls of newClasses) {
    const definitionCount = classSelectorDefinitionCount(GLOBALS_CSS, cls)
    assert.equal(
      definitionCount,
      1,
      `.${cls} must be defined exactly once in app/globals.css (found ${definitionCount} definitions), ` +
        'per week 11\'s class-inventory invariant',
    )
    const usageCount = (appSources.match(new RegExp(cls, 'g')) || []).length
    assert.ok(
      usageCount >= 1,
      `.${cls} must be used at least once under app/ (found ${usageCount})`,
    )
  }
})
