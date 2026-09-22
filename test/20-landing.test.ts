// test/20-landing.test.ts
//
// Written from docs/SPEC-week13-landing.md alone, in the confession-w13test
// worktree, by an agent that has not read and must not read the
// implementation of this same slice, which is being written in parallel in
// a different worktree (confession-w13build). Red is the expected and
// correct result for most items in this file today, because this worktree
// carries the week-3 placeholder the spec's section 0 measured, not the
// fix.
//
// This suite is entirely source-level (plain file reads and regexes over
// app/page.tsx, app/onboarding/page.tsx and app/globals.css). There is no
// headless browser available to this agent, so section 5's DOM-measured
// claims (h1 count via document.querySelectorAll, computed font-size, the
// 360x640 CTA bounding rect) are out of reach here and are not attempted.
// Every test below says, in its own assertion message, which spec item it
// enforces and what kind of check it is (exact text, structural regex, or a
// regression guard that is honest about the limits of a text-level scan).
//
// app/offer/[offerId]/page.tsx and app/c/[slug]/page.tsx were opened to
// write item 8's regression guard. They are named in spec section 1 as out
// of scope for this slice -- they are not touched by the agent building
// this slice -- so reading them is reading a fixed reference point, not the
// implementation under test. app/page.tsx, app/onboarding/page.tsx and
// app/globals.css, the three files this slice actually changes, were never
// opened while writing this file; every string compared against them below
// is transcribed by hand from the spec document.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const PAGE_PATH = path.join(REPO_ROOT, 'app', 'page.tsx')
const ONBOARDING_PATH = path.join(REPO_ROOT, 'app', 'onboarding', 'page.tsx')
const GLOBALS_CSS_PATH = path.join(REPO_ROOT, 'app', 'globals.css')
const OFFER_PAGE_PATH = path.join(REPO_ROOT, 'app', 'offer', '[offerId]', 'page.tsx')
const SLUG_PAGE_PATH = path.join(REPO_ROOT, 'app', 'c', '[slug]', 'page.tsx')

function readSource(p: string): string {
  return readFileSync(p, 'utf8')
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0
  const pattern = new RegExp(escapeRegExp(needle), 'g')
  return (haystack.match(pattern) ?? []).length
}

// ---------------------------------------------------------------------------
// The three sentences of spec section 0.1 / section 3, transcribed by hand
// from the spec document, not from app/page.tsx.
// ---------------------------------------------------------------------------

const SENTENCE_1_HEADING = 'تطبيق مصارحة سرية.'
const SENTENCE_2_EXPLAINER =
  'الناس تقدر تبعتلك أي شي وهي متخفية عنك. وإذا حدا حب يصارحك أكتر، فيه ميزة اسمها «صارحني بدورك» بتكشف مين هو، بس إذا هو وافق.'
const SENTENCE_3_INSTRUCTION = 'سجل دخول تبلش.'
const ONBOARDING_SCROLL_HINT = 'مرّر لتقرا كل الشروط.'

// ---------------------------------------------------------------------------
// 1. app/page.tsx: exactly one <h1>, content is sentence 1 byte for byte
//    (spec section 3.1).
// ---------------------------------------------------------------------------

test('section 3.1: app/page.tsx has exactly one h1 element, and its content is sentence 1 byte for byte', () => {
  const source = readSource(PAGE_PATH)
  const h1Matches = [...source.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)]

  assert.equal(
    h1Matches.length,
    1,
    `section 3.1 requires exactly one <h1> element in app/page.tsx; found ${h1Matches.length}`,
  )

  const content = h1Matches[0]![1]!.trim()
  assert.equal(
    content,
    SENTENCE_1_HEADING,
    'section 3.1: the h1 content must be the heading sentence, byte for byte, including its full stop',
  )
})

// ---------------------------------------------------------------------------
// 2. The explainer sentence, byte for byte, inside an element carrying the
//    class landing-pitch (spec section 3.2).
// ---------------------------------------------------------------------------

test('section 3.2: the explainer sentence is present byte for byte in a <p> carrying the class landing-pitch', () => {
  const source = readSource(PAGE_PATH)
  const pitchMatch = /<p\s+className="([^"]*\blanding-pitch\b[^"]*)"[^>]*>([\s\S]*?)<\/p>/.exec(source)

  assert.ok(
    pitchMatch,
    'section 3.2 requires a <p className="landing-pitch"> element in app/page.tsx; none was found',
  )

  const content = pitchMatch![2]!.trim()
  assert.equal(
    content,
    SENTENCE_2_EXPLAINER,
    'section 3.2: the explainer must be the exact sentence, byte for byte, no word added, removed, reworded or reordered (section 2)',
  )
})

// ---------------------------------------------------------------------------
// 3. Sentence 3 is present byte for byte and appears after the
//    card--citron opening (spec section 3.3 moves it inside that block).
// ---------------------------------------------------------------------------

test('section 3.3: sentence 3 is present byte for byte and appears after the card--citron block opens', () => {
  const source = readSource(PAGE_PATH)

  const sentenceIndex = source.indexOf(SENTENCE_3_INSTRUCTION)
  assert.notEqual(sentenceIndex, -1, 'section 3.3: the instruction sentence must be present byte for byte')

  const cardCitronIndex = source.indexOf('card--citron')
  assert.notEqual(
    cardCitronIndex,
    -1,
    'section 3.3 requires a card--citron block in app/page.tsx for the instruction to move into',
  )

  assert.ok(
    sentenceIndex > cardCitronIndex,
    'section 3.3: the instruction sentence must appear after the card--citron opening, i.e. moved inside that block, not before it',
  )
})

// ---------------------------------------------------------------------------
// 4. No {'\n'} literal in app/page.tsx (spec section 3.4).
// ---------------------------------------------------------------------------

test('section 3.4: app/page.tsx contains no literal newline expression ({\'\\n\'} or {"\\n"})', () => {
  const source = readSource(PAGE_PATH)
  assert.ok(
    !/\{\s*['"]\\n['"]\s*\}/.test(source),
    'section 3.4: the {\'\\n\'} literals must be gone; three elements do not need a whitespace mode to look like three elements',
  )
})

// ---------------------------------------------------------------------------
// 5. app/globals.css no longer contains the selector .veil > p:first-child,
//    in any whitespace variant (spec section 4.1).
// ---------------------------------------------------------------------------

test('section 4.1: app/globals.css no longer contains the selector .veil > p:first-child, in any whitespace variant', () => {
  const css = readSource(GLOBALS_CSS_PATH)
  assert.ok(
    !/\.veil\s*>\s*p\s*:\s*first-child/.test(css),
    'section 4.1: the structural selector .veil > p:first-child must be deleted, whitespace-insensitively',
  )
})

// ---------------------------------------------------------------------------
// 6. No white-space: pre-line declaration anywhere in globals.css
//    (spec section 4.1).
// ---------------------------------------------------------------------------

test('section 4.1: app/globals.css contains no white-space: pre-line declaration anywhere', () => {
  const css = readSource(GLOBALS_CSS_PATH)
  assert.ok(
    !/white-space\s*:\s*pre-line/.test(css),
    'section 4.1: white-space: pre-line must be deleted with the rule that carried it, not left behind for a stray newline to reactivate',
  )
})

// ---------------------------------------------------------------------------
// 7. The landing heading's display treatment is reached through an
//    intentional selector containing "landing", setting font:var(--type-display)
//    (spec section 4.1).
// ---------------------------------------------------------------------------

// A simple top-level rule splitter: this does not understand @media nesting
// or nested at-rules, and it is fooled by literal { or } inside a string or
// url() value. Adequate for the flat, unnested rules this stylesheet is
// otherwise written in, and honest about not being a full CSS parser.
function splitTopLevelRules(css: string): { selector: string; body: string }[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: { selector: string; body: string }[] = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(withoutComments))) {
    rules.push({ selector: match[1]!.trim(), body: match[2]! })
  }
  return rules
}

test('section 4.1: app/globals.css has a rule whose selector includes "landing" and sets font:var(--type-display)', () => {
  const css = readSource(GLOBALS_CSS_PATH)
  const rules = splitTopLevelRules(css)

  const hookRule = rules.find(
    (rule) => rule.selector.includes('landing') && /font\s*:\s*var\(\s*--type-display\s*\)/.test(rule.body),
  )

  assert.ok(
    hookRule,
    'section 4.1: the display treatment must move onto the landing h1 through a selector that names "landing" (e.g. .landing h1), not a positional one; no such rule was found',
  )
})

// ---------------------------------------------------------------------------
// 8. Regression guard: the first child inside a veil wrapper on the three
//    named out-of-scope surfaces is not a <p> (spec section 4.1's safety
//    argument for deleting the structural selector).
// ---------------------------------------------------------------------------

// Honest about what this can see: this is a text-level scan, not a JSX/AST
// parse. It finds every `<div className="veil ...">` opening tag and reads
// the next opening tag that follows it in the source text as "the first
// child". It can be fooled by a JSX comment, a conditional expression, or a
// fragment immediately inside the veil div before any real element -- none
// of those are present in the two files this item checks, verified by
// reading them (they are out of this slice's scope and are not touched by
// it), but a future edit could defeat this scan without defeating the
// underlying rule. That is the weaker check the task asked for when a
// robust one is not reachable from source text alone.
function firstChildTagAfterEachVeilOpen(source: string): { veilOpenTag: string; firstChildTag: string | null }[] {
  const veilOpenPattern = /<div\s+className="veil[^"]*"[^>]*>/g
  const results: { veilOpenTag: string; firstChildTag: string | null }[] = []
  let match: RegExpExecArray | null
  while ((match = veilOpenPattern.exec(source))) {
    const rest = source.slice(match.index + match[0].length)
    const childMatch = /<([a-zA-Z][\w-]*)/.exec(rest)
    results.push({ veilOpenTag: match[0], firstChildTag: childMatch ? childMatch[1]! : null })
  }
  return results
}

test('section 4.1 regression guard: app/offer/[offerId]/page.tsx does not open a veil with a <p> as its first child', () => {
  const source = readSource(OFFER_PAGE_PATH)
  const openings = firstChildTagAfterEachVeilOpen(source)

  assert.ok(openings.length > 0, 'expected app/offer/[offerId]/page.tsx to open at least one .veil wrapper')
  for (const opening of openings) {
    assert.notEqual(
      opening.firstChildTag,
      'p',
      `section 4.1: the .veil opening ${opening.veilOpenTag} must not have a <p> as its first child, or it would silently inherit the retired display rule if it were still armed`,
    )
  }
})

test('section 4.1 regression guard: app/c/[slug]/page.tsx does not open a veil with a <p> as its first child, enabled or disabled', () => {
  const source = readSource(SLUG_PAGE_PATH)
  const openings = firstChildTagAfterEachVeilOpen(source)

  assert.ok(
    openings.length >= 2,
    'expected app/c/[slug]/page.tsx to open at least two .veil wrappers, one for the enabled branch and one for the disabled branch',
  )
  for (const opening of openings) {
    assert.notEqual(
      opening.firstChildTag,
      'p',
      `section 4.1: the .veil opening ${opening.veilOpenTag} must not have a <p> as its first child, or it would silently inherit the retired display rule if it were still armed`,
    )
  }
})

// ---------------------------------------------------------------------------
// 9 & 10. The bottom fade uses --veil-fade-bottom and sets
//    pointer-events: none (spec section 4.2).
// ---------------------------------------------------------------------------

test('section 4.2: app/globals.css uses the --veil-fade-bottom token at least once', () => {
  const css = readSource(GLOBALS_CSS_PATH)
  assert.ok(
    /var\(\s*--veil-fade-bottom\s*\)/.test(css),
    'section 4.2: --veil-fade-bottom is defined by the design system and unused today; the fade must consume it with var(--veil-fade-bottom)',
  )
})

test('section 4.2: the rule that uses --veil-fade-bottom also sets pointer-events: none', () => {
  const css = readSource(GLOBALS_CSS_PATH)
  const rules = splitTopLevelRules(css)

  const fadeRules = rules.filter((rule) => /var\(\s*--veil-fade-bottom\s*\)/.test(rule.body))
  assert.ok(fadeRules.length > 0, 'section 4.2: expected at least one rule body using var(--veil-fade-bottom)')

  for (const rule of fadeRules) {
    assert.ok(
      /pointer-events\s*:\s*none/.test(rule.body),
      `section 4.2: the fade rule (selector: ${rule.selector}) must set pointer-events: none, or it becomes a dead strip a thumb cannot scroll through`,
    )
  }
})

// ---------------------------------------------------------------------------
// 11. Onboarding hint string, byte for byte (spec section 4.2).
// ---------------------------------------------------------------------------

test('section 4.2: app/onboarding/page.tsx contains the scroll hint string byte for byte', () => {
  const source = readSource(ONBOARDING_PATH)
  assert.ok(
    source.includes(ONBOARDING_SCROLL_HINT),
    'section 4.2: the hint "مرّر لتقرا كل الشروط." must be present byte for byte, including the shadda',
  )
})

// ---------------------------------------------------------------------------
// 12. The onboarding terms card keeps overflow-y: auto and a max-height
//    (spec section 4.2; section 6.2 rejects removing the scroll box).
// ---------------------------------------------------------------------------

test('section 4.2 / 6.2: the .card--inset rule(s) in app/globals.css still have overflow-y: auto and a max-height', () => {
  const css = readSource(GLOBALS_CSS_PATH)
  const rules = splitTopLevelRules(css)

  const insetRules = rules.filter((rule) => rule.selector.includes('card--inset'))
  assert.ok(insetRules.length > 0, 'expected at least one rule selecting .card--inset in app/globals.css')

  const combinedBody = insetRules.map((rule) => rule.body).join('\n')
  assert.ok(
    /overflow-y\s*:\s*auto/.test(combinedBody),
    'section 4.2/6.2: .card--inset must keep overflow-y: auto; the scroll box is the right pattern and section 6.2 rejects removing it',
  )
  assert.ok(
    /max-height\s*:/.test(combinedBody),
    'section 4.2/6.2: .card--inset must keep a max-height; nothing may be truncated to make the box fit',
  )
})

// ---------------------------------------------------------------------------
// 13. No em-dash (U+2014) or en-dash (U+2013) in the two page files.
// ---------------------------------------------------------------------------

test('cross-cutting: app/page.tsx contains no em-dash or en-dash character', () => {
  const source = readSource(PAGE_PATH)
  assert.ok(!source.includes('\u2014'), 'app/page.tsx must contain no em-dash (U+2014)')
  assert.ok(!source.includes('\u2013'), 'app/page.tsx must contain no en-dash (U+2013)')
})

test('cross-cutting: app/onboarding/page.tsx contains no em-dash or en-dash character', () => {
  const source = readSource(ONBOARDING_PATH)
  assert.ok(!source.includes('\u2014'), 'app/onboarding/page.tsx must contain no em-dash (U+2014)')
  assert.ok(!source.includes('\u2013'), 'app/onboarding/page.tsx must contain no en-dash (U+2013)')
})

// ---------------------------------------------------------------------------
// 14. No trace of the tool that built this in a comment, in the two page
//    files or in any globals.css rule attributable to this slice.
// ---------------------------------------------------------------------------

const FORBIDDEN_WORD_PATTERN = /\b(assistant|AI|Claude|GPT|Gemini|model)\b/i

function extractJsComments(source: string): string[] {
  // Also picks up // inside string/URL literals; a false positive there
  // would only ever make this test fail when it shouldn't, never pass when
  // it shouldn't, so it is the safe direction for a text-level scan to err
  // in.
  return [...source.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g)].map((m) => m[0])
}

test('cross-cutting: no comment in app/page.tsx names the tool that built it', () => {
  const source = readSource(PAGE_PATH)
  const comments = extractJsComments(source)
  for (const comment of comments) {
    assert.ok(
      !FORBIDDEN_WORD_PATTERN.test(comment),
      `app/page.tsx must not carry a comment naming an assistant/AI/model: ${JSON.stringify(comment)}`,
    )
  }
})

test('cross-cutting: no comment in app/onboarding/page.tsx names the tool that built it', () => {
  const source = readSource(ONBOARDING_PATH)
  const comments = extractJsComments(source)
  for (const comment of comments) {
    assert.ok(
      !FORBIDDEN_WORD_PATTERN.test(comment),
      `app/onboarding/page.tsx must not carry a comment naming an assistant/AI/model: ${JSON.stringify(comment)}`,
    )
  }
})

// CSS comments are attributed to this slice by proximity: a comment is
// counted as belonging to the slice if the text immediately following it
// (before the next comment) mentions one of this slice's own hooks --
// "landing", "landing-pitch", "card--inset" or "veil-fade-bottom". A
// stylesheet-wide sweep was rejected on purpose: globals.css carries many
// rules this slice never touches, and this item only speaks for the ones it
// can attribute to this slice.
function cssCommentsAttributableToSlice(css: string): string[] {
  const sliceMarkers = ['landing', 'card--inset', 'veil-fade-bottom']
  const commentPattern = /\/\*([\s\S]*?)\*\//g
  const attributed: string[] = []
  let match: RegExpExecArray | null
  while ((match = commentPattern.exec(css))) {
    const commentEnd = match.index + match[0].length
    const nextCommentStart = css.indexOf('/*', commentEnd)
    const windowEnd = nextCommentStart === -1 ? Math.min(css.length, commentEnd + 600) : nextCommentStart
    const followingText = css.slice(commentEnd, windowEnd)
    if (sliceMarkers.some((marker) => followingText.includes(marker))) {
      attributed.push(match[1]!)
    }
  }
  return attributed
}

test('cross-cutting: no CSS rule attributable to this slice in app/globals.css names the tool that built it', () => {
  const css = readSource(GLOBALS_CSS_PATH)
  const comments = cssCommentsAttributableToSlice(css)
  for (const comment of comments) {
    assert.ok(
      !FORBIDDEN_WORD_PATTERN.test(comment),
      `a comment attributed to this slice in app/globals.css must not name an assistant/AI/model: ${JSON.stringify(comment)}`,
    )
  }
})

// ---------------------------------------------------------------------------
// 15. The copy rule as one assertion: each of the three sentences appears
//    exactly once in app/page.tsx (spec section 2).
// ---------------------------------------------------------------------------

test('section 2: each of the three landing sentences appears in app/page.tsx exactly once', () => {
  const source = readSource(PAGE_PATH)

  assert.equal(
    countOccurrences(source, SENTENCE_1_HEADING),
    1,
    'section 2: sentence 1 (the heading) must appear exactly once, unchanged',
  )
  assert.equal(
    countOccurrences(source, SENTENCE_2_EXPLAINER),
    1,
    'section 2: sentence 2 (the explainer) must appear exactly once, unchanged',
  )
  assert.equal(
    countOccurrences(source, SENTENCE_3_INSTRUCTION),
    1,
    'section 2: sentence 3 (the instruction) must appear exactly once, unchanged',
  )
})
