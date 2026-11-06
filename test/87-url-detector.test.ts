// test/87-url-detector.test.ts
//
// docs/SPEC-week35-url-detector.md §3 and §5.3 (§5.3 wins where they differ):
// acceptance for the wider url detector in scripts/patch-next-body-warning.mjs.
// Any whole-word occurrence of one of 19 names within 400 characters of the
// warning text is flagged, in .js, .mjs and .cjs targets. Written from the spec
// only: the change to the script was not opened while writing this file.
//
// The script is always run as a subprocess (process.execPath) with its cwd set
// to a scratch directory. A target is a .js file under scratch
// node_modules/next/dist whose text holds the warning text with a flagged shape
// within 400 characters of it. Every subprocess gets an explicit env object
// (PATH and a scratch HOME) and never process.env, so no CTL_* variable of the
// session can reach a child. The real node_modules is only read, never written.
// Scratch directories are removed in a finally.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'patch-next-body-warning.mjs')
const REAL_DIST = path.join(REPO_ROOT, 'node_modules', 'next', 'dist')

// The three real copies of the warning, relative to next/dist.
const COPIES = [
  'server/body-streams.js',
  'esm/server/body-streams.js',
  'compiled/next-server/server.runtime.prod.js',
]

// Spec §5.1: the names the detector knows.
const NAMES = [
  'url',
  'originalUrl',
  'nextUrl',
  'href',
  'pathname',
  'search',
  'searchParams',
  'query',
  'headers',
  'rawHeaders',
  'host',
  'hostname',
  'origin',
  'referer',
  'referrer',
  'cookies',
  'path',
  'ip',
  'socket',
]

const WARNING_TEXT = 'Request body exceeded'

// --- scratch helpers ---------------------------------------------------

function childEnv(home: string): NodeJS.ProcessEnv {
  return { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: home } as unknown as NodeJS.ProcessEnv
}

type Run = { status: number | null; stdout: string; stderr: string; out: string }

// A missing script also exits 1 (node cannot find the file), which would make
// every "exits 1" test below pass for the wrong reason. So the file's presence
// is asserted first.
function runScript(cwd: string, args: string[] = []): Run {
  assert.ok(existsSync(SCRIPT_PATH), 'scripts/patch-next-body-warning.mjs does not exist')
  const r = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd,
    env: childEnv(cwd),
    encoding: 'utf8',
    timeout: 60_000,
  })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', out: (r.stdout ?? '') + (r.stderr ?? '') }
}

function withScratch(fn: (root: string) => void): void {
  const root = mkdtempSync(path.join(os.tmpdir(), 'w35-url-detector-'))
  try {
    fn(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function distOf(root: string): string {
  return path.join(root, 'node_modules', 'next', 'dist')
}

function writeFixture(dist: string, rel: string, text: string): string {
  const dest = path.join(dist, rel)
  mkdirSync(path.dirname(dest), { recursive: true })
  writeFileSync(dest, text)
  return dest
}

function assertReportedFailure(r: Run): void {
  assert.equal(r.status, 1, `expected exit 1: ${r.out}`)
  assert.ok(r.out.trim().length > 0, 'a failing run should say why')
  assert.ok(!/^\s+at .*:\d+:\d+\)?$/m.test(r.out), `a failing run should report, not crash with a stack: ${r.out}`)
}

// A scratch dist that holds only the one fixture, so the output can only be
// about that file. The patch run must exit 1, name the file and leave it
// byte-identical; --check on the same directory must exit 1 too.
function assertRejected(fileName: string, text: string): void {
  withScratch((root) => {
    const dist = distOf(root)
    const file = writeFixture(dist, `server/${fileName}`, text)
    const before = readFileSync(file, 'utf8')

    const patch = runScript(root)
    assertReportedFailure(patch)
    assert.ok(patch.out.includes(fileName), `the failing file should be named: ${patch.out}`)
    assert.ok(readFileSync(file, 'utf8') === before, 'the patch run changed the file')

    const check = runScript(root, ['--check', dist])
    assertReportedFailure(check)
    assert.ok(readFileSync(file, 'utf8') === before, '--check changed the file')
  })
}

// --- fixture text ------------------------------------------------------

// A function with the warning line in the middle. `before` and `after` are
// whole statements; `inWarning` is text spliced into the template warning after
// " for "; `warnLine` replaces the warning line outright; `param` is the
// function's parameter. None of it holds the known assignment.
function fixture(opts: {
  param?: string
  before?: string[]
  inWarning?: string
  warnLine?: string
  after?: string[]
}): string {
  const tail = opts.inWarning === undefined ? '' : ' for ' + opts.inWarning
  const warn = opts.warnLine ?? 'console.warn(`Request body exceeded 10MB' + tail + '. Only the first 10MB`);'
  return [
    `function a(${opts.param ?? 'r'}) {`,
    ...(opts.before ?? []).map((s) => '  ' + s),
    '  ' + warn,
    ...(opts.after ?? []).map((s) => '  ' + s),
    '}',
    '',
  ].join('\n')
}

type Form = { label: string; fixture: string }

// Spec §5.3 item 1: one NAME in each of the listed positions.
function formsFor(n: string): Form[] {
  const tpl = (inWarning: string): string => fixture({ inWarning })
  return [
    { label: `member r.${n}`, fixture: tpl('${r.' + n + '}') },
    { label: `optional member r?.${n}`, fixture: tpl('${r?.' + n + '}') },
    { label: `bracket r['${n}']`, fixture: tpl("${r['" + n + "']}") },
    { label: `bracket r["${n}"]`, fixture: tpl('${r["' + n + '"]}') },
    { label: 'bracket r[`' + n + '`]', fixture: tpl('${r[`' + n + '`]}') },
    { label: `destructure { ${n}: u }`, fixture: fixture({ before: [`const { ${n}: u } = r;`], inWarning: '${u}' }) },
    { label: `shorthand { ${n} }`, fixture: fixture({ before: [`const { ${n} } = r;`] }) },
    { label: `shorthand {${n}, method}`, fixture: fixture({ before: [`const {${n}, method} = r;`] }) },
    { label: `shorthand { method, ${n} }`, fixture: fixture({ before: [`const { method, ${n} } = r;`] }) },
    { label: `default {${n} = ''}`, fixture: fixture({ before: [`const {${n} = ''} = r;`] }) },
    { label: `double-quoted key {"${n}": u}`, fixture: fixture({ before: [`const {"${n}": u} = r;`] }) },
    { label: `single-quoted key {'${n}': u}`, fixture: fixture({ before: [`const {'${n}': u} = r;`] }) },
    { label: 'bare template ${' + n + '}', fixture: tpl('${' + n + '}') },
    { label: 'bare template ${ ' + n + ' }', fixture: tpl('${ ' + n + ' }') },
    {
      label: `positional argument (..., ${n})`,
      fixture: fixture({ warnLine: `console.warn('Request body exceeded 10MB for', ${n});` }),
    },
    { label: `parameter (${n})`, fixture: fixture({ param: n }) },
    { label: 'call inside a template ${' + n + '.slice(0, 80)}', fixture: tpl('${' + n + '.slice(0, 80)}') },
    {
      label: `concatenation '...' + ${n}`,
      fixture: fixture({ warnLine: `console.warn('Request body exceeded 10MB for ' + ${n} + '. Only the first 10MB');` }),
    },
  ]
}

const SHAPE_TITLE = {
  1: 'member access',
  2: 'bracket access',
  3: 'destructure or object key',
  4: 'bare template',
} as const

// --- 1. every NAME in every listed position ----------------------------
//
// One test per case. On the unchanged script the cases for url and originalUrl
// in member, bracket and bare-template positions already pass (week 34 covered
// them).

for (const n of NAMES) {
  formsFor(n).forEach((form, i) => {
    test(`1: ${n}, ${form.label}: patch exits 1 and leaves the file, --check exits 1`, () => {
      assertRejected(`p${i}-${n}.js`, form.fixture)
    })
  })
}

// --- 2. the four shapes of spec §0, as written in its table ------------

const SECTION_0: Array<[label: string, file: string, text: string]> = [
  [
    'const {url: u} = readable, then a template with ${u}',
    'rename-destructure.js',
    [
      'function a(readable) {',
      '  const {url: u} = readable;',
      '  console.warn(`Request body exceeded 10MB for ${u}. Only the first 10MB`);',
      '}',
      '',
    ].join('\n'),
  ],
  [
    "const {url} = readable, then '... for ' + url",
    'destructure-concat.js',
    [
      'function a(readable) {',
      '  const {url} = readable;',
      "  console.warn('Request body exceeded 10MB for ' + url + '. Only the first 10MB');",
      '}',
      '',
    ].join('\n'),
  ],
  [
    'req.nextUrl.pathname into the warning',
    'nexturl-pathname.js',
    [
      'function a(req) {',
      '  console.warn(`Request body exceeded 10MB for ${req.nextUrl.pathname}. Only the first 10MB`);',
      '}',
      '',
    ].join('\n'),
  ],
  [
    'req.headers.host into the warning',
    'headers-host.js',
    [
      'function a(req) {',
      '  console.warn(`Request body exceeded 10MB for ${req.headers.host}. Only the first 10MB`);',
      '}',
      '',
    ].join('\n'),
  ],
]

for (const [label, file, text] of SECTION_0) {
  test(`2: the spec 0 shape "${label}": patch exits 1 and leaves the file, --check exits 1`, () => {
    assertRejected(file, text)
  })
}

// --- 3. the shape on either side of the warning text -------------------

const STATEMENTS: Record<1 | 2 | 3 | 4, (n: string) => string> = {
  1: (n) => `const x = r.${n};`,
  2: (n) => `const x = r['${n}'];`,
  3: (n) => `const { ${n}: u } = r;`,
  4: (n) => 'const x = `${' + n + '}`;',
}

for (const n of ['url', 'nextUrl']) {
  for (const shape of [1, 2, 3, 4] as const) {
    test(`3: ${n}, shape ${shape} (${SHAPE_TITLE[shape]}) before the warning text`, () => {
      assertRejected(`before-s${shape}-${n}.js`, fixture({ before: [STATEMENTS[shape](n)] }))
    })
    test(`3: ${n}, shape ${shape} (${SHAPE_TITLE[shape]}) after the warning text`, () => {
      assertRejected(`after-s${shape}-${n}.js`, fixture({ after: [STATEMENTS[shape](n)] }))
    })
  }
}

// --- 4. the known assignment plus a second url in the window -----------
//
// The patch would rewrite the assignment, but the text it would write still
// carries a url, so the run must fail and write nothing.

const KNOWN_ASSIGNMENT = "urlInfo = readable.url ? ` for ${readable.url}` : ''"
const PATCHED_ASSIGNMENT = "urlInfo = ''"

function withKnownAssignment(before: string[], after: string[]): string {
  return [
    'function a(readable, opts) {',
    ...before.map((s) => '  ' + s),
    '  const ' + KNOWN_ASSIGNMENT + ';',
    '  console.warn(`Request body exceeded 10MB${urlInfo}. Only the first 10MB`);',
    ...after.map((s) => '  ' + s),
    '}',
    '',
  ].join('\n')
}

const ASSIGNMENT_PLUS: Array<[label: string, before: string[], after: string[]]> = [
  ['{url: u} before the assignment', ['const {url: u} = readable;'], []],
  ['{url: u} after the warning', [], ['const {url: u} = readable;']],
  ['{ headers } after the warning', [], ['const { headers } = readable;']],
]

for (const [label, before, after] of ASSIGNMENT_PLUS) {
  test(`4: the known assignment plus ${label}: patch exits 1 and the file on disk is unchanged`, () => {
    withScratch((root) => {
      const dist = distOf(root)
      const text = withKnownAssignment(before, after)
      assert.ok(text.includes(KNOWN_ASSIGNMENT), 'the fixture should hold the known assignment')
      const file = writeFixture(dist, 'server/assignment-plus-destructure.js', text)
      const bytesBefore = readFileSync(file, 'utf8')

      const patch = runScript(root)
      assertReportedFailure(patch)
      assert.ok(patch.out.includes('assignment-plus-destructure.js'), `the failing file should be named: ${patch.out}`)
      assert.ok(readFileSync(file, 'utf8') === bytesBefore, 'the file on disk changed')
    })
  })
}

// --- 5. negative: whole-name matching ----------------------------------

const NOT_FLAGGED: Array<[label: string, before: string[]]> = [
  ['urlInfo', ['const { urlInfo: info } = opts;', 'const a = opts.urlInfo;']],
  ['hrefLang', ['const { hrefLang } = opts;', 'const b = opts.hrefLang;', "const c = opts['hrefLang'];"]],
  ['searchTerm', ['const { searchTerm } = opts;', 'const d = opts.searchTerm;', "const e = opts['searchTerm'];"]],
  ['queryKey', ['const { queryKey, method } = opts;', 'const f = opts.queryKey;', "const g = opts['queryKey'];"]],
  ['headersSent', ['const { headersSent } = opts;', 'const h = opts.headersSent;', "const i = opts['headersSent'];"]],
  ['${urlInfo}', ['const j = `${urlInfo}`;']],
]

function assertPatchedAndChecked(text: string, fileName: string): void {
  withScratch((root) => {
    const dist = distOf(root)
    assert.ok(text.includes(KNOWN_ASSIGNMENT), 'the fixture should hold the known assignment')
    const file = writeFixture(dist, `server/${fileName}`, text)

    const patch = runScript(root)
    assert.equal(patch.status, 0, `patch run should exit 0: ${patch.out}`)
    assert.ok(patch.out.includes(fileName), `the patched file should be named: ${patch.out}`)
    // The assignment is rewritten and nothing else in the file changes.
    assert.ok(
      readFileSync(file, 'utf8') === text.replace(KNOWN_ASSIGNMENT, PATCHED_ASSIGNMENT),
      'the file should be the original with only the assignment emptied',
    )

    const check = runScript(root, ['--check', dist])
    assert.equal(check.status, 0, `--check should exit 0: ${check.out}`)
  })
}

test('5: urlInfo, hrefLang, searchTerm, queryKey, headersSent and ${urlInfo} in one window: patch exits 0, --check exits 0', () => {
  assertPatchedAndChecked(
    withKnownAssignment(NOT_FLAGGED.flatMap(([, before]) => before), []),
    'whole-names-all.js',
  )
})

for (const [label, before] of NOT_FLAGGED) {
  test(`5: ${label} alone beside the known assignment: patch exits 0, --check exits 0`, () => {
    assertPatchedAndChecked(withKnownAssignment(before, []), 'whole-names-one.js')
  })
}

// Spec §5.3: the name is judged whole-word and case sensitive, so URL, Headers
// and Host are not names.
const NOT_FLAGGED_CASE: Array<[label: string, before: string[]]> = [
  ['URL', ["const base = new URL('https://example.invalid/');"]],
  ['Headers', ['const h = new Headers(opts.init);']],
  ['Host', ['const H = opts.Host;']],
]

for (const [label, before] of NOT_FLAGGED_CASE) {
  test(`5: ${label} (case differs from a name) beside the known assignment: patch exits 0, --check exits 0`, () => {
    assertPatchedAndChecked(withKnownAssignment(before, []), 'case-sensitive.js')
  })
}

test('5: URL, Headers and Host in one window: patch exits 0, --check exits 0', () => {
  assertPatchedAndChecked(withKnownAssignment(NOT_FLAGGED_CASE.flatMap(([, before]) => before), []), 'case-sensitive-all.js')
})

// --- 5b. comparisons are flagged now (spec §5.1) -----------------------
//
// Under the first rule `, url === b` was left alone. Under the whole-word rule
// anything that names a request part next to the warning is flagged.

for (const n of ['url', 'nextUrl', 'headers']) {
  const COMPARISONS: Array<[label: string, before: string[]]> = [
    [`, ${n} === b`, [`if (ok, ${n} === b) return;`]],
    [`, ${n} == b`, [`if (ok, ${n} == b) return;`]],
    [`{ ${n} == null }`, [`if (ok) { ${n} == null }`]],
    [`{ ${n} === null }`, [`if (ok) { ${n} === null }`]],
    [`{${n}===b}`, [`if (ok) {${n}===b}`]],
  ]
  for (const [label, before] of COMPARISONS) {
    test(`5b: ${label} in the window: patch exits 1 and leaves the file, --check exits 1`, () => {
      assertRejected('comparison-after-name.js', fixture({ before }))
    })
    test(`5b: ${label} beside the known assignment: patch exits 1 and the file on disk is unchanged`, () => {
      withScratch((root) => {
        const dist = distOf(root)
        const text = withKnownAssignment(before, [])
        const file = writeFixture(dist, 'server/comparison-plus-assignment.js', text)
        const patch = runScript(root)
        assertReportedFailure(patch)
        assert.ok(patch.out.includes('comparison-plus-assignment.js'), `the failing file should be named: ${patch.out}`)
        assert.ok(readFileSync(file, 'utf8') === text, 'the file on disk changed')
      })
    })
  }
}

// --- 7. the review's fixtures: things before the dot or after the name -
//
// `/p`.url, "/p".url, {}.url and ...url passed both modes under the first rule.

const REVIEW_FIXTURES: Array<[label: string, statement: string]> = [
  ['a template literal then .url', 'const x = `/p`.url;'],
  ['a string literal then .url', 'const x = "/p".url;'],
  ['an empty object then .url', 'const x = {}.url;'],
  ['a spread of url', 'const x = [...url];'],
]

REVIEW_FIXTURES.forEach(([label, statement], i) => {
  test(`7: ${label} before the warning is flagged in both modes`, () => {
    assertRejected(`review-${i}.js`, fixture({ before: [statement] }))
  })
  test(`7: ${label} after the warning is flagged in both modes`, () => {
    assertRejected(`review-after-${i}.js`, fixture({ after: [statement] }))
  })
})

test('7: a decoded url inside the template is flagged in both modes', () => {
  assertRejected('decode-uri.js', fixture({ inWarning: '${decodeURI(url)}' }))
})

// --- 8. the window edges (spec §5.1, §5.3) ------------------------------
//
// 400 characters after the end of the warning text and 400 before its start.
// The flagged cases put the name 390 away, the clean cases 420 away, so the
// result does not depend on whether the edge counts the name's first or last
// character. The padding is a line comment of x characters.

const WARNING_LINE_PLAIN = "  console.warn('Request body exceeded 10MB. Only the first 10MB');\n"
const WARNING_LINE_ASSIGNED = '  console.warn(`Request body exceeded 10MB${urlInfo}. Only the first 10MB`);\n'

// The distance, in characters, from the end of the warning text to the first
// character of `name` ('after'), or from the last character of `name` to the
// start of the warning text ('before').
function gapOf(text: string, name: string, side: 'before' | 'after'): number {
  const start = text.indexOf(WARNING_TEXT)
  assert.equal(text.indexOf(WARNING_TEXT, start + 1), -1, 'the fixture should hold the warning text once')
  const marker = `const v = ${name};`
  const at = text.indexOf(marker)
  assert.notEqual(at, -1, 'the fixture should hold the marker statement')
  const nameAt = at + 'const v = '.length
  return side === 'after' ? nameAt - (start + WARNING_TEXT.length) : start - (nameAt + name.length)
}

// The gap is measured in the text that is judged (spec §5.4): with the known
// assignment present, the patch run judges the text after it is rewritten, so
// the fixture is measured on that form and the file written is the unpatched one.
function edgeFixture(side: 'before' | 'after', gap: number, name: string, withAssignment: boolean): string {
  const judged = (t: string): string => (withAssignment ? t.replace(KNOWN_ASSIGNMENT, PATCHED_ASSIGNMENT) : t)
  const assignment = withAssignment ? '  const ' + KNOWN_ASSIGNMENT + ';\n' : ''
  const warnLine = withAssignment ? WARNING_LINE_ASSIGNED : WARNING_LINE_PLAIN
  const build = (pad: number): string => {
    const comment = '  // ' + 'x'.repeat(pad) + '\n'
    const marker = `  const v = ${name};\n`
    const body = side === 'after' ? assignment + warnLine + comment + marker : marker + comment + assignment + warnLine
    return 'function a(readable) {\n' + body + '}\n'
  }
  const measured = gapOf(judged(build(0)), name, side)
  assert.ok(gap >= measured, 'the gap is too small for the fixture')
  const text = build(gap - measured)
  assert.equal(gapOf(judged(text), name, side), gap, 'the fixture should put the name exactly the requested distance away in the judged text')
  return text
}

for (const name of ['url', 'nextUrl', 'host']) {
  for (const side of ['after', 'before'] as const) {
    test(`8: ${name} 390 characters ${side} the warning text is flagged in both modes`, () => {
      assertRejected(`edge-${side}-390-${name}.js`, edgeFixture(side, 390, name, false))
    })
    test(`8: ${name} 390 characters ${side} the warning text, beside the known assignment: patch exits 1 and the file is unchanged`, () => {
      withScratch((root) => {
        const text = edgeFixture(side, 390, name, true)
        const file = writeFixture(distOf(root), 'server/edge-assigned.js', text)
        const patch = runScript(root)
        assertReportedFailure(patch)
        assert.ok(readFileSync(file, 'utf8') === text, 'the file on disk changed')
      })
    })
    test(`8: ${name} 420 characters ${side} the warning text is not flagged: patch exits 0, --check exits 0`, () => {
      assertPatchedAndChecked(edgeFixture(side, 420, name, true), 'edge-420.js')
    })
  }
}

// --- 9. every occurrence of the warning text is judged ------------------

const FILLER_LINES = Array.from({ length: 12 }, () => '// ' + 'x'.repeat(96)).join('\n')
const CLEAN_FN = (fnName: string): string =>
  `function ${fnName}() {\n  console.warn('Request body exceeded 10MB. Only the first 10MB');\n}\n`
const NAMED_FN = (fnName: string): string =>
  'function ' + fnName + '(r) {\n  console.warn(`Request body exceeded 10MB for ${r.host}. Only the first 10MB`);\n}\n'

test('9: two occurrences, the first clean and the second carrying a name: both modes fail', () => {
  assertRejected('two-occurrences-second.js', [CLEAN_FN('first'), FILLER_LINES, NAMED_FN('second')].join('\n'))
})

test('9: two occurrences, the first carrying a name and the second clean: both modes fail', () => {
  assertRejected('two-occurrences-first.js', [NAMED_FN('first'), FILLER_LINES, CLEAN_FN('second')].join('\n'))
})

test('9: two clean occurrences far apart: patch exits 0, --check exits 0', () => {
  withScratch((root) => {
    const dist = distOf(root)
    writeFixture(dist, 'server/two-clean.js', [CLEAN_FN('first'), FILLER_LINES, CLEAN_FN('second')].join('\n'))
    const patch = runScript(root)
    assert.equal(patch.status, 0, `patch run should exit 0: ${patch.out}`)
    const check = runScript(root, ['--check', dist])
    assert.equal(check.status, 0, `--check should exit 0: ${check.out}`)
  })
})

// --- 10. .mjs and .cjs targets ------------------------------------------

for (const ext of ['mjs', 'cjs']) {
  test(`10: a .${ext} target that carries a name is found and fails in both modes`, () => {
    assertRejected(`carries-name.${ext}`, fixture({ inWarning: '${r.host}' }))
  })
  test(`10: a .${ext} target with the known assignment is found, patched, and then passes --check`, () => {
    assertPatchedAndChecked(withKnownAssignment([], []), `known.${ext}`)
  })
  test(`10: a .${ext} target with the known assignment plus a name fails and is left unchanged`, () => {
    withScratch((root) => {
      const text = withKnownAssignment(['const o = { host };'], [])
      const file = writeFixture(distOf(root), `server/known-plus-name.${ext}`, text)
      const patch = runScript(root)
      assertReportedFailure(patch)
      assert.ok(patch.out.includes(`known-plus-name.${ext}`), `the failing file should be named: ${patch.out}`)
      assert.ok(readFileSync(file, 'utf8') === text, 'the file on disk changed')
    })
  })
}


// --- 6. regression: the three real files -------------------------------

test('6: a scratch copy of the three real files patches with exit 0 and --check exits 0', () => {
  withScratch((root) => {
    const dist = distOf(root)
    for (const rel of COPIES) {
      const dest = path.join(dist, rel)
      mkdirSync(path.dirname(dest), { recursive: true })
      writeFileSync(dest, readFileSync(path.join(REAL_DIST, rel)))
    }

    const patch = runScript(root)
    assert.equal(patch.status, 0, `patch run should exit 0: ${patch.out}`)
    assert.match(patch.stdout, /\b3\b/, `expected the count 3: ${patch.stdout}`)

    const check = runScript(root, ['--check', dist])
    assert.equal(check.status, 0, `--check should exit 0: ${check.out}`)
    assert.match(check.stdout, /\b3\b/, `expected the count 3: ${check.stdout}`)
  })
})
