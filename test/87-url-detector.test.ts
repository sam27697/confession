// test/87-url-detector.test.ts
//
// docs/SPEC-week35-url-detector.md §3: acceptance for the wider url detector in
// scripts/patch-next-body-warning.mjs (the destructure and object-key shape, the
// bracket and member shapes, the bare template, and the longer list of names).
// Written from the spec only: the change to the script was not opened while
// writing this file.
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

// Spec §1: the names the detector knows.
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
]

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
// whole statements; `inWarning` is text spliced into the warning after " for ".
// None of it holds the known assignment.
function fixture(opts: { before?: string[]; inWarning?: string; after?: string[] }): string {
  const tail = opts.inWarning === undefined ? '' : ' for ' + opts.inWarning
  const warn = 'console.warn(`Request body exceeded 10MB' + tail + '. Only the first 10MB`);'
  return ['function a(r) {', ...(opts.before ?? []).map((s) => '  ' + s), '  ' + warn, ...(opts.after ?? []).map((s) => '  ' + s), '}', ''].join('\n')
}

type Form = { label: string; before?: string[]; inWarning?: string }

// Spec §1, shapes 1 to 4, for one NAME. The first form of each shape is the one
// the spec table names; the others are the spellings the rule lists for it.
function formsFor(shape: 1 | 2 | 3 | 4, n: string): Form[] {
  switch (shape) {
    case 1:
      return [
        { label: `r.${n}`, inWarning: '${r.' + n + '}' },
        { label: `r?.${n}`, inWarning: '${r?.' + n + '}' },
      ]
    case 2:
      return [
        { label: `r['${n}']`, inWarning: "${r['" + n + "']}" },
        { label: `r["${n}"]`, inWarning: '${r["' + n + '"]}' },
        { label: 'r[`' + n + '`]', inWarning: '${r[`' + n + '`]}' },
      ]
    case 3:
      return [
        { label: `{ ${n}: u }`, before: [`const { ${n}: u } = r;`], inWarning: '${u}' },
        { label: `{ ${n} }`, before: [`const { ${n} } = r;`] },
        { label: `{${n}, method}`, before: [`const {${n}, method} = r;`] },
        { label: `{${n} = ''}`, before: [`const {${n} = ''} = r;`] },
        { label: `{'${n}': u}`, before: [`const {'${n}': u} = r;`] },
        { label: `, ${n} }`, before: [`const { method, ${n} } = r;`] },
      ]
    case 4:
      return [
        { label: '${' + n + '}', inWarning: '${' + n + '}' },
        { label: '${ ' + n + ' }', inWarning: '${ ' + n + ' }' },
      ]
  }
}

const SHAPE_TITLE = {
  1: 'member access',
  2: 'bracket access',
  3: 'destructure or object key',
  4: 'bare template',
} as const

// --- 1. every NAME times shapes 1 to 4 ---------------------------------
//
// One test per case. On a tree without the change, the cases for url and
// originalUrl in shapes 1, 2 and 4 already pass (week 34 covered them).

for (const n of NAMES) {
  for (const shape of [1, 2, 3, 4] as const) {
    formsFor(shape, n).forEach((form, i) => {
      test(`1: ${n}, shape ${shape} (${SHAPE_TITLE[shape]}), ${form.label}: patch exits 1 and leaves the file, --check exits 1`, () => {
        assertRejected(`s${shape}-${n}-${i}.js`, fixture({ before: form.before, inWarning: form.inWarning }))
      })
    })
  }
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
