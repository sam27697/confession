// test/85-body-warning.test.ts
//
// docs/SPEC-week34-body-warning.md §5: acceptance for the build step that
// takes the request URL out of Next's "Request body exceeded" warning
// (scripts/patch-next-body-warning.mjs, and the prebuild/postbuild entries in
// package.json). Written from the spec only (§5's own rule): neither the
// script nor the package.json change was opened while writing this file.
//
// The script is always run as a subprocess (process.execPath), with its cwd
// set to a scratch directory that holds a scratch node_modules/next/dist, since
// the script patches node_modules/next/dist relative to its cwd. The scratch
// copies are made from the REAL installed Next files, read only; nothing is
// ever written into the real node_modules. Every subprocess gets an explicit
// env object (PATH and a scratch HOME) and never process.env, so no CTL_*
// variable of the session can reach a child.
//
// Every scratch tree is built inside its own test body, so before the script
// exists each test fails on its own with its own message (the subprocess exits
// non-zero because the script file is missing) instead of one error taking the
// whole file down. The scratch directories are removed in a finally.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'patch-next-body-warning.mjs')
const REAL_DIST = path.join(REPO_ROOT, 'node_modules', 'next', 'dist')

// The three real copies of the warning (spec §0), relative to next/dist.
const COPIES = [
  'server/body-streams.js',
  'esm/server/body-streams.js',
  'compiled/next-server/server.runtime.prod.js',
]

const WARNING_TEXT = 'Request body exceeded'
const CANARY = 'W34CANARYq7x'

// The assignment form of spec §1.1 item 2, as a reader of the real files sees
// it: <name> = <obj>.url ? ` for ${<obj>.url}` : '' with either quote style
// and any spacing (the minified copy has none).
const URL_ASSIGNMENT =
  /(?<![\w$])([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\.url\s*\?\s*`[^`]*\$\{\s*\2\.url\s*\}[^`]*`\s*:\s*(?:''|"")/g

// --- scratch helpers ---------------------------------------------------

function childEnv(home: string): NodeJS.ProcessEnv {
  return { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: home } as unknown as NodeJS.ProcessEnv
}

type Run = { status: number | null; stdout: string; stderr: string; out: string }

// A missing script also exits 1 (node cannot find the file), which would make
// every "exits 1" test below pass for the wrong reason. So the file's presence
// is asserted first, and a failing run must be a reported failure, not a crash.
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
  const root = mkdtempSync(path.join(os.tmpdir(), 'w34-body-warning-'))
  try {
    fn(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// A scratch node_modules/next/dist under `root`, made from the real files, plus
// the bytes package that the CJS copy requires.
function buildScratchDist(root: string): string {
  const dist = path.join(root, 'node_modules', 'next', 'dist')
  for (const rel of COPIES) {
    const dest = path.join(dist, rel)
    mkdirSync(path.dirname(dest), { recursive: true })
    writeFileSync(dest, readFileSync(path.join(REAL_DIST, rel)))
  }
  cpSync(path.join(REAL_DIST, 'compiled', 'bytes'), path.join(dist, 'compiled', 'bytes'), { recursive: true })
  return dist
}

function writeFixture(dist: string, rel: string, text: string): string {
  const dest = path.join(dist, rel)
  mkdirSync(path.dirname(dest), { recursive: true })
  writeFileSync(dest, text)
  return dest
}

function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = path.join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else out.set(path.relative(dir, p), readFileSync(p).toString('latin1'))
    }
  }
  walk(dir)
  return out
}

function assertSameSnapshot(a: Map<string, string>, b: Map<string, string>, what: string): void {
  assert.deepEqual([...b.keys()], [...a.keys()], `${what}: file set changed`)
  for (const [k, v] of a) assert.ok(b.get(k) === v, `${what}: ${k} changed`)
}

function assertReportedFailure(r: Run): void {
  assert.equal(r.status, 1, `expected exit 1: ${r.out}`)
  assert.ok(r.out.trim().length > 0, 'a failing run should say why')
  assert.ok(!/^\s+at .*:\d+:\d+\)?$/m.test(r.out), `a failing run should report, not crash with a stack: ${r.out}`)
}

function count(text: string, needle: string): number {
  return text.split(needle).length - 1
}

function assignmentsIn(text: string): RegExpMatchArray[] {
  return [...text.matchAll(URL_ASSIGNMENT)]
}

// Shows `patched` is `original` with exactly its one url assignment replaced by
// `<name> = ''` (any spacing, any empty-string quote), without trusting the
// script: split the original on the matched assignment and compare the two
// halves byte for byte.
function assertOnlyAssignmentReplaced(original: string, patched: string, label: string): void {
  const found = assignmentsIn(original)
  assert.equal(found.length, 1, `${label}: the real file should hold exactly one url assignment`)
  const m = found[0]
  const start = m.index as number
  const before = original.slice(0, start)
  const after = original.slice(start + m[0].length)
  assert.ok(patched.length >= before.length + after.length, `${label}: patched file is shorter than the untouched parts`)
  assert.ok(patched.startsWith(before), `${label}: text before the assignment changed`)
  assert.ok(patched.endsWith(after), `${label}: text after the assignment changed`)
  const middle = patched.slice(before.length, patched.length - after.length)
  const emptied = new RegExp(`^${m[1].replace(/\$/g, '\\$')}\\s*=\\s*(?:''|""|\`\`)$`)
  assert.match(middle, emptied, `${label}: the assignment should now read <name> = ''`)
  assert.equal(assignmentsIn(patched).length, 0, `${label}: a url assignment is still present`)
  assert.equal(count(patched, WARNING_TEXT), count(original, WARNING_TEXT), `${label}: warning text count changed`)
  assert.ok(patched.includes(WARNING_TEXT), `${label}: warning text is gone`)
}

// --- 1. patch a scratch copy of the three real files -------------------

test('1: the script patches each of the three real copies once and touches nothing else in them', () => {
  withScratch((root) => {
    const dist = buildScratchDist(root)
    const originals = COPIES.map((rel) => readFileSync(path.join(dist, rel), 'utf8'))
    for (const o of originals) assert.ok(o.includes(WARNING_TEXT), 'the real copy should carry the warning')

    // A .map file next to a target must be left alone (§1.1 item 1: .js only).
    const mapFile = writeFixture(dist, 'server/body-streams.js.map', originals[0])

    const r = runScript(root)
    assert.equal(r.status, 0, `script should exit 0: ${r.out}`)

    COPIES.forEach((rel, i) => {
      const patched = readFileSync(path.join(dist, rel), 'utf8')
      assertOnlyAssignmentReplaced(originals[i], patched, rel)
    })

    assert.equal(readFileSync(mapFile, 'utf8'), originals[0], 'a .map file must not be patched')

    // §1.1 item 5: one line per target saying patched, and a count.
    assert.equal(count(r.stdout, 'already patched'), 0, 'first run should not say already patched')
    assert.ok(count(r.stdout, 'patched') >= 3, `expected a patched line per target: ${r.stdout}`)
    assert.match(r.stdout, /\b3\b/, 'expected the count 3 in the output')
  })
})

test('1b: the minified form patches too, and the other statements around it survive', () => {
  withScratch((root) => {
    const dist = buildScratchDist(root)
    const file = writeFixture(
      dist,
      'compiled/min/min-form.js',
      'var a=1;function f(e){let t=e.url?` for ${e.url}`:"";console.warn(`Request body exceeded 10MB${t}. rest`)}var b=2;\n',
    )
    // The three real copies are present too; only the synthetic one is read back.
    const r = runScript(root)
    assert.equal(r.status, 0, `script should exit 0: ${r.out}`)
    const patched = readFileSync(file, 'utf8')
    assert.ok(patched.startsWith('var a=1;function f(e){let '), 'text before the assignment changed')
    assert.ok(patched.endsWith(';console.warn(`Request body exceeded 10MB${t}. rest`)}var b=2;\n'), 'text after the assignment changed')
    assert.match(patched, /let t\s*=\s*(?:''|"")/)
    assert.ok(!patched.includes('e.url'), 'the url must be gone from the minified copy')
  })
})

// --- 2. second run -----------------------------------------------------

test('2: a second run exits 0 and changes nothing', () => {
  withScratch((root) => {
    const dist = buildScratchDist(root)
    const first = runScript(root)
    assert.equal(first.status, 0, `first run should exit 0: ${first.out}`)
    const afterFirst = snapshot(dist)

    const second = runScript(root)
    assert.equal(second.status, 0, `second run should exit 0: ${second.out}`)
    assertSameSnapshot(afterFirst, snapshot(dist), 'second run')
    assert.ok(count(second.stdout, 'already patched') >= 3, `expected an already patched line per target: ${second.stdout}`)
    for (const rel of COPIES) {
      assert.ok(readFileSync(path.join(dist, rel), 'utf8').includes(WARNING_TEXT), `${rel}: warning text lost`)
    }
  })
})

// --- 3. failures -------------------------------------------------------

test('3a: no target at all fails the run with exit 1', () => {
  withScratch((root) => {
    const dist = path.join(root, 'node_modules', 'next', 'dist')
    writeFixture(dist, 'server/other.js', 'module.exports = function other() { return 1 }\n')
    writeFixture(dist, 'server/another.js', 'exports.x = 2\n')
    const r = runScript(root)
    assertReportedFailure(r)
  })
})

test('3b: a target with two url assignments fails with exit 1 and names the file', () => {
  withScratch((root) => {
    const dist = buildScratchDist(root)
    writeFixture(
      dist,
      'server/two-assignments.js',
      [
        'function a(r) {',
        "  const urlInfo = r.url ? ` for ${r.url}` : '';",
        '  console.warn(`Request body exceeded 10MB${urlInfo}. first`);',
        '}',
        'function b(q) {',
        '  const other = q.url ? ` for ${q.url}` : "";',
        '  console.warn(`Request body exceeded 10MB${other}. second`);',
        '}',
        '',
      ].join('\n'),
    )
    const r = runScript(root)
    assertReportedFailure(r)
    assert.ok(r.out.includes('two-assignments.js'), `the failing file should be named: ${r.out}`)
  })
})

test('3c: a target whose warning carries the url another way fails with exit 1 and names the file', () => {
  withScratch((root) => {
    const dist = buildScratchDist(root)
    writeFixture(
      dist,
      'server/direct-url-warning.js',
      'function a(r) {\n  console.warn(`Request body exceeded 10MB for ${r.url}. Only the first 10MB`);\n}\n',
    )
    const r = runScript(root)
    assertReportedFailure(r)
    assert.ok(r.out.includes('direct-url-warning.js'), `the failing file should be named: ${r.out}`)
  })
})

test('3d: a warning with the url ternary written inline fails with exit 1 and names the file', () => {
  withScratch((root) => {
    const dist = buildScratchDist(root)
    writeFixture(
      dist,
      'server/inline-ternary-warning.js',
      'function a(r) {\n  console.warn(`Request body exceeded 10MB${r.url ? ` for ${r.url}` : ""}. Only the first 10MB`);\n}\n',
    )
    const r = runScript(root)
    assertReportedFailure(r)
    assert.ok(r.out.includes('inline-ternary-warning.js'), `the failing file should be named: ${r.out}`)
  })
})

// --- 4. --check --------------------------------------------------------

test('4a: --check exits 1 on an unpatched copy, names a file, and changes nothing', () => {
  withScratch((root) => {
    const dist = buildScratchDist(root)
    const before = snapshot(dist)
    const r = runScript(root, ['--check', dist])
    assertReportedFailure(r)
    assert.match(r.out, /body-streams\.js|server\.runtime\.prod\.js/, `a file should be named: ${r.out}`)
    assertSameSnapshot(before, snapshot(dist), '--check')
  })
})

test('4b: --check exits 1 on a directory with no target', () => {
  withScratch((root) => {
    const empty = path.join(root, 'empty')
    writeFixture(empty, 'a.js', 'module.exports = 1\n')
    writeFixture(empty, 'sub/b.js', 'exports.b = 2\n')
    const r = runScript(root, ['--check', empty])
    assertReportedFailure(r)
  })
})

test('4c: --check exits 0 on a patched copy and prints the count it inspected', () => {
  withScratch((root) => {
    const dist = buildScratchDist(root)
    const patch = runScript(root)
    assert.equal(patch.status, 0, `patch run should exit 0: ${patch.out}`)
    const before = snapshot(dist)
    const r = runScript(root, ['--check', dist])
    assert.equal(r.status, 0, `expected exit 0: ${r.out}`)
    assert.match(r.stdout, /\b3\b/, `expected the count 3: ${r.stdout}`)
    assertSameSnapshot(before, snapshot(dist), '--check')
  })
})

test('4d: --check finds one leaking copy among patched ones and names it', () => {
  withScratch((root) => {
    const dist = buildScratchDist(root)
    const esmRel = 'esm/server/body-streams.js'
    const esmOriginal = readFileSync(path.join(dist, esmRel))
    const patch = runScript(root)
    assert.equal(patch.status, 0, `patch run should exit 0: ${patch.out}`)
    writeFileSync(path.join(dist, esmRel), esmOriginal)
    const r = runScript(root, ['--check', dist])
    assertReportedFailure(r)
    assert.ok(r.out.includes('esm/server/body-streams.js'), `the leaking copy should be named: ${r.out}`)
  })
})

test('4e: --check takes a relative directory and works from the standalone layout', () => {
  withScratch((root) => {
    const standalone = path.join(root, '.next', 'standalone')
    const dist = buildScratchDist(standalone)
    // The standalone output traces only the CJS server copy (spec §0).
    for (const rel of COPIES.slice(1)) rmSync(path.join(dist, rel))
    assert.ok(existsSync(path.join(dist, COPIES[0])))

    const leaking = runScript(root, ['--check', '.next/standalone'])
    assertReportedFailure(leaking)

    const patch = runScript(standalone)
    assert.equal(patch.status, 0, `patch run should exit 0: ${patch.out}`)
    const clean = runScript(root, ['--check', '.next/standalone'])
    assert.equal(clean.status, 0, `expected exit 0 on the patched standalone: ${clean.out}`)
  })
})

test('4f: --check follows nothing outside the directory it was given', () => {
  withScratch((root) => {
    const dist = buildScratchDist(root)
    const patch = runScript(root)
    assert.equal(patch.status, 0, `patch run should exit 0: ${patch.out}`)

    // An unpatched copy outside the checked directory, reachable only through
    // a symlink to its directory and a symlink to its file.
    const outside = path.join(root, 'outside')
    mkdirSync(outside, { recursive: true })
    writeFileSync(path.join(outside, 'leaky.js'), readFileSync(path.join(REAL_DIST, COPIES[0])))
    symlinkSync(outside, path.join(dist, 'link-to-outside'))
    symlinkSync(path.join(outside, 'leaky.js'), path.join(dist, 'server', 'link-to-leaky.js'))

    const r = runScript(root, ['--check', dist])
    assert.equal(r.status, 0, `a leak outside the directory must not fail the check: ${r.out}`)
  })
})

// --- 5. package.json ---------------------------------------------------

test('5: prebuild and postbuild in package.json are exactly spec 1.2', () => {
  const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>
  }
  assert.equal(pkg.scripts?.prebuild, 'node scripts/patch-next-body-warning.mjs')
  assert.equal(pkg.scripts?.postbuild, 'node scripts/patch-next-body-warning.mjs --check .next/standalone')
  assert.equal(pkg.scripts?.build, 'next build', 'build itself stays as it was')
})

// --- 6. the patched module, loaded and run -----------------------------

// Loads <bodyStreams> (CJS), feeds getCloneableBody a Readable whose url
// carries the canary and `mb` MiB of data, consumes cloneBodyStream(), and
// prints every console.warn line as a JSON array on stdout.
const DRIVER = `
const { Readable } = require('node:stream')
const [modulePath, mbArg, canary] = process.argv.slice(2)
const { getCloneableBody } = require(modulePath)
const warns = []
console.warn = (...args) => { warns.push(args.map(String).join(' ')) }
;(async () => {
  const readable = new Readable({ read() {} })
  readable.url = '/c/' + canary + '?q=' + canary
  const body = getCloneableBody(readable)
  const clone = body.cloneBodyStream()
  let seen = 0
  const ended = new Promise((resolve) => { clone.on('end', resolve) })
  clone.on('data', (chunk) => { seen += chunk.length })
  const mb = Number(mbArg)
  for (let i = 0; i < mb; i++) readable.push(Buffer.alloc(1024 * 1024, 97))
  readable.push(null)
  await Promise.race([ended, new Promise((resolve) => setTimeout(resolve, 20000))])
  process.stdout.write(JSON.stringify({ warns, seen }))
})()
`

function driveBodyStreams(root: string, modulePath: string, mb: number): { warns: string[]; seen: number } {
  const driverPath = path.join(root, 'driver.cjs')
  writeFileSync(driverPath, DRIVER)
  const r = spawnSync(process.execPath, [driverPath, modulePath, String(mb), CANARY], {
    cwd: root,
    env: childEnv(root),
    encoding: 'utf8',
    timeout: 60_000,
  })
  assert.equal(r.status, 0, `driver should exit 0: ${r.stderr}`)
  return JSON.parse(r.stdout) as { warns: string[]; seen: number }
}

test('6: the patched body-streams.js warns once about the limit and the line carries no url', () => {
  withScratch((root) => {
    const dist = buildScratchDist(root)
    const target = path.join(dist, COPIES[0])

    // Control on the untouched copy: the driver does reach the warning and the
    // canary does appear in it, so a clean result below means something.
    const control = driveBodyStreams(root, target, 12)
    assert.equal(control.warns.length, 1, 'control: the unpatched copy should warn once')
    assert.ok(control.warns[0].includes(CANARY), 'control: the unpatched copy should carry the canary')

    const patch = runScript(root)
    assert.equal(patch.status, 0, `patch run should exit 0: ${patch.out}`)

    const over = driveBodyStreams(root, target, 12)
    assert.equal(over.warns.length, 1, `expected exactly one warn line, got ${JSON.stringify(over.warns)}`)
    assert.ok(over.warns[0].includes(WARNING_TEXT), `the line should keep the warning text: ${over.warns[0]}`)
    assert.ok(over.warns[0].includes('10MB'), `the line should still name the limit: ${over.warns[0]}`)
    assert.ok(!over.warns[0].includes(CANARY), `the canary leaked into the line: ${over.warns[0]}`)
    assert.ok(!over.warns[0].includes('/c/'), `the path leaked into the line: ${over.warns[0]}`)

    // Below the limit: no line at all, and the body still flows (spec §1.3).
    const under = driveBodyStreams(root, target, 2)
    assert.equal(under.warns.length, 0, `a 2 MiB body should leave no line: ${JSON.stringify(under.warns)}`)
    assert.equal(under.seen, 2 * 1024 * 1024, 'a 2 MiB body should come through whole')
  })
})
