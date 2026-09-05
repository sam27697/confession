import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import { BASH } from './posix-shell.js'

// Resolved relative to this file so the test works from any cwd, per §2:
// "A standalone script, because it has to be testable off the box."
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/check-deploy-pairing.sh')

function run(args: string[]): { status: number | null; stderr: string } {
  const result = spawnSync(BASH, [SCRIPT, ...args], { encoding: 'utf8' })
  return { status: result.status, stderr: result.stderr ?? '' }
}

const STAGING = {
  stack: 'confession',
  port: '8182',
  origin: 'https://stg.confession.fayad.app',
  dir: '/srv/apps/confession',
}
const PROD = {
  stack: 'confession-prod',
  port: '8082',
  origin: 'https://confession.fayad.app',
  dir: '/srv/apps/confession-prod',
}

// §1 — the two legal rows of the table (now five fields: stack_name,
// host_port, app_origin, allow_dev_login, app_dir)

test('§1 the staging row (confession, 8182, stg origin, ALLOW_DEV_LOGIN=1, staging dir) exits 0', () => {
  const { status } = run([STAGING.stack, STAGING.port, STAGING.origin, '1', STAGING.dir])
  assert.equal(status, 0)
})

test('§1 the staging row (confession, 8182, stg origin, ALLOW_DEV_LOGIN="", staging dir) exits 0', () => {
  const { status } = run([STAGING.stack, STAGING.port, STAGING.origin, '', STAGING.dir])
  assert.equal(status, 0)
})

test('§1 the production row (confession-prod, 8082, production origin, ALLOW_DEV_LOGIN="", production dir) exits 0', () => {
  const { status } = run([PROD.stack, PROD.port, PROD.origin, '', PROD.dir])
  assert.equal(status, 0)
})

// §2 — the named refusals, each isolated to a single mismatched field.
// Every invocation below now carries the app_dir that matches its own
// stack_name, so a failure can only be attributed to the field the test
// name says it is testing.

test('§2 confession-prod on the staging port (8182) is refused, naming the port', () => {
  const { status, stderr } = run([PROD.stack, STAGING.port, PROD.origin, '', PROD.dir])
  assert.notEqual(status, 0)
  assert.match(stderr, /host_port|port/i, 'stderr must name the mismatched field')
})

test('§2 confession on the production port (8082) is refused, naming the port', () => {
  const { status, stderr } = run([STAGING.stack, PROD.port, STAGING.origin, '', STAGING.dir])
  assert.notEqual(status, 0)
  assert.match(stderr, /host_port|port/i, 'stderr must name the mismatched field')
})

test('§2 confession-prod with a stg. origin is refused, naming the origin', () => {
  const { status, stderr } = run([PROD.stack, PROD.port, STAGING.origin, '', PROD.dir])
  assert.notEqual(status, 0)
  assert.match(stderr, /app_origin|origin/i, 'stderr must name the mismatched field')
})

test('§2 confession with the production origin is refused, naming the origin', () => {
  const { status, stderr } = run([STAGING.stack, STAGING.port, PROD.origin, '', STAGING.dir])
  assert.notEqual(status, 0)
  assert.match(stderr, /app_origin|origin/i, 'stderr must name the mismatched field')
})

test('§2 confession-prod with ALLOW_DEV_LOGIN=1 is refused, naming the field — belt and braces alongside src/env.ts', () => {
  const { status, stderr } = run([PROD.stack, PROD.port, PROD.origin, '1', PROD.dir])
  assert.notEqual(status, 0)
  assert.match(stderr, /allow_dev_login|dev_login/i, 'stderr must name the mismatched field')
})

test('§2 an unknown STACK_NAME is refused, naming the stack', () => {
  // No row exists for this stack_name, so there is no "correct" app_dir to
  // pair it with; the staging directory is passed only so this test keeps
  // isolating the stack_name field the way the other four fields already do.
  const { status, stderr } = run(['confession-staging', STAGING.port, STAGING.origin, '', STAGING.dir])
  assert.notEqual(status, 0)
  assert.match(stderr, /stack_name|stack/i, 'stderr must name the mismatched field')
})

// §2 — "an empty or missing argument in any position". STACK_NAME, HOST_PORT,
// APP_ORIGIN and APP_DIR may never be empty in any row of the §1 table, so
// these four positions are unambiguous. ALLOW_DEV_LOGIN is, per spec, "the
// one field allowed to be empty" (its own legal-empty rows are covered
// above), so it is deliberately not included in this group.

test('§2 zero arguments is refused', () => {
  const { status } = run([])
  assert.notEqual(status, 0)
})

test('§2 an empty STACK_NAME (first position) is refused', () => {
  const { status } = run(['', STAGING.port, STAGING.origin, '', STAGING.dir])
  assert.notEqual(status, 0)
})

test('§2 an empty HOST_PORT (second position) is refused', () => {
  const { status } = run([STAGING.stack, '', STAGING.origin, '', STAGING.dir])
  assert.notEqual(status, 0)
})

test('§2 an empty APP_ORIGIN (third position) is refused', () => {
  const { status } = run([STAGING.stack, STAGING.port, '', '', STAGING.dir])
  assert.notEqual(status, 0)
})

test('§2 a partial argument list (missing HOST_PORT, APP_ORIGIN, ALLOW_DEV_LOGIN and APP_DIR) is refused', () => {
  const { status } = run([STAGING.stack])
  assert.notEqual(status, 0)
})

test('§2 a failing case writes a non-empty explanation to stderr', () => {
  const { stderr } = run([PROD.stack, STAGING.port, PROD.origin, '', PROD.dir])
  assert.ok(stderr.trim().length > 0, 'a refusal must explain itself on stderr, not fail silently')
})

// §1.3 / §2 — APP_DIR, the fifth field added by the correction. It must
// equal the directory column of the row matched by stack_name.

test('§1.3 confession-prod deployed from the staging directory (/srv/apps/confession) is refused — this is the exact bug that shipped: production redeployed staging and exited 0', () => {
  const { status, stderr } = run([PROD.stack, PROD.port, PROD.origin, '', STAGING.dir])
  assert.notEqual(status, 0)
  assert.match(stderr, /app_dir|dir/i, 'stderr must name the mismatched field')
})

test('§2 confession deployed from the production directory (/srv/apps/confession-prod) is refused', () => {
  const { status, stderr } = run([STAGING.stack, STAGING.port, STAGING.origin, '', PROD.dir])
  assert.notEqual(status, 0)
  assert.match(stderr, /app_dir|dir/i, 'stderr must name the mismatched field')
})

test('§2 a trailing slash on APP_DIR is accepted for the staging row', () => {
  const { status } = run([STAGING.stack, STAGING.port, STAGING.origin, '', `${STAGING.dir}/`])
  assert.equal(status, 0)
})

test('§2 a trailing slash on APP_DIR is accepted for the production row', () => {
  const { status } = run([PROD.stack, PROD.port, PROD.origin, '', `${PROD.dir}/`])
  assert.equal(status, 0)
})

test('§2 an empty APP_DIR (fifth position) is refused', () => {
  const { status, stderr } = run([PROD.stack, PROD.port, PROD.origin, '', ''])
  assert.notEqual(status, 0)
  assert.match(stderr, /app_dir|dir/i, 'stderr must name the mismatched field')
})

test('§2 an unrelated APP_DIR (/tmp) is refused', () => {
  const { status } = run([PROD.stack, PROD.port, PROD.origin, '', '/tmp'])
  assert.notEqual(status, 0)
})

test('§2 an unrelated APP_DIR (/srv/apps) is refused', () => {
  const { status } = run([PROD.stack, PROD.port, PROD.origin, '', '/srv/apps'])
  assert.notEqual(status, 0)
})

test('§2 a sibling directory that merely starts with the legal name (/srv/apps/confession-prod-old) is refused — a prefix match must not pass', () => {
  const { status } = run([PROD.stack, PROD.port, PROD.origin, '', '/srv/apps/confession-prod-old'])
  assert.notEqual(status, 0)
})

test('§2 a subdirectory of the legal name (/srv/apps/confession-prod/repo) is refused — a substring match must not pass', () => {
  const { status } = run([PROD.stack, PROD.port, PROD.origin, '', '/srv/apps/confession-prod/repo'])
  assert.notEqual(status, 0)
})

test('§2 the old four-argument call, legal under the pre-correction signature, now exits non-zero', () => {
  const { status } = run([STAGING.stack, STAGING.port, STAGING.origin, ''])
  assert.notEqual(status, 0)
})

// ---------------------------------------------------------------------------
// §9.3 items 1-6 — scripts/read-env-key.sh and deploy.sh no longer sourcing
// .env. Written from docs/SPEC-week7-admin.md §9.0, §9.1 and §9.3 only. The
// script is not opened before writing these; a missing scripts/read-env-key.sh
// or an unrepaired deploy.sh is the correct reason for a failure here, not a
// reason to change the assertion.
// ---------------------------------------------------------------------------

const READ_ENV_KEY_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/read-env-key.sh')
const DEPLOY_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../deploy.sh')

function runReadEnvKey(file: string, key: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(BASH, [READ_ENV_KEY_SCRIPT, file, key], { encoding: 'utf8' })
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

// Every test below gets its own directory under /tmp, made with mkdtemp so
// the name cannot collide with anything already there, and removes only
// that directory afterwards -- nothing else under /tmp and nothing in the
// repo.
function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'confession-w9test-read-env-key-'))
  try {
    return fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('§9.3.1 read-env-key.sh prints the value with no expansion of any kind', () => {
  withTempDir((dir) => {
    const file = path.join(dir, '.env')
    writeFileSync(file, 'K=scrypt$16384$8$1$abc$def\n')
    const { status, stdout } = runReadEnvKey(file, 'K')
    assert.equal(status, 0)
    assert.equal(stdout.replace(/\n$/, ''), 'scrypt$16384$8$1$abc$def', 'the $-separated scrypt format must come out byte for byte, not expanded as positional parameters')
  })
})

test('§9.3.2a read-env-key.sh does not execute a $(...) command substitution', () => {
  withTempDir((dir) => {
    const marker = path.join(dir, 'pwned-dollar-paren')
    const file = path.join(dir, '.env')
    writeFileSync(file, `K=$(touch ${marker})\n`)
    const { status, stdout } = runReadEnvKey(file, 'K')
    assert.equal(status, 0)
    assert.equal(stdout.replace(/\n$/, ''), `$(touch ${marker})`, 'the $(...) form must come out as literal text')
    assert.ok(!existsSync(marker), 'the file a $(...) substitution would have created must not exist')
  })
})

test('§9.3.2b read-env-key.sh does not execute a backtick command substitution', () => {
  withTempDir((dir) => {
    const marker = path.join(dir, 'pwned-backtick')
    const file = path.join(dir, '.env')
    const line = 'K=`touch ' + marker + '`'
    writeFileSync(file, line + '\n')
    const { status, stdout } = runReadEnvKey(file, 'K')
    assert.equal(status, 0)
    assert.equal(stdout.replace(/\n$/, ''), line.slice(2), 'the backtick form must come out as literal text')
    assert.ok(!existsSync(marker), 'the file a backtick substitution would have created must not exist')
  })
})

test('§9.3.3 read-env-key.sh strips exactly one layer of matching quotes', () => {
  withTempDir((dir) => {
    const file = path.join(dir, '.env')
    writeFileSync(
      file,
      ["SINGLE='v'", 'DOUBLE="v"', "DOUBLED=''v''", "MISMATCHED='v"].join('\n') + '\n',
    )
    assert.equal(runReadEnvKey(file, 'SINGLE').stdout.replace(/\n$/, ''), 'v', "K='v' must yield v")
    assert.equal(runReadEnvKey(file, 'DOUBLE').stdout.replace(/\n$/, ''), 'v', 'K="v" must yield v')
    assert.equal(runReadEnvKey(file, 'DOUBLED').stdout.replace(/\n$/, ''), "'v'", "K=''v'' must yield 'v', one layer stripped")
    assert.equal(runReadEnvKey(file, 'MISMATCHED').stdout.replace(/\n$/, ''), "'v", "K='v (unmatched quotes) must come out unchanged")
  })
})

test('§9.3.4 read-env-key.sh is exact about keys', () => {
  withTempDir((dir) => {
    const file = path.join(dir, '.env')
    writeFileSync(
      file,
      ['KEY=a', 'OTHER_KEY=b', '# a comment that mentions KEY=c must not match'].join('\n') + '\n',
    )
    assert.equal(runReadEnvKey(file, 'KEY').stdout.replace(/\n$/, ''), 'a', 'KEY must yield its own value, never OTHER_KEY\'s')
    assert.equal(runReadEnvKey(file, 'OTHER_KEY').stdout.replace(/\n$/, ''), 'b')
    const missing = runReadEnvKey(file, 'MISSING_KEY')
    assert.equal(missing.status, 0, 'a missing key is not an error')
    assert.equal(missing.stdout.replace(/\n$/, ''), '', 'a missing key yields empty output, same as an empty value to the :? checks in deploy.sh')
  })
})

test('§9.3.5 read-env-key.sh: the last assignment of a duplicated key wins', () => {
  withTempDir((dir) => {
    const file = path.join(dir, '.env')
    writeFileSync(file, 'DUP=first\nDUP=second\n')
    assert.equal(runReadEnvKey(file, 'DUP').stdout.replace(/\n$/, ''), 'second', 'the last assignment must win, matching what sourcing the file did')
  })
})

test('§9.3.6 deploy.sh no longer sources .env, and calls the read-env-key.sh helper instead', () => {
  const src = readFileSync(DEPLOY_SCRIPT, 'utf8')
  assert.ok(
    !src.includes('. ./.env'),
    'deploy.sh must not contain ". ./.env" -- this is the exact line that expanded $16384/$8/$1 as positional parameters and killed the deploy under set -u (§9.0)',
  )
  assert.ok(
    !/\bsource\s+\.?\/?\.env\b/.test(src),
    'deploy.sh must not source .env via the "source" builtin either',
  )
  assert.ok(
    src.includes('read-env-key.sh'),
    'deploy.sh must read its five needed keys through scripts/read-env-key.sh rather than sourcing the file (§9.1)',
  )
})
