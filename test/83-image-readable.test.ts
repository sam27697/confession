import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import { BASH } from './posix-shell.js'

// Written from docs/SPEC-week32-deploy-file-modes.md §1 and §3 only. The
// script, the Dockerfile change and the deploy.sh change are not opened
// before writing this; a missing scripts/check-image-readable.mjs or an
// unchanged Dockerfile or deploy.sh is the correct reason for a failure
// here, not a reason to change the assertion.

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..')
const CHECK_SCRIPT = path.join(REPO_ROOT, 'scripts/check-image-readable.mjs')
const READ_ENV_KEY = path.join(REPO_ROOT, 'scripts/read-env-key.sh')
const DEPLOY_SCRIPT = path.join(REPO_ROOT, 'deploy.sh')
const DOCKERFILE = path.join(REPO_ROOT, 'Dockerfile')

const ENTRYPOINT_IN_IMAGE = '/usr/local/bin/docker-entrypoint.sh'

// Give modes back to everything under p so rm can remove it. A mode-000
// directory cannot be listed by its owner, so chmod comes before readdir.
function restoreModes(p: string): void {
  const st = lstatSync(p)
  if (st.isSymbolicLink()) return
  if (st.isDirectory()) {
    chmodSync(p, 0o700)
    for (const name of readdirSync(p)) restoreModes(path.join(p, name))
  } else {
    chmodSync(p, 0o600)
  }
}

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'confession-w32test-image-readable-'))
  try {
    return fn(dir)
  } finally {
    try {
      restoreModes(dir)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}

// Writes a file and sets its mode explicitly, so the umask of whoever runs
// the suite cannot change what a test means.
function put(file: string, mode: number, body = 'x\n'): string {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, body)
  chmodSync(file, mode)
  return file
}

function makeDir(dir: string, mode = 0o755): string {
  mkdirSync(dir, { recursive: true })
  chmodSync(dir, mode)
  return dir
}

// The script is the only thing under test. If it is missing, node itself
// exits 1 and names a path on stderr, which would satisfy several of the
// assertions below for the wrong reason; so a missing script fails first.
function check(args: string[]): { status: number | null; stdout: string; stderr: string } {
  assert.ok(existsSync(CHECK_SCRIPT), 'scripts/check-image-readable.mjs does not exist')
  // It reads no environment (§1.2): hand it only a PATH.
  const result = spawnSync(process.execPath, [CHECK_SCRIPT, ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '' } as unknown as NodeJS.ProcessEnv,
  })
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

const OK_LINE = /^check-image-readable: OK ([1-9][0-9]*) paths usable by uid ([1-9][0-9]*)$/

// §5.2.3: on success the last line of stdout is exactly the OK line.
function okLine(stdout: string): { count: number; uid: number; line: string } {
  const lines = stdout.split('\n').filter((l) => l.length > 0)
  const line = lines[lines.length - 1] ?? ''
  const m = OK_LINE.exec(line)
  assert.ok(m, `the last line of stdout must be the OK line: ${JSON.stringify(stdout)}`)
  return { count: Number(m[1]), uid: Number(m[2]), line }
}

// An executable entrypoint outside the walked directory, as in the image
// (/usr/local/bin is not under /app).
function makeEntrypoint(dir: string, mode = 0o755): string {
  return put(path.join(dir, 'entrypoint', 'docker-entrypoint.sh'), mode, '#!/bin/sh\nexec "$@"\n')
}

test('§3 the suite runs as a non-root user, where mode 000 is unreadable to the owner', () => {
  assert.notEqual(process.getuid?.(), 0, 'the mode-000 tests below prove nothing as root')
})

// §3.1

test('§3.1 a fully readable tree exits 0 and the count matches the paths given and found', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'a.txt'), 0o644)
    put(path.join(app, 'sub', 'b.txt'), 0o644)
    put(path.join(app, 'sub', 'deeper', 'c.txt'), 0o600)
    makeDir(path.join(app, 'empty'))
    // given: entrypoint + app (2). found under app: sub, deeper, empty and
    // three files (6).
    const { status, stdout, stderr } = check([entry, app])
    assert.equal(status, 0, stderr)
    const ok = okLine(stdout)
    assert.equal(ok.count, 8)
    assert.equal(ok.uid, process.getuid?.())
  })
})

test('§3.1 the count grows by exactly the number of files added', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'a.txt'), 0o644)
    const before = okLine(check([entry, app]).stdout).count
    for (let i = 0; i < 5; i++) put(path.join(app, 'more', `f${i}.txt`), 0o644)
    const after = check([entry, app])
    assert.equal(after.status, 0, after.stderr)
    // five files and the new directory holding them
    assert.equal(okLine(after.stdout).count - before, 6)
  })
})

test('§3.1 files given as arguments are counted with the entrypoint', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const f1 = put(path.join(dir, 'one.txt'), 0o644)
    const f2 = put(path.join(dir, 'two.txt'), 0o600)
    const { status, stdout, stderr } = check([entry, f1, f2])
    assert.equal(status, 0, stderr)
    assert.equal(okLine(stdout).count, 3)
  })
})

// §3.2

test('§3.2 a mode 000 file inside a walked directory exits 1 and is named as not readable', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'fine.txt'), 0o644)
    const locked = put(path.join(app, 'nested', 'locked.txt'), 0o000)
    const { status, stderr } = check([entry, app])
    assert.equal(status, 1)
    const line = stderr.split('\n').find((l) => l.includes(locked))
    assert.ok(line, `stderr must name ${locked}: ${stderr}`)
    assert.match(line, /not readable/i, 'the reason must be on the same line as the path')
    assert.ok(!stderr.includes('fine.txt'), 'a readable file must not be listed as failing')
  })
})

// §3.3

test('§3.3 a mode 000 directory exits 1, is named, and its contents are not listed', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'locked', 'inner-secret.txt'), 0o644)
    put(path.join(app, 'locked', 'deep', 'inner-deep.txt'), 0o644)
    const locked = path.join(app, 'locked')
    chmodSync(locked, 0o000)
    const { status, stderr } = check([entry, app])
    assert.equal(status, 1)
    assert.ok(stderr.includes(locked), `stderr must name ${locked}: ${stderr}`)
    assert.ok(!stderr.includes('inner-secret'), 'the contents of an unreadable directory must not be listed')
    assert.ok(!stderr.includes('inner-deep'), 'the contents of an unreadable directory must not be listed')
  })
})

test('§3.3 a directory that can be read but not entered (mode 600) exits 1 and is named', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'noenter', 'x.txt'), 0o644)
    const noenter = path.join(app, 'noenter')
    chmodSync(noenter, 0o600)
    const { status, stderr } = check([entry, app])
    assert.equal(status, 1)
    assert.ok(stderr.includes(noenter), `stderr must name ${noenter}: ${stderr}`)
  })
})

test('§3.3 a directory that can be entered but not read (mode 300) exits 1 and is named', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'noread', 'x.txt'), 0o644)
    const noread = path.join(app, 'noread')
    chmodSync(noread, 0o300)
    const { status, stderr } = check([entry, app])
    assert.equal(status, 1)
    assert.ok(stderr.includes(noread), `stderr must name ${noread}: ${stderr}`)
  })
})

// §3.4

test('§3.4 an entrypoint with mode 644 (readable, not executable) exits 1 and is named', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir, 0o644)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'a.txt'), 0o644)
    const { status, stderr } = check([entry, app])
    assert.equal(status, 1)
    assert.ok(stderr.includes(entry), `stderr must name ${entry}: ${stderr}`)
  })
})

test('§3.4 an entrypoint that is executable but not readable (mode 311) exits 1 and is named', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir, 0o311)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'a.txt'), 0o644)
    const { status, stderr } = check([entry, app])
    assert.equal(status, 1)
    assert.ok(stderr.includes(entry), `stderr must name ${entry}: ${stderr}`)
  })
})

// §3.5

test('§3.5 an entrypoint that does not exist exits 1 and is named', () => {
  withTempDir((dir) => {
    const entry = path.join(dir, 'entrypoint', 'no-such-entrypoint.sh')
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'a.txt'), 0o644)
    const { status, stderr } = check([entry, app])
    assert.equal(status, 1)
    assert.ok(stderr.includes(entry), `stderr must name ${entry}: ${stderr}`)
  })
})

// §3.6

test('§3.6 a dangling symlink exits 1 and is named', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'a.txt'), 0o644)
    const dangling = path.join(app, 'dangling-link')
    symlinkSync('./does-not-exist', dangling)
    const { status, stderr } = check([entry, app])
    assert.equal(status, 1)
    assert.ok(stderr.includes(dangling), `stderr must name ${dangling}: ${stderr}`)
  })
})

test('§3.6 a symlink to a readable file is fine', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'real.txt'), 0o644)
    symlinkSync('./real.txt', path.join(app, 'good-link'))
    const { status, stderr } = check([entry, app])
    assert.equal(status, 0, stderr)
  })
})

test('§3.6 a symlink is judged by its target: a link to an unreadable file fails and is named', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(dir, 'elsewhere', 'locked.txt'), 0o000)
    const link = path.join(app, 'link-to-locked')
    symlinkSync(path.join(dir, 'elsewhere', 'locked.txt'), link)
    const { status, stderr } = check([entry, app])
    assert.equal(status, 1)
    assert.ok(stderr.includes(link), `stderr must name ${link}: ${stderr}`)
  })
})

test('§1.2 a symlink to a directory is checked but not walked', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'a.txt'), 0o644)
    // the target holds a file that would fail if the link were followed
    put(path.join(dir, 'outside', 'locked.txt'), 0o000)
    symlinkSync(path.join(dir, 'outside'), path.join(app, 'dir-link'))
    const { status, stderr } = check([entry, app])
    assert.equal(status, 0, stderr)
  })
})

// §3.7

function manyFailures(n: number): { status: number | null; stdout: string; stderr: string } {
  return withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'fine.txt'), 0o644)
    for (let i = 0; i < n; i++) put(path.join(app, 'files', `unreadable-${String(i).padStart(2, '0')}.txt`), 0o000)
    return check([entry, app])
  })
}

function listedFailures(stderr: string): number {
  return stderr.split('\n').filter((l) => /unreadable-\d+\.txt/.test(l)).length
}

test('§3.7 27 failures: exactly 20 are listed, then "... and 7 more"', () => {
  const { status, stderr } = manyFailures(27)
  assert.equal(status, 1)
  assert.equal(listedFailures(stderr), 20, stderr)
  const more = /\.\.\. and (\d+) more/.exec(stderr)
  assert.ok(more, `stderr must end the list with "... and N more": ${stderr}`)
  assert.equal(Number(more[1]), 7)
})

test('§3.7 21 failures: 20 are listed, then "... and 1 more"', () => {
  const { status, stderr } = manyFailures(21)
  assert.equal(status, 1)
  assert.equal(listedFailures(stderr), 20, stderr)
  const more = /\.\.\. and (\d+) more/.exec(stderr)
  assert.ok(more, `stderr must end the list with "... and N more": ${stderr}`)
  assert.equal(Number(more[1]), 1)
})

test('§3.7 exactly 20 failures: all 20 are listed and there is no "... and N more" line', () => {
  const { status, stderr } = manyFailures(20)
  assert.equal(status, 1)
  assert.equal(listedFailures(stderr), 20, stderr)
  assert.doesNotMatch(stderr, /\.\.\. and \d+ more/)
})

// §3.8

test('§3.8 no arguments exits 2 with a usage line', () => {
  const { status, stdout, stderr } = check([])
  assert.equal(status, 2)
  assert.match(stdout + stderr, /usage/i)
})

// §5.3.14

test('§5.3.14 a missing path given as an argument exits 1 and is named', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'a.txt'), 0o644)
    const missing = path.join(dir, 'app', 'server.js')
    const { status, stdout, stderr } = check([entry, missing, app])
    assert.equal(status, 1)
    assert.ok(stderr.includes(missing), `stderr must name ${missing}: ${stderr}`)
    assert.doesNotMatch(stdout, /check-image-readable: OK/, 'a failing run must not print the OK line')
  })
})

// §5.3.15

test('§5.3.15 a directory with mode 100 (enterable, not readable) exits 1, is named, and prints no stack trace', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'noread', 'x.txt'), 0o644)
    const noread = path.join(app, 'noread')
    chmodSync(noread, 0o100)
    const { status, stdout, stderr } = check([entry, app])
    assert.equal(status, 1)
    assert.ok(stderr.includes(noread), `stderr must name ${noread}: ${stderr}`)
    assert.doesNotMatch(stderr, /^\s+at\s/m, `stderr must not hold a stack trace: ${stderr}`)
    assert.doesNotMatch(stderr, /node:internal/, `stderr must not hold a stack trace: ${stderr}`)
    assert.doesNotMatch(stdout, /check-image-readable: OK/, 'a failing run must not print the OK line')
  })
})

// §5.3.16

test('§5.3.16 on success the last line of stdout is exactly the OK line with the right count and uid', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'a.txt'), 0o644)
    put(path.join(app, 'sub', 'b.txt'), 0o600)
    // entrypoint, app, a.txt, sub, b.txt
    const { status, stdout, stderr } = check([entry, app])
    assert.equal(status, 0, stderr)
    const uid = process.getuid?.()
    const lines = stdout.split('\n').filter((l) => l.length > 0)
    assert.equal(lines[lines.length - 1], `check-image-readable: OK 5 paths usable by uid ${uid}`)
  })
})

// §3.9 -- the Dockerfile text. The behaviour is proved on the server (§4);
// this guards the text against a revert.

type Instruction = { stage: string; text: string }

function dockerfileInstructions(): Instruction[] {
  const joined = readFileSync(DOCKERFILE, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')
    .replace(/\\\s*\n/g, ' ')
  const out: Instruction[] = []
  let stage = ''
  for (const raw of joined.split('\n')) {
    const text = raw.trim().replace(/\s+/g, ' ')
    if (!text) continue
    const from = /^FROM\s+\S+(?:\s+AS\s+(\S+))?/i.exec(text)
    if (from) stage = (from[1] ?? `stage${out.length}`).toLowerCase()
    out.push({ stage, text })
  }
  return out
}

test('§3.9 the build stage normalises modes to a+rX,go-w right after COPY . ., leaving node_modules alone', () => {
  const all = dockerfileInstructions()
  const build = all.filter((i) => i.stage === 'build')
  const copyAll = build.findIndex((i) => /^COPY\s+(?:--\S+\s+)*\.\s+\.(?:\/)?$/i.test(i.text) && !/--from=/i.test(i.text))
  assert.notEqual(copyAll, -1, 'the build stage must still hold "COPY . ."')
  const firstRun = build.slice(copyAll + 1).find((i) => /^RUN\s/i.test(i.text))
  assert.ok(firstRun, 'a RUN must follow COPY . . in the build stage')
  assert.match(firstRun.text, /chmod/, 'the first RUN after COPY . . must be the mode normalisation')
  assert.match(firstRun.text, /a\+rX,go-w/, 'modes must be set to a+rX,go-w')
  assert.match(firstRun.text, /\/app/, 'the normalisation must cover /app')
  assert.match(firstRun.text, /node_modules/, 'node_modules is written by the deps stage and must be excluded')
})

test('§3.9 the normalisation is in the build stage, before any runtime COPY --from=build', () => {
  const all = dockerfileInstructions()
  const normalise = all.findIndex((i) => i.stage === 'build' && /^RUN\s.*chmod.*a\+rX,go-w/i.test(i.text))
  assert.notEqual(normalise, -1, 'no RUN chmod a+rX,go-w in the build stage')
  const runtimeCopies = all
    .map((i, idx) => ({ i, idx }))
    .filter(({ i }) => i.stage === 'runtime' && /^COPY\s.*--from=build/i.test(i.text))
  assert.ok(runtimeCopies.length > 0, 'the runtime stage must copy from the build stage')
  for (const { i, idx } of runtimeCopies) {
    assert.ok(normalise < idx, `normalisation must come before: ${i.text}`)
  }
})

test('§3.9 the runtime entrypoint is copied from the build stage, not from the context', () => {
  const runtime = dockerfileInstructions().filter((i) => i.stage === 'runtime')
  const copies = runtime.filter((i) => /^COPY\s/i.test(i.text) && i.text.includes(ENTRYPOINT_IN_IMAGE))
  assert.equal(copies.length, 1, `exactly one runtime COPY must place ${ENTRYPOINT_IN_IMAGE}`)
  assert.match(copies[0].text, /--from=build\b/, 'the entrypoint must come from the build stage')
  assert.match(copies[0].text, /\/app\/docker-entrypoint\.sh/, 'the source must be the build stage copy')
})

test('§3.9 the runtime entrypoint mode is set to 755 explicitly, not +x', () => {
  const runtime = dockerfileInstructions().filter((i) => i.stage === 'runtime')
  const runs = runtime.filter((i) => /^RUN\s/i.test(i.text) && i.text.includes(ENTRYPOINT_IN_IMAGE))
  assert.ok(runs.some((i) => /chmod\s+755\s+\/usr\/local\/bin\/docker-entrypoint\.sh/.test(i.text)), 'RUN chmod 755 on the entrypoint is missing')
  assert.ok(!runs.some((i) => /chmod\s+(?:[ugoa]*\+x|\+x)/.test(i.text)), 'chmod +x must not be used on the entrypoint')
})

test('§2 the runtime stage does not hand the app code to node or re-chmod it in a new layer', () => {
  const runtime = dockerfileInstructions().filter((i) => i.stage === 'runtime')
  for (const i of runtime) {
    assert.doesNotMatch(i.text, /--chown/, `COPY --chown makes code writable by node: ${i.text}`)
    assert.doesNotMatch(i.text, /--chmod/, `COPY --chmod is rejected: ${i.text}`)
    assert.doesNotMatch(i.text, /chmod\s+(?:-\S*R|--recursive)/, `chmod -R in the runtime stage duplicates layers: ${i.text}`)
  }
})

// §5.3.17 -- the Dockerfile chmod, run. The RUN find line is taken from the
// Dockerfile at test time and run with sh -c, with /app replaced by a
// temporary directory.

function modeOf(p: string): number {
  return lstatSync(p).mode & 0o7777
}

test('§5.3.17 the Dockerfile RUN find line, run on a 600/700 tree, leaves 644/755 outside node_modules and node_modules alone', () => {
  const build = dockerfileInstructions().filter((i) => i.stage === 'build')
  const line = build.find((i) => /^RUN\s+find\b/i.test(i.text) && /a\+rX,go-w/.test(i.text))
  assert.ok(line, 'the build stage must hold a "RUN find ..." line that sets a+rX,go-w')
  const command = line.text.replace(/^RUN\s+/i, '')
  withTempDir((tmp) => {
    const root = makeDir(path.join(tmp, 'app'), 0o755)
    const files = [
      path.join(root, 'package.json'),
      path.join(root, 'src', 'a.ts'),
      path.join(root, 'src', 'lib', 'b.ts'),
      path.join(root, 'drizzle', 'meta', 'c.sql'),
    ]
    for (const f of files) put(f, 0o600)
    // loose modes are tightened as well: go-w
    const loose = put(path.join(root, 'src', 'loose.ts'), 0o666)
    const script = put(path.join(root, 'docker-entrypoint.sh'), 0o700, '#!/bin/sh\nexec "$@"\n')
    const nmFile = put(path.join(root, 'node_modules', 'pkg', 'index.js'), 0o600)
    const dirs = [
      path.join(root, 'src'),
      path.join(root, 'src', 'lib'),
      path.join(root, 'drizzle'),
      path.join(root, 'drizzle', 'meta'),
    ]
    // deepest first, so a parent at 700 does not hide a child
    for (const d of [...dirs].reverse()) chmodSync(d, 0o700)
    const wide = makeDir(path.join(root, 'public'), 0o777)
    dirs.push(wide)
    chmodSync(path.join(root, 'node_modules', 'pkg'), 0o700)

    const replaced = command.replace(/\/app(?![A-Za-z0-9_])/g, root)
    const result = spawnSync('sh', ['-c', replaced], { cwd: root, encoding: 'utf8' })
    assert.equal(result.status, 0, `${replaced}\n${result.stderr}`)

    for (const f of files) assert.equal(modeOf(f).toString(8), '644', `${f} must be 644`)
    assert.equal(modeOf(loose).toString(8), '644', 'a group- and world-writable file must lose go-w')
    assert.equal(modeOf(script).toString(8), '755', 'the executable script must be 755')
    for (const d of dirs) assert.equal(modeOf(d).toString(8), '755', `${d} must be 755`)
    assert.equal(modeOf(root).toString(8), '755')
    assert.equal(modeOf(nmFile).toString(8), '600', 'node_modules is written by the deps stage and must be left alone')
  })
})

// §3.10 -- deploy.sh run against a stub docker.

type Call = { argv: string[] }

type DeployRun = {
  status: number | null
  output: string
  calls: Call[]
  runStdin: string | null
}

type StubRun = {
  exit?: number
  stdout?: string
  imageRmExit?: number
}

const STUB_DOCKER = `#!/bin/sh
# Records each invocation as one line of tab-separated argv.
{
  for a in "$@"; do printf '%s\\t' "$a"; done
  printf '\\n'
} >> "$STUB_LOG"
case "$1" in
  run)
    cat > "$STUB_RUN_STDIN"
    if [ -n "\${STUB_RUN_STDOUT:-}" ]; then
      printf '%s\\n' "$STUB_RUN_STDOUT"
    fi
    if [ "\${STUB_RUN_EXIT:-0}" != "0" ]; then
      echo "stub docker: run failed" >&2
    fi
    exit "\${STUB_RUN_EXIT:-0}"
    ;;
  image|rmi)
    exit "\${STUB_IMAGE_RM_EXIT:-0}"
    ;;
  inspect)
    echo healthy
    exit 0
    ;;
esac
exit 0
`

const VERSION = 'w32test1'
const TAG = `confession-web:${VERSION}`

// What a real check prints on success (§5.2.3), with a nonzero count and uid.
const GOOD_STDOUT = 'check-image-readable: OK 2609 paths usable by uid 1000'

function runDeploy(stub: StubRun = {}): DeployRun {
  const runExit = stub.exit ?? 0
  const runStdout = stub.stdout ?? GOOD_STDOUT
  return withTempDir((tmp) => {
    assert.ok(existsSync(CHECK_SCRIPT), 'scripts/check-image-readable.mjs does not exist')
    const app = path.join(tmp, 'app')
    const repo = path.join(app, 'repo')
    const scripts = path.join(repo, 'scripts')
    const bin = path.join(tmp, 'bin')
    mkdirSync(scripts, { recursive: true })
    mkdirSync(bin, { recursive: true })

    copyFileSync(DEPLOY_SCRIPT, path.join(repo, 'deploy.sh'))
    copyFileSync(READ_ENV_KEY, path.join(scripts, 'read-env-key.sh'))
    copyFileSync(CHECK_SCRIPT, path.join(scripts, 'check-image-readable.mjs'))
    writeFileSync(path.join(scripts, 'check-deploy-pairing.sh'), '#!/usr/bin/env bash\nexit 0\n')
    writeFileSync(path.join(repo, 'DEPLOY_VERSION'), `${VERSION}\n`)
    writeFileSync(
      path.join(app, '.env'),
      ['STACK_NAME=confession', 'HOST_PORT=8182', 'APP_ORIGIN=https://stg.masaraha.provefair.app', ''].join('\n'),
    )
    chmodSync(path.join(repo, 'deploy.sh'), 0o755)
    chmodSync(path.join(scripts, 'read-env-key.sh'), 0o755)
    chmodSync(path.join(scripts, 'check-deploy-pairing.sh'), 0o755)

    const stubs: Record<string, string> = {
      docker: STUB_DOCKER,
      curl: '#!/bin/sh\nprintf 200\n',
      sleep: '#!/bin/sh\nexit 0\n',
    }
    for (const [name, body] of Object.entries(stubs)) {
      writeFileSync(path.join(bin, name), body)
      chmodSync(path.join(bin, name), 0o755)
    }

    const log = path.join(tmp, 'docker-calls.log')
    const stdinFile = path.join(tmp, 'docker-run.stdin')
    writeFileSync(log, '')
    const result = spawnSync(BASH, [path.join(repo, 'deploy.sh')], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 60_000,
      env: {
        PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
        HOME: tmp,
        STUB_LOG: log,
        STUB_RUN_STDIN: stdinFile,
        STUB_RUN_EXIT: String(runExit),
        STUB_RUN_STDOUT: runStdout,
        STUB_IMAGE_RM_EXIT: String(stub.imageRmExit ?? 0),
      } as unknown as NodeJS.ProcessEnv,
    })
    const calls = readFileSync(log, 'utf8')
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => ({ argv: l.replace(/\t$/, '').split('\t') }))
    return {
      status: result.status,
      output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
      calls,
      runStdin: existsSync(stdinFile) ? readFileSync(stdinFile, 'utf8') : null,
    }
  })
}

function subcommands(r: DeployRun): string[] {
  return r.calls.map((c) => c.argv[0]).filter((s) => ['build', 'run', 'compose'].includes(s))
}

function isImageRemoval(c: Call): boolean {
  return (c.argv[0] === 'rmi' || (c.argv[0] === 'image' && c.argv[1] === 'rm')) && c.argv.includes(TAG)
}

test('§3.10 deploy.sh with a failing check: build and run are recorded, compose is not, exit is 1', () => {
  const r = runDeploy({ exit: 1, stdout: '' })
  assert.deepEqual(subcommands(r), ['build', 'run'], r.output)
  assert.equal(r.status, 1, r.output)
  assert.match(r.output, /refus/i, 'deploy.sh must say that it refused')
  assert.match(r.output, /not (?:been )?touched|untouched/i, 'deploy.sh must say the running stack was not touched')
})

test('§3.10 deploy.sh with a passing check: build, run, then compose, in that order, exit 0', () => {
  const r = runDeploy()
  assert.deepEqual(subcommands(r), ['build', 'run', 'compose'], r.output)
  assert.equal(r.status, 0, r.output)
})

test('§5.3.11 a passing check may print other lines before the OK line', () => {
  const r = runDeploy({ stdout: `some earlier line\n${GOOD_STDOUT}` })
  assert.deepEqual(subcommands(r), ['build', 'run', 'compose'], r.output)
  assert.equal(r.status, 0, r.output)
})

test('§3.10 the check is a docker run with --rm -i --network none --entrypoint node on the image just built', () => {
  const r = runDeploy()
  const build = r.calls.find((c) => c.argv[0] === 'build')
  const run = r.calls.find((c) => c.argv[0] === 'run')
  assert.ok(build, r.output)
  assert.ok(run, r.output)
  assert.equal(build.argv[build.argv.indexOf('-t') + 1], TAG, 'the build must tag the image')
  const a = run.argv
  assert.ok(a.includes('--rm'), 'the check container must be removed afterwards')
  assert.ok(a.includes('-i'), 'stdin must be attached for the script')
  const net = a.indexOf('--network')
  assert.notEqual(net, -1, '--network is missing')
  assert.equal(a[net + 1], 'none')
  const ep = a.indexOf('--entrypoint')
  assert.notEqual(ep, -1, '--entrypoint is missing')
  assert.equal(a[ep + 1], 'node')
  assert.notEqual(a.indexOf(TAG), -1, `the run must name the image ${TAG}`)
})

// §5.3.13 -- the arguments are exactly the entrypoint, the four files it and
// CMD need by name, then /app.
test('§5.3.13 the check arguments are the entrypoint, server.js, check-env.mjs, migrate.mjs, bootstrap-admin.mjs, then /app', () => {
  const r = runDeploy()
  const run = r.calls.find((c) => c.argv[0] === 'run')
  assert.ok(run, r.output)
  const img = run.argv.indexOf(TAG)
  assert.notEqual(img, -1, `the run must name the image ${TAG}`)
  assert.deepEqual(run.argv.slice(img + 1), [
    '--input-type=module',
    '-',
    ENTRYPOINT_IN_IMAGE,
    '/app/server.js',
    '/app/check-env.mjs',
    '/app/migrate.mjs',
    '/app/bootstrap-admin.mjs',
    '/app',
  ])
})

test('§3.10 the check container gets no env file, no -e, no --env and no volume', () => {
  const r = runDeploy()
  const run = r.calls.find((c) => c.argv[0] === 'run')
  assert.ok(run, r.output)
  for (const arg of run.argv) {
    assert.doesNotMatch(arg, /^--env/, `no environment may reach the check container: ${arg}`)
    assert.doesNotMatch(arg, /^-e/, `no environment may reach the check container: ${arg}`)
    assert.doesNotMatch(arg, /^(?:-v|--volume|--mount)/, `no host path may reach the check container: ${arg}`)
  }
})

// §5.3.18 -- nothing that widens the container goes into the check's run.
test('§5.3.18 the check docker run carries no --user/-u, --privileged, --cap-add, -p/--publish or --add-host', () => {
  const r = runDeploy()
  const run = r.calls.find((c) => c.argv[0] === 'run')
  assert.ok(run, r.output)
  for (const arg of run.argv) {
    assert.doesNotMatch(arg, /^(?:-u|--user)/, `the check must run as the image's own user: ${arg}`)
    assert.doesNotMatch(arg, /^--privileged/, `no privileges: ${arg}`)
    assert.doesNotMatch(arg, /^--cap-add/, `no capabilities: ${arg}`)
    assert.doesNotMatch(arg, /^(?:-p|--publish)/, `no published ports: ${arg}`)
    assert.doesNotMatch(arg, /^--add-host/, `no host entries: ${arg}`)
  }
})

test('§1.3 the check script reaches the container on stdin, unchanged', () => {
  const r = runDeploy()
  assert.ok(r.runStdin !== null, 'docker run received no stdin')
  assert.equal(r.runStdin, readFileSync(CHECK_SCRIPT, 'utf8'))
})

// §5.3.11 and §5.3.12 -- deploy.sh trusts the exit code and the OK line
// together. Each case below is a refusal: no compose, the refused image's
// tag removed after the run, exit 1.
const REFUSALS: { name: string; stub: StubRun }[] = [
  { name: 'exit 0 and nothing on stdout', stub: { exit: 0, stdout: '' } },
  { name: 'exit 0 and an OK line with a count of 0', stub: { exit: 0, stdout: 'check-image-readable: OK 0 paths usable by uid 1000' } },
  { name: 'exit 0 and an OK line with uid 0', stub: { exit: 0, stdout: 'check-image-readable: OK 2609 paths usable by uid 0' } },
  { name: 'exit 0 and an OK line with trailing text', stub: { exit: 0, stdout: `${GOOD_STDOUT} and more` } },
  { name: 'exit 0 and an OK line with leading text', stub: { exit: 0, stdout: `x ${GOOD_STDOUT}` } },
  { name: 'exit 0 and some other line', stub: { exit: 0, stdout: 'all good' } },
  { name: 'exit 7 even with a valid OK line', stub: { exit: 7, stdout: GOOD_STDOUT } },
  { name: 'exit 1 and nothing on stdout', stub: { exit: 1, stdout: '' } },
]

for (const { name, stub } of REFUSALS) {
  test(`§5.3.11 deploy.sh refuses on ${name}: no compose, exit 1, the stack is not touched`, () => {
    const r = runDeploy(stub)
    assert.deepEqual(subcommands(r), ['build', 'run'], r.output)
    assert.ok(!r.calls.some((c) => c.argv.includes('compose')), 'no compose of any kind may be recorded')
    assert.equal(r.status, 1, r.output)
    assert.match(r.output, /refus/i, 'deploy.sh must say that it refused')
    assert.match(r.output, /not (?:been )?touched|untouched/i, 'deploy.sh must say the running stack was not touched')
  })

  test(`§5.3.12 deploy.sh refusing on ${name} removes the refused image's tag after the run`, () => {
    const r = runDeploy(stub)
    const runAt = r.calls.findIndex((c) => c.argv[0] === 'run')
    const rmAt = r.calls.findIndex(isImageRemoval)
    assert.notEqual(runAt, -1, r.output)
    assert.notEqual(rmAt, -1, `no "image rm ${TAG}" (or rmi) was recorded: ${r.output}`)
    assert.ok(rmAt > runAt, 'the removal must come after the run')
    assert.ok(!r.calls.some((c) => c.argv.includes('compose')), 'no compose of any kind may be recorded')
  })
}

test('§5.2.5 deploy.sh prints the exit code of a failed check', () => {
  const r = runDeploy({ exit: 7, stdout: '' })
  assert.match(r.output, /\b7\b/, r.output)
})

test('§5.2.5 a failing image removal is ignored: deploy.sh still refuses with exit 1 and no compose', () => {
  const r = runDeploy({ exit: 1, stdout: '', imageRmExit: 1 })
  assert.deepEqual(subcommands(r), ['build', 'run'], r.output)
  assert.equal(r.status, 1, r.output)
  assert.ok(r.calls.some(isImageRemoval), 'the removal must still be attempted')
})

test('§5.3.12 a passing check does not remove the image', () => {
  const r = runDeploy()
  assert.ok(!r.calls.some((c) => c.argv[0] === 'rmi' || (c.argv[0] === 'image' && c.argv[1] === 'rm')), 'the image must be kept')
})
