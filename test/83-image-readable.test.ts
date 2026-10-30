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

function firstInteger(text: string): number {
  const m = /\d+/.exec(text)
  assert.ok(m, `no number in: ${JSON.stringify(text)}`)
  return Number(m[0])
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
    assert.equal(stdout.trim().split('\n').length, 1, 'exactly one line on stdout')
    assert.equal(firstInteger(stdout), 8)
    const uid = process.getuid?.()
    if (uid !== undefined) {
      assert.ok(stdout.replace(/\d+/, '').includes(String(uid)), `the uid ${uid} must be named: ${stdout}`)
    }
  })
})

test('§3.1 the count grows by exactly the number of files added', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const app = makeDir(path.join(dir, 'app'))
    put(path.join(app, 'a.txt'), 0o644)
    const before = firstInteger(check([entry, app]).stdout)
    for (let i = 0; i < 5; i++) put(path.join(app, 'more', `f${i}.txt`), 0o644)
    const after = check([entry, app])
    assert.equal(after.status, 0, after.stderr)
    // five files and the new directory holding them
    assert.equal(firstInteger(after.stdout) - before, 6)
  })
})

test('§3.1 files given as arguments are counted with the entrypoint', () => {
  withTempDir((dir) => {
    const entry = makeEntrypoint(dir)
    const f1 = put(path.join(dir, 'one.txt'), 0o644)
    const f2 = put(path.join(dir, 'two.txt'), 0o600)
    const { status, stdout, stderr } = check([entry, f1, f2])
    assert.equal(status, 0, stderr)
    assert.equal(firstInteger(stdout), 3)
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

// §3.10 -- deploy.sh run against a stub docker.

type Call = { argv: string[] }

type DeployRun = {
  status: number | null
  output: string
  calls: Call[]
  runStdin: string | null
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
    if [ "\${STUB_RUN_EXIT:-0}" != "0" ]; then
      echo "stub docker: run failed" >&2
    fi
    exit "\${STUB_RUN_EXIT:-0}"
    ;;
  inspect)
    echo healthy
    exit 0
    ;;
esac
exit 0
`

const VERSION = 'w32test1'

function runDeploy(runExit: number): DeployRun {
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

test('§3.10 deploy.sh with a failing check: build and run are recorded, compose is not, exit is 1', () => {
  const r = runDeploy(1)
  assert.deepEqual(subcommands(r), ['build', 'run'], r.output)
  assert.equal(r.status, 1, r.output)
  assert.match(r.output, /refus/i, 'deploy.sh must say that it refused')
  assert.match(r.output, /not (?:been )?touched|untouched/i, 'deploy.sh must say the running stack was not touched')
})

test('§3.10 deploy.sh with a passing check: build, run, then compose, in that order, exit 0', () => {
  const r = runDeploy(0)
  assert.deepEqual(subcommands(r), ['build', 'run', 'compose'], r.output)
  assert.equal(r.status, 0, r.output)
})

test('§3.10 the check is a docker run with --rm -i --network none --entrypoint node on the image just built', () => {
  const r = runDeploy(0)
  const build = r.calls.find((c) => c.argv[0] === 'build')
  const run = r.calls.find((c) => c.argv[0] === 'run')
  assert.ok(build, r.output)
  assert.ok(run, r.output)
  const tag = `confession-web:${VERSION}`
  assert.equal(build.argv[build.argv.indexOf('-t') + 1], tag, 'the build must tag the image')
  const a = run.argv
  assert.ok(a.includes('--rm'), 'the check container must be removed afterwards')
  assert.ok(a.includes('-i'), 'stdin must be attached for the script')
  const net = a.indexOf('--network')
  assert.notEqual(net, -1, '--network is missing')
  assert.equal(a[net + 1], 'none')
  const ep = a.indexOf('--entrypoint')
  assert.notEqual(ep, -1, '--entrypoint is missing')
  assert.equal(a[ep + 1], 'node')
  const img = a.indexOf(tag)
  assert.notEqual(img, -1, `the run must name the image ${tag}`)
  assert.deepEqual(a.slice(img + 1), ['--input-type=module', '-', ENTRYPOINT_IN_IMAGE, '/app'])
})

test('§3.10 the check container gets no env file, no -e, no --env and no volume', () => {
  const r = runDeploy(0)
  const run = r.calls.find((c) => c.argv[0] === 'run')
  assert.ok(run, r.output)
  for (const arg of run.argv) {
    assert.doesNotMatch(arg, /^--env/, `no environment may reach the check container: ${arg}`)
    assert.doesNotMatch(arg, /^-e/, `no environment may reach the check container: ${arg}`)
    assert.doesNotMatch(arg, /^(?:-v|--volume|--mount)/, `no host path may reach the check container: ${arg}`)
  }
})

test('§1.3 the check script reaches the container on stdin, unchanged', () => {
  const r = runDeploy(0)
  assert.ok(r.runStdin !== null, 'docker run received no stdin')
  assert.equal(r.runStdin, readFileSync(CHECK_SCRIPT, 'utf8'))
})
