// test/21-design-system.test.ts
//
// Written from docs/SPEC-week11-design-system.md section 6, items 1 through
// 10 and 17 through 18, alone. The implementation of this slice is being
// built in a different worktree, on a different branch, and is not read
// here at all: every assertion below is derived from the spec text and from
// the design system directory (design/masaraha-design-system/), which is
// the design of record and stays byte-identical to what was committed.
//
// Almost everything in this file is expected to fail against this worktree,
// because this worktree still carries the placeholder app/globals.css from
// week 3 and none of the class-layer or screen work section 2 and section 3
// describe. Items 17 and 18 are the exception worth naming up front: item 17
// diffs the working tree against `main`, and in this worktree the working
// tree and `main` are the same commit, so the field-name sets it compares
// are trivially equal and the item is legitimately green here, since it is a
// regression guard, not a feature test, and it will only turn red if a
// future change actually renames a field. Item 18 is the opposite case: it
// requires src/terms.ts to differ from `main` by exactly the four asterisk
// characters section 5 describes, and in this untouched worktree it does not
// differ at all, so it is correctly red until that correction lands.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')
const SRC_DIR = path.join(REPO_ROOT, 'src')
const GLOBALS_CSS_PATH = path.join(APP_DIR, 'globals.css')
const TOKENS_DIR = path.join(REPO_ROOT, 'design', 'masaraha-design-system', 'tokens')

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function readIfExists(p: string): string | null {
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

function toRelPosix(absPath: string): string {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join('/')
}

// Recursively lists every file under a directory whose name passes the
// predicate. No glob dependency is added; the project has none.
function listFilesRecursive(dir: string, predicate: (name: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      listFilesRecursive(full, predicate, out)
    } else if (entry.isFile() && predicate(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function listAppFiles(predicate: (name: string) => boolean): string[] {
  return listFilesRecursive(APP_DIR, predicate)
}

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

// Finds every :root{...} block that sits at brace depth 0 in the given CSS
// text: a real top-level :root rule, not one nested inside an @media block
// (motion.css's prefers-reduced-motion block declares its own nested :root
// with different values for the same names, and those must not be read as
// the token declarations proper; item 4 checks that block on its own
// terms). This is a plain character scan rather than a regex because a
// regex cannot balance nested braces.
function extractTopLevelRootBlocks(css: string): string[] {
  const blocks: string[] = []
  let depth = 0
  let i = 0
  while (i < css.length) {
    const ch = css[i]
    if (ch === '{') {
      depth++
      i++
      continue
    }
    if (ch === '}') {
      depth--
      i++
      continue
    }
    if (depth === 0 && css.startsWith(':root', i)) {
      let j = i + 5
      while (j < css.length && /\s/.test(css[j])) j++
      if (css[j] === '{') {
        let braceDepth = 0
        let k = j
        const start = j + 1
        while (k < css.length) {
          if (css[k] === '{') braceDepth++
          else if (css[k] === '}') {
            braceDepth--
            if (braceDepth === 0) break
          }
          k++
        }
        blocks.push(css.slice(start, k))
        i = k + 1
        continue
      }
    }
    i++
  }
  return blocks
}

// Parses every `--name:value;` declaration out of a :root block's inner
// text, after stripping comments. Splitting on `;` is safe here because none
// of the values in this design system (colours, gradients, cubic-beziers,
// shadow lists) contain a literal semicolon. Values are normalised by
// collapsing internal whitespace, per item 2's own "equal after collapsing
// whitespace" rule (the stricter "byte-identical" phrase in spec section 1.3
// is the prose statement of the same rule; item 2's text is what this test
// implements).
function parseDeclarations(blockText: string): Map<string, string> {
  const cleaned = stripCssComments(blockText)
  const map = new Map<string, string>()
  for (const raw of cleaned.split(';')) {
    const trimmed = raw.trim()
    if (!trimmed.startsWith('--')) continue
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue
    const name = trimmed.slice(0, colonIndex).trim()
    const value = trimmed.slice(colonIndex + 1).trim().replace(/\s+/g, ' ')
    if (name) map.set(name, value)
  }
  return map
}

// Every custom property declared in a top-level :root block anywhere in the
// given CSS text, across every such block in the file.
function collectDeclaredCustomProps(css: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const block of extractTopLevelRootBlocks(css)) {
    for (const [name, value] of parseDeclarations(block)) {
      result.set(name, value)
    }
  }
  return result
}

type TokenEntry = { value: string; file: string }

// Every --name:value declared in a :root block of any file under
// design/masaraha-design-system/tokens/, tagged with the file it came from
// so a mismatch can be reported by name (item 2).
function collectDesignSystemTokens(): Map<string, TokenEntry> {
  const result = new Map<string, TokenEntry>()
  const files = readdirSync(TOKENS_DIR).filter((f) => f.endsWith('.css')).sort()
  for (const file of files) {
    const css = readFileSync(path.join(TOKENS_DIR, file), 'utf8')
    for (const [name, value] of collectDeclaredCustomProps(css)) {
      result.set(name, { value, file })
    }
  }
  return result
}

function globalsCssText(): string {
  const css = readIfExists(GLOBALS_CSS_PATH)
  assert.ok(css, `app/globals.css must exist; looked at ${GLOBALS_CSS_PATH}`)
  return css!
}

// Extracts every class token that appears in a className="..." literal or in
// a quoted string segment inside a className={...} expression, under app/.
// Template-literal interpolations (${...}) are stripped before splitting on
// whitespace so a variable reference embedded in a template string is never
// mistaken for a class name.
function extractUsedClassNames(src: string): Set<string> {
  const classes = new Set<string>()
  const isValidToken = (token: string) => /^[A-Za-z_][\w-]*$/.test(token)

  const staticAttrPattern = /className="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = staticAttrPattern.exec(src))) {
    for (const token of m[1].split(/\s+/)) {
      if (token && isValidToken(token)) classes.add(token)
    }
  }

  const exprStartPattern = /className=\{/g
  while ((m = exprStartPattern.exec(src))) {
    const start = m.index + m[0].length
    let depth = 1
    let i = start
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') depth--
      i++
    }
    const exprText = src.slice(start, i - 1)
    const literalPattern = /'([^']*)'|"([^"]*)"|`([^`]*)`/g
    let sm: RegExpExecArray | null
    while ((sm = literalPattern.exec(exprText))) {
      const literal = sm[1] ?? sm[2] ?? sm[3] ?? ''
      const withoutInterpolation = literal.replace(/\$\{[^}]*\}/g, ' ')
      for (const token of withoutInterpolation.split(/\s+/)) {
        if (token && isValidToken(token)) classes.add(token)
      }
    }
  }
  return classes
}

// Every `.token` class selector defined anywhere in the given CSS text
// (comments stripped first, so a class mentioned only in a comment does not
// count as defined).
function extractDefinedClassSelectors(css: string): Set<string> {
  const cleaned = stripCssComments(css)
  const set = new Set<string>()
  const pattern = /\.([A-Za-z_][\w-]*)/g
  let m: RegExpExecArray | null
  while ((m = pattern.exec(cleaned))) set.add(m[1])
  return set
}

function gitShowMain(relPath: string): string | null {
  const result = spawnSync('git', ['show', `main:${relPath}`], { cwd: REPO_ROOT, encoding: 'utf8' })
  if (result.status !== 0) return null
  return result.stdout
}

// ---------------------------------------------------------------------------
// Item 1
// ---------------------------------------------------------------------------

// Read at its strictest, per spec section 1.2: "the tripwire for it (§6 item
// 1) has to be a flat 'the string does not appear'." No exception is carved
// out for a comment, including the header comment section 2 requires, which
// restates the no-external-asset rule. That means the header comment cannot
// spell out the literal substrings "@import" or "url(" while describing the
// rule it enforces; it has to describe the rule some other way. The
// placeholder header comment on main does spell them out today, which is
// why this item is expected to be red in this worktree even though the
// placeholder stylesheet has no real @import or url( anywhere in its rules.
test('item 1: app/globals.css contains no @import and no url(, case-insensitive (spec section 6 item 1)', () => {
  const css = globalsCssText()
  assert.doesNotMatch(css, /@import/i, 'app/globals.css must not contain @import in any casing, including in comments')
  assert.doesNotMatch(css, /url\(/i, 'app/globals.css must not contain url( in any casing, including in comments')
})

// ---------------------------------------------------------------------------
// Item 2
// ---------------------------------------------------------------------------

test('item 2: every design token appears in app/globals.css with the same value after collapsing whitespace (spec section 6 item 2)', () => {
  const designTokens = collectDesignSystemTokens()
  assert.ok(designTokens.size > 0, 'expected to parse at least one token from design/masaraha-design-system/tokens/*.css')

  const appTokens = collectDeclaredCustomProps(globalsCssText())

  const missing: string[] = []
  const mismatched: Array<{ name: string; file: string; expected: string; actual: string }> = []
  for (const [name, { value, file }] of designTokens) {
    if (!appTokens.has(name)) {
      missing.push(`${name} (from ${file}, expected "${value}")`)
      continue
    }
    const actual = appTokens.get(name)!
    if (actual !== value) {
      mismatched.push({ name, file, expected: value, actual })
    }
  }

  assert.deepEqual(missing, [], `these design tokens are missing from app/globals.css entirely: ${JSON.stringify(missing)}`)

  const first = mismatched[0]
  assert.deepEqual(
    mismatched,
    [],
    first
      ? `${mismatched.length} token(s) differ between the design system and app/globals.css; first mismatch: ` +
        `${first.name} (from ${first.file}) expected "${first.expected}", app/globals.css has "${first.actual}"`
      : '',
  )
})

// ---------------------------------------------------------------------------
// Item 3
// ---------------------------------------------------------------------------

test('item 3: app/globals.css contains no @font-face, no http://, no https:// (spec section 6 item 3)', () => {
  const css = globalsCssText()
  // Deliberately a flat substring search over the whole file, including
  // comments: spec section 1.2 states this tripwire "has to be a flat 'the
  // string does not appear'" precisely so a careless comment cannot smuggle
  // an external URL past review either.
  assert.ok(!css.includes('@font-face'), 'app/globals.css must not contain @font-face')
  assert.ok(!css.includes('http://'), 'app/globals.css must not contain the literal string http://')
  assert.ok(!css.includes('https://'), 'app/globals.css must not contain the literal string https://')
})

// ---------------------------------------------------------------------------
// Item 4
// ---------------------------------------------------------------------------

function findMediaReducedMotionBlock(css: string): string | null {
  const mediaPattern = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i
  const m = mediaPattern.exec(css)
  if (!m) return null
  const braceStart = css.indexOf('{', m.index + m[0].length)
  if (braceStart === -1) return null
  let depth = 0
  for (let i = braceStart; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return css.slice(braceStart + 1, i)
    }
  }
  return null
}

test('item 4: the @media (prefers-reduced-motion:reduce) block is present in app/globals.css and sets --dur-reveal to 1ms (spec section 6 item 4)', () => {
  const css = globalsCssText()
  const block = findMediaReducedMotionBlock(css)
  assert.ok(block, 'app/globals.css must contain an @media (prefers-reduced-motion:reduce) block')

  const normalized = stripCssComments(block!).replace(/\s+/g, '')
  assert.ok(
    normalized.includes('--dur-reveal:1ms'),
    `the prefers-reduced-motion block must set --dur-reveal to 1ms; block content: ${block}`,
  )
})

// ---------------------------------------------------------------------------
// Item 5
// ---------------------------------------------------------------------------

test('item 5: class coverage both directions, every class used in a screen is defined in app/globals.css, and every class defined in app/globals.css is used somewhere under app/ (spec section 6 item 5)', () => {
  const tsxFiles = listAppFiles((name) => name.endsWith('.tsx'))
  assert.ok(tsxFiles.length > 0, `expected to find .tsx files under ${APP_DIR}`)

  const used = new Set<string>()
  const usedIn = new Map<string, string>()
  for (const file of tsxFiles) {
    const src = readFileSync(file, 'utf8')
    for (const cls of extractUsedClassNames(src)) {
      used.add(cls)
      if (!usedIn.has(cls)) usedIn.set(cls, toRelPosix(file))
    }
  }

  const defined = extractDefinedClassSelectors(globalsCssText())

  const usedButUndefined = [...used].filter((c) => !defined.has(c)).sort()
  assert.deepEqual(
    usedButUndefined,
    [],
    `these classes are used under app/ but have no matching .token selector in app/globals.css: ` +
      `${JSON.stringify(usedButUndefined.map((c) => `${c} (first seen in ${usedIn.get(c)})`))}`,
  )

  const definedButUnused = [...defined].filter((c) => !used.has(c)).sort()
  assert.deepEqual(
    definedButUnused,
    [],
    `these classes are defined in the class layer of app/globals.css but are used nowhere under app/ (dead classes): ${JSON.stringify(definedButUnused)}`,
  )
})

// ---------------------------------------------------------------------------
// Item 6
// ---------------------------------------------------------------------------

test('item 6: --font-ar in app/globals.css equals the value in design/masaraha-design-system/tokens/typography.css after whitespace collapse (spec section 6 item 6)', () => {
  const typographyCss = readFileSync(path.join(TOKENS_DIR, 'typography.css'), 'utf8')
  const designValue = collectDeclaredCustomProps(typographyCss).get('--font-ar')
  assert.ok(designValue, 'expected to find --font-ar declared in design/masaraha-design-system/tokens/typography.css')

  const appValue = collectDeclaredCustomProps(globalsCssText()).get('--font-ar')
  assert.equal(
    appValue,
    designValue,
    `--font-ar in app/globals.css must equal "${designValue}"; found ${appValue === undefined ? 'nothing declared' : `"${appValue}"`}`,
  )
})

// ---------------------------------------------------------------------------
// Item 7
// ---------------------------------------------------------------------------

// Extended_Pictographic and Regional_Indicator are the Unicode properties
// that identify emoji-like pictographs and flag components respectively.
// This is a property test, not a hardcoded list of "favourite" emoji, and it
// runs against every character in the file rather than a fixed set of
// codepoints. It deliberately does NOT match plain digits or punctuation
// (unlike the bare \p{Emoji} property, which also matches ASCII digits and
// '#'/'*' because they participate in keycap emoji sequences) and it
// deliberately does NOT match U+2713 (✓) or U+00B7 (·), the two glyphs the
// design system readme explicitly permits as non-emoji marks.
const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u

test('item 7: no emoji anywhere under app/ or in src/*.ts (spec section 6 item 7)', () => {
  const appFiles = listAppFiles(() => true)
  const srcFiles = readdirSync(SRC_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => path.join(SRC_DIR, f))
  const files = [...appFiles, ...srcFiles]
  assert.ok(files.length > 0, 'expected to find files under app/ and src/*.ts')

  const offenders: string[] = []
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const match = EMOJI_PATTERN.exec(lines[i])
      if (match) {
        offenders.push(`${toRelPosix(file)}:${i + 1} contains "${match[0]}" (U+${match[0].codePointAt(0)!.toString(16).toUpperCase()})`)
      }
    }
  }

  assert.deepEqual(offenders, [], `emoji found: ${JSON.stringify(offenders)}`)
})

// ---------------------------------------------------------------------------
// Item 8
// ---------------------------------------------------------------------------

// Built from a code point rather than the literal glyph so this file itself
// carries no em-dash character.
const EM_DASH = String.fromCharCode(0x2014)

test('item 8: no em-dash appears on any non-comment line of any .tsx file under app/ (spec section 6 item 8)', () => {
  const tsxFiles = listAppFiles((name) => name.endsWith('.tsx'))
  assert.ok(tsxFiles.length > 0, `expected to find .tsx files under ${APP_DIR}`)

  const offenders: string[] = []
  for (const file of tsxFiles) {
    const lines = readFileSync(file, 'utf8').split('\n')
    let inJsxComment = false
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()

      if (inJsxComment) {
        if (trimmed.includes('*/}')) inJsxComment = false
        continue
      }

      const isPrefixComment = trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')
      const opensJsxComment = trimmed.startsWith('{/*')
      if (opensJsxComment && !trimmed.includes('*/}')) {
        inJsxComment = true
      }
      if (isPrefixComment || opensJsxComment) continue

      if (lines[i].includes(EM_DASH)) {
        offenders.push(`${toRelPosix(file)}:${i + 1}: ${lines[i].trim()}`)
      }
    }
  }

  assert.deepEqual(offenders, [], `em-dash found on non-comment lines: ${JSON.stringify(offenders)}`)
})

// ---------------------------------------------------------------------------
// Item 9
// ---------------------------------------------------------------------------

test('item 9: .btn--reveal is used only on the inbox and the offer screen; --glow-rose and --veil-rose appear only in app/globals.css, never in a .tsx file (spec section 6 item 9)', () => {
  const tsxFiles = listAppFiles((name) => name.endsWith('.tsx'))

  const revealUsers = tsxFiles
    .filter((f) => /\bbtn--reveal\b/.test(readFileSync(f, 'utf8')))
    .map(toRelPosix)
    .sort()

  const expectedRevealUsers = ['app/inbox/page.tsx', 'app/offer/[offerId]/page.tsx'].sort()
  assert.deepEqual(
    revealUsers,
    expectedRevealUsers,
    `.btn--reveal must be used in exactly ${JSON.stringify(expectedRevealUsers)} (the reveal offer and the accept action); found in ${JSON.stringify(revealUsers)}`,
  )

  const css = globalsCssText()
  assert.ok(css.includes('--glow-rose'), 'app/globals.css must declare --glow-rose')
  assert.ok(css.includes('--veil-rose'), 'app/globals.css must declare --veil-rose')

  const rogueTokenFiles: string[] = []
  for (const file of tsxFiles) {
    const src = readFileSync(file, 'utf8')
    if (src.includes('--glow-rose') || src.includes('--veil-rose')) {
      rogueTokenFiles.push(toRelPosix(file))
    }
  }
  assert.deepEqual(
    rogueTokenFiles,
    [],
    `--glow-rose / --veil-rose must never appear in a .tsx file (rose is applied through the class layer, not referenced directly): ${JSON.stringify(rogueTokenFiles)}`,
  )
})

// ---------------------------------------------------------------------------
// Item 10
// ---------------------------------------------------------------------------

test('item 10: no .tsx file under app/ contains a use-client directive (spec section 6 item 10)', () => {
  const tsxFiles = listAppFiles((name) => name.endsWith('.tsx'))
  assert.ok(tsxFiles.length > 0, `expected to find .tsx files under ${APP_DIR}`)

  const offenders = tsxFiles
    .filter((f) => {
      const src = readFileSync(f, 'utf8')
      return src.includes("'use client'") || src.includes('"use client"')
    })
    .map(toRelPosix)

  assert.deepEqual(
    offenders,
    [],
    `these .tsx files under app/ carry a use-client directive, but this app ships zero client JavaScript: ${JSON.stringify(offenders)}`,
  )
})

// ---------------------------------------------------------------------------
// Item 17
// ---------------------------------------------------------------------------

// A form's action= handler name: the bare identifier for an expression
// action={handlerName}, or the literal path string for a static
// action="/some/path". Multi-line form tags are handled because the
// attribute search runs over the whole file, not line by line.
function extractFormActionIdentifiers(src: string): string[] {
  const pattern = /<form\b[^>]*\baction=(\{[^}]*\}|"[^"]*"|'[^']*')/g
  const identifiers: string[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(src))) {
    const raw = m[1]
    const normalized = raw.startsWith('{') ? raw.slice(1, -1).trim() : raw.slice(1, -1)
    identifiers.push(`action:${normalized}`)
  }
  return identifiers
}

// Every name="..." found on an <input>, <textarea> or <select> tag, tags
// found by scanning for the opening token and taking everything up to the
// tag's closing '>' (so multi-line attribute lists, as in
// app/admin/reports/page.tsx, are covered).
function extractFieldNames(src: string): string[] {
  const tagPattern = /<(input|textarea|select)\b[\s\S]*?>/g
  const names: string[] = []
  let m: RegExpExecArray | null
  while ((m = tagPattern.exec(src))) {
    const tagText = m[0]
    const namePattern = /\bname\s*=\s*(?:"([^"]*)"|'([^']*)')/
    const nm = namePattern.exec(tagText)
    if (nm) names.push(`name:${nm[1] ?? nm[2]}`)
  }
  return names
}

function extractFieldIdentifierSet(src: string): Set<string> {
  return new Set([...extractFormActionIdentifiers(src), ...extractFieldNames(src)])
}

test('item 17: every form action= handler name and every name="..." on an input, textarea or select under app/ is unchanged from main (spec section 6 item 17)', () => {
  const tsxFiles = listAppFiles((name) => name.endsWith('.tsx'))
  assert.ok(tsxFiles.length > 0, `expected to find .tsx files under ${APP_DIR}`)

  const report: string[] = []
  for (const file of tsxFiles) {
    const relPath = toRelPosix(file)
    const oldSrc = gitShowMain(relPath)
    if (oldSrc === null) continue // file did not exist on main; nothing to preserve
    const newSrc = readFileSync(file, 'utf8')

    const oldSet = extractFieldIdentifierSet(oldSrc)
    const newSet = extractFieldIdentifierSet(newSrc)

    const added = [...newSet].filter((x) => !oldSet.has(x)).sort()
    const removed = [...oldSet].filter((x) => !newSet.has(x)).sort()

    if (added.length > 0 || removed.length > 0) {
      report.push(`${relPath}: added ${JSON.stringify(added)}, removed ${JSON.stringify(removed)}`)
    }
  }

  assert.deepEqual(report, [], `form action= handlers and field names changed from main: ${JSON.stringify(report)}`)
})

// ---------------------------------------------------------------------------
// Item 18
// ---------------------------------------------------------------------------

test('item 18: src/terms.ts differs from main in exactly the four asterisk characters of section 5 and nothing else (spec section 6 item 18)', () => {
  const relPath = 'src/terms.ts'
  const oldSrc = gitShowMain(relPath)
  assert.ok(oldSrc, `expected git show main:${relPath} to succeed`)

  const newSrc = readIfExists(path.join(REPO_ROOT, relPath))
  assert.ok(newSrc, `${relPath} must exist`)

  // The four asterisks appear three times in main, not once: twice inside
  // the header comment that quotes the clause while explaining why the
  // markup was kept, and once in the clause the app actually renders. A
  // first-occurrence replace() therefore rewrites the comment and leaves the
  // clause alone, making `expected` a file that no correct implementation
  // could ever produce. Anchor on the single-line clause form instead -- the
  // comment wraps the same sentence across two `// ` lines, so this string
  // occurs exactly once, and that is asserted rather than assumed.
  const CLAUSE_BOLD = 'hidden **from you**. But you should know:'
  const CLAUSE_PLAIN = 'hidden from you. But you should know:'
  assert.equal(
    oldSrc!.split(CLAUSE_BOLD).length - 1,
    1,
    `test setup: main's src/terms.ts must contain "${CLAUSE_BOLD}" exactly once for this test to mean anything`,
  )

  const expected = oldSrc!.replace(CLAUSE_BOLD, CLAUSE_PLAIN)

  assert.notEqual(
    newSrc,
    oldSrc,
    'src/terms.ts must be corrected: it is currently byte-identical to main, but section 5 requires the four ' +
      'asterisks around "from you" to be stripped',
  )
  assert.equal(
    newSrc,
    expected,
    'src/terms.ts must differ from main in exactly the four asterisk characters around "from you" and nothing else',
  )
})
