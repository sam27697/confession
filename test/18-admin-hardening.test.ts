// test/18-admin-hardening.test.ts
//
// Written from docs/SPEC-week9-admin-hardening.md section 5 alone. Sections
// 1 through 4 of that document were read for context (what the repair is
// and why), but every assertion below is transcribed from section 5's
// twenty-two numbered items, and each test name carries its item number so
// a failure names the clause it came from.
//
// This suite runs in a worktree taken at the state BEFORE the week 9
// implementation exists. The author of this file has not read, and must
// not read, the implementation being written in parallel in a different
// checkout (docs/SPEC-week9-admin-hardening.md, and the task that produced
// this file, are the only inputs). Red is the expected and correct result.
//
// One PGlite instance is shared across every item in this file that needs a
// database (opened once in `before`, closed once in `after`), per the
// project's own note that many PGlite instances in one process can exceed
// this container's memory limit.
//
// A number of items name functions or files that do not exist yet:
// revokeAdminSessions, isAdminSessionRevoked, adminMethodNotAllowed and
// scripts/check-env.mjs. Node's ESM loader throws a SyntaxError at module
// link time for a *static* `import { name } from './mod.js'` when `name` is
// not an export of `mod.js` -- that would crash this entire file rather than
// failing one named test. So every such lookup below is done with a dynamic
// `await import(...)` inside the test body and read off the returned module
// object, which never throws for a missing property; the resulting
// `typeof x === 'function'` assertion is itself the first, and often the
// only, thing that fails for that item. This keeps each item's failure
// isolated and readable, which a static import of a not-yet-existing name
// would not.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import { BASH } from './posix-shell.js'
import { freshDb } from './harness.js'
import { signAdminSession, verifyAdminSession, hashAdminPassword } from '../src/admin-auth.js'
import { getAdminUserById } from '../src/admin.js'
import type { Db } from '../src/db.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ---------------------------------------------------------------------------
// One shared PGlite database for every item that touches Postgres (items 2,
// 3, 8, 9). admin_users has no drizzle table object in src/schema.ts as of
// this writing (the spec adds only a column, not the table), so rows are
// inserted through the raw client, the same pattern test/16 already uses.
// ---------------------------------------------------------------------------

type PgliteClient = Awaited<ReturnType<typeof freshDb>>['client']

let sharedDb: Db
let sharedClient: PgliteClient
let sharedMigrations: string[]

before(async () => {
  const ctx = await freshDb()
  sharedDb = ctx.db
  sharedClient = ctx.client
  sharedMigrations = ctx.migrations
})

after(async () => {
  await sharedClient.close()
})

async function insertAdminUser(
  client: PgliteClient,
  { username, password }: { username: string; password: string },
): Promise<string> {
  const passwordHash = hashAdminPassword(password)
  const result = await client.query<{ id: string }>(
    `insert into admin_users (username, password_hash) values ($1, $2) returning id`,
    [username, passwordHash],
  )
  return result.rows[0]!.id
}

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'confession-w9test-admin-hardening-'))
  try {
    return fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ===========================================================================
// Finding A -- items 1 through 10
// ===========================================================================

// item 1: verifyAdminSession returns issuedAtMs, and it equals the iat in
// the signed token.
test('item 1: verifyAdminSession returns issuedAtMs, equal to the iat carried in the signed token (spec section 1.4 point 3)', () => {
  const secret = 'a'.repeat(32)
  const token = signAdminSession(secret, { adminUserId: 'admin-item-1' })

  // Decoded independently of verifyAdminSession, so this is not circular:
  // the wire format (src/session.ts) is base64url(JSON(payload+iat)) + '.' +
  // signature, and iat is the field stamped at signing time.
  const [encodedBody] = token.split('.')
  const decoded = JSON.parse(Buffer.from(encodedBody!, 'base64url').toString('utf8')) as { iat: unknown }
  assert.equal(typeof decoded.iat, 'number', 'a signed token must carry a numeric iat')

  const result = verifyAdminSession(secret, token) as unknown as
    | { adminUserId: string; issuedAtMs: number }
    | null
  assert.ok(result, 'a freshly signed token must verify')
  assert.equal(
    result!.issuedAtMs,
    decoded.iat,
    'verifyAdminSession must return issuedAtMs, and it must equal the token iat, not merely be a fresh Date.now() (spec section 1.4 point 3)',
  )
})

// item 2: getAdminUserById returns loggedOutBefore: null for a freshly
// bootstrapped administrator.
test('item 2: getAdminUserById returns loggedOutBefore: null for a freshly bootstrapped administrator (spec section 1.4 point 4)', async () => {
  const id = await insertAdminUser(sharedClient, { username: 'item2-fresh-admin', password: 'pw-item2-fresh-admin' })
  const row = (await getAdminUserById(sharedDb, { adminUserId: id })) as unknown as
    | { loggedOutBefore: unknown }
    | null
  assert.ok(row, 'the freshly inserted administrator must be found')
  assert.equal(
    row!.loggedOutBefore,
    null,
    'null means "this operator has never logged out", which is the correct state for every existing row and every new one (spec section 1.4 point 1)',
  )
})

// item 3: revokeAdminSessions sets the column to exactly the instant passed
// in.
test('item 3: revokeAdminSessions sets logged_out_before to exactly the instant passed as "at" (spec section 1.4 point 4)', async () => {
  const id = await insertAdminUser(sharedClient, { username: 'item3-revoke-target', password: 'pw-item3-revoke-target' })

  const adminModule = (await import('../src/admin.js')) as unknown as {
    revokeAdminSessions?: (db: Db, args: { adminUserId: string; at: Date }) => Promise<unknown>
  }
  assert.equal(
    typeof adminModule.revokeAdminSessions,
    'function',
    'src/admin.js must export revokeAdminSessions(db, { adminUserId, at }) (spec section 1.4 point 4)',
  )

  const at = new Date('2026-01-01T00:00:00.000Z')
  await adminModule.revokeAdminSessions!(sharedDb, { adminUserId: id, at })

  const { rows } = await sharedClient.query<{ logged_out_before: string }>(
    `select logged_out_before from admin_users where id = $1`,
    [id],
  )
  assert.equal(
    new Date(rows[0]!.logged_out_before).getTime(),
    at.getTime(),
    'logged_out_before must be exactly the instant passed as "at" (the application clock in the route handler), not a database-side now() (spec section 1.2, section 1.4 point 4)',
  )
})

// items 4-7: isAdminSessionRevoked(issuedAtMs, loggedOutBefore), a pure
// boolean, over the token iat and the loggedOutBefore value getAdminUserById
// returns (a Date, or null when the operator has never logged out).
async function loadIsAdminSessionRevoked(): Promise<
  (issuedAtMs: number, loggedOutBefore: Date | null) => boolean
> {
  const mod = (await import('../src/admin-auth.js')) as unknown as {
    isAdminSessionRevoked?: (issuedAtMs: number, loggedOutBefore: Date | null) => boolean
  }
  assert.equal(
    typeof mod.isAdminSessionRevoked,
    'function',
    'src/admin-auth.js must export a pure isAdminSessionRevoked(issuedAtMs, loggedOutBefore): boolean, reachable without next/headers (spec section 5 item 4)',
  )
  return mod.isAdminSessionRevoked!
}

test('item 4: isAdminSessionRevoked refuses a token whose iat is strictly before logged_out_before', async () => {
  const isAdminSessionRevoked = await loadIsAdminSessionRevoked()
  const loggedOutBefore = new Date('2026-01-01T00:00:00.000Z')
  const issuedAtMs = loggedOutBefore.getTime() - 1000
  assert.equal(
    isAdminSessionRevoked(issuedAtMs, loggedOutBefore),
    true,
    'an iat strictly before logged_out_before must be revoked (spec section 1.3, section 5 item 4)',
  )
})

test('item 5: isAdminSessionRevoked refuses a token whose iat is exactly equal to logged_out_before (the <=)', async () => {
  const isAdminSessionRevoked = await loadIsAdminSessionRevoked()
  const loggedOutBefore = new Date('2026-01-01T00:00:00.000Z')
  assert.equal(
    isAdminSessionRevoked(loggedOutBefore.getTime(), loggedOutBefore),
    true,
    'a token issued in the same millisecond as a logout must be refused, not honoured: the comparison is <=, and it fails closed (spec section 1.3, section 5 item 5)',
  )
})

test('item 6: isAdminSessionRevoked accepts a token whose iat is after logged_out_before', async () => {
  const isAdminSessionRevoked = await loadIsAdminSessionRevoked()
  const loggedOutBefore = new Date('2026-01-01T00:00:00.000Z')
  const issuedAtMs = loggedOutBefore.getTime() + 1
  assert.equal(
    isAdminSessionRevoked(issuedAtMs, loggedOutBefore),
    false,
    'an iat strictly after logged_out_before must be accepted (spec section 5 item 6)',
  )
})

test('item 7: isAdminSessionRevoked accepts every token when logged_out_before is null', async () => {
  const isAdminSessionRevoked = await loadIsAdminSessionRevoked()
  for (const issuedAtMs of [0, Date.now(), Date.now() - 1000 * 60 * 60 * 24 * 365]) {
    assert.equal(
      isAdminSessionRevoked(issuedAtMs, null),
      false,
      'with logged_out_before null, every token must be accepted -- null means the operator has never logged out (spec section 1.4 point 1, section 5 item 7)',
    )
  }
})

// item 8: revokeAdminSessions on one administrator does not alter another's
// row.
test('item 8: revokeAdminSessions on one administrator does not alter another administrator\'s row', async () => {
  const idA = await insertAdminUser(sharedClient, { username: 'item8-admin-a', password: 'pw-item8-admin-a' })
  const idB = await insertAdminUser(sharedClient, { username: 'item8-admin-b', password: 'pw-item8-admin-b' })

  const adminModule = (await import('../src/admin.js')) as unknown as {
    revokeAdminSessions?: (db: Db, args: { adminUserId: string; at: Date }) => Promise<unknown>
  }
  assert.equal(typeof adminModule.revokeAdminSessions, 'function', 'src/admin.js must export revokeAdminSessions')

  await adminModule.revokeAdminSessions!(sharedDb, { adminUserId: idA, at: new Date() })

  const { rows } = await sharedClient.query<{ id: string; logged_out_before: string | null }>(
    `select id, logged_out_before from admin_users where id in ($1, $2)`,
    [idA, idB],
  )
  const byId = new Map(rows.map((r) => [r.id, r.logged_out_before]))
  assert.notEqual(byId.get(idA), null, 'the targeted administrator must be revoked')
  assert.equal(byId.get(idB), null, 'a different administrator\'s row must be untouched (spec section 5 item 8)')
})

// item 9: the migration is additive.
test('item 9: after 0003, admin_users still has every column 0002 created, and both admin_users CHECK constraints survive (spec section 1.4 point 1, section 5 item 9)', async () => {
  assert.ok(
    sharedMigrations.some((f) => /0003/.test(f)),
    'expected a drizzle/0003_*.sql migration file for the logout column, found: ' + JSON.stringify(sharedMigrations),
  )

  const cols = await sharedClient.query<{ column_name: string }>(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'admin_users'`,
  )
  const names = new Set(cols.rows.map((r) => r.column_name))
  for (const expected of ['id', 'username', 'password_hash', 'created_at', 'disabled_at']) {
    assert.ok(names.has(expected), `admin_users must still have the column "${expected}" that 0002 created`)
  }
  assert.ok(names.has('logged_out_before'), 'admin_users must gain a nullable logged_out_before column')

  const constraints = await sharedClient.query<{ conname: string }>(
    `select conname from pg_constraint where conrelid = 'admin_users'::regclass`,
  )
  const constraintNames = new Set(constraints.rows.map((r) => r.conname))
  assert.ok(
    constraintNames.has('admin_users_password_hash_is_scrypt'),
    'admin_users_password_hash_is_scrypt must still be present after 0003',
  )
  assert.ok(
    constraintNames.has('admin_users_username_nonblank'),
    'admin_users_username_nonblank must still be present after 0003',
  )
})

// item 10: test/02-tripwire-columns.test.ts still passes -- run it, not read
// it.
test('item 10: test/02-tripwire-columns.test.ts still passes after the 0003 migration exists (spec section 5 item 10)', () => {
  const tripwireTest = path.resolve(REPO_ROOT, 'test', '02-tripwire-columns.test.ts')
  const result = spawnSync('node', ['--import', 'tsx', '--test', tripwireTest], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
  })
  assert.equal(
    result.status,
    0,
    'test/02-tripwire-columns.test.ts must still pass: logged_out_before is not an identity column and must not trip the ' +
      `surveillance-column denylist (spec section 5 item 10). stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  )
})

// ===========================================================================
// Finding B -- items 11 through 13
// ===========================================================================

const METHOD_GUARD_PATH = path.resolve(REPO_ROOT, 'app', 'admin', '_lib', 'method-guard.ts')

// adminMethodNotAllowed's own decision depends on env.adminEnabled, which is
// a module-level singleton cached on first read inside src/env.ts. Two
// different states of that flag cannot be observed within one process, so
// each state is probed in its own subprocess: a throwaway script imports the
// module fresh, calls the handler once, and reports the resulting response
// status on stdout.
function runMethodGuardProbe(envOverrides: Record<string, string>): { status: number | null; stdout: string; stderr: string } {
  return withTempDir((dir) => {
    const probe = path.join(dir, 'probe.mts')
    writeFileSync(
      probe,
      [
        // A bare filesystem path is not a valid ESM specifier on Windows:
        // the loader reads "C:\\..." as a URL with an unsupported 'c:'
        // scheme and the probe dies before it can report a status. Hand it
        // a file:// URL, which is correct on every platform.
        `import { adminMethodNotAllowed } from ${JSON.stringify(pathToFileURL(METHOD_GUARD_PATH).href)}`,
        "const request = new Request('https://stg.confession.fayad.app/admin/reveal')",
        'const response = await adminMethodNotAllowed(request, {})',
        "console.log(JSON.stringify({ status: response.status }))",
      ].join('\n'),
    )
    const baseEnv: Record<string, string> = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/confession',
      SESSION_SECRET: 'm'.repeat(32),
      APP_ORIGIN: 'https://stg.confession.fayad.app',
      ADMIN_BOOTSTRAP_USERNAME: '',
      ADMIN_BOOTSTRAP_PASSWORD_HASH: '',
    }
    const result = spawnSync('node', ['--import', 'tsx', probe], {
      encoding: 'utf8',
      env: { ...process.env, ...baseEnv, ...envOverrides },
    })
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
  })
}

// item 11: 404 when the admin surface is disabled.
test('item 11: adminMethodNotAllowed answers 404 when the admin surface is disabled (spec section 2.1, section 5 item 11)', () => {
  const { status, stdout, stderr } = runMethodGuardProbe({})
  assert.equal(
    status,
    0,
    'the probe process (importing app/admin/_lib/method-guard.ts and calling adminMethodNotAllowed) must run cleanly; ' +
      `stderr:\n${stderr}`,
  )
  const parsed = JSON.parse(stdout.trim()) as { status: number }
  assert.equal(
    parsed.status,
    404,
    'adminMethodNotAllowed must answer 404 when env.adminEnabled is false, so a disabled stack answers every method the ' +
      'same way an absent path would (spec section 2.1, section 0.2)',
  )
})

// item 12: 405 when the admin surface is enabled.
test('item 12: adminMethodNotAllowed answers 405 when the admin surface is enabled (spec section 2.1, section 5 item 12)', () => {
  const validHash = hashAdminPassword('a bootstrap password for the method guard test')
  const { status, stdout, stderr } = runMethodGuardProbe({
    ADMIN_BOOTSTRAP_USERNAME: 'methodguardtest',
    ADMIN_BOOTSTRAP_PASSWORD_HASH: validHash,
  })
  assert.equal(status, 0, `the probe process must run cleanly; stderr:\n${stderr}`)
  const parsed = JSON.parse(stdout.trim()) as { status: number }
  assert.equal(
    parsed.status,
    405,
    "adminMethodNotAllowed must answer 405 when env.adminEnabled is true -- Next's own answer today, so an enabled " +
      'stack\'s behaviour is unchanged (spec section 2.1)',
  )
})

// item 13: the route files export the shared helper itself, not a lookalike.
test('item 13: app/admin/reveal/route.ts and app/admin/logout/route.ts each export GET, PUT, PATCH, DELETE and OPTIONS as the exact shared adminMethodNotAllowed helper (spec section 2.1, section 5 item 13)', async () => {
  const methodGuardModule = (await import('../app/admin/_lib/method-guard.js')) as unknown as {
    adminMethodNotAllowed?: unknown
  }
  const adminMethodNotAllowed = methodGuardModule.adminMethodNotAllowed
  assert.equal(
    typeof adminMethodNotAllowed,
    'function',
    'app/admin/_lib/method-guard.ts must export adminMethodNotAllowed',
  )

  const routeFiles = ['../app/admin/reveal/route.js', '../app/admin/logout/route.js']
  for (const routeRel of routeFiles) {
    const mod = (await import(routeRel)) as Record<string, unknown>
    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      assert.equal(
        mod[method],
        adminMethodNotAllowed,
        `${routeRel} must export ${method} bound to the identical adminMethodNotAllowed function reference, asserted by ` +
          'reading the module\'s exports rather than its source text (spec section 5 item 13)',
      )
    }
  }
})

// ===========================================================================
// Finding C -- items 14 through 18
// ===========================================================================
//
// The current scripts/check-deploy-pairing.sh (read before writing these
// five tests, since item 13's "read exports, not text" instruction is
// specific to that one item) takes five positional arguments and validates
// them against a fixed table; it does not open any file. Spec section 3
// item 1 says the sixth check "already reads the .env it is validating",
// which is not true of that five-argument form: a value that has already
// been extracted as a shell string (by scripts/read-env-key.sh, which
// itself strips one layer of quoting per test/13) can no longer answer
// "was this quoted in the file". The only way the described check is
// possible is for the script to read the .env file's own text directly, so
// the tests below assume it grows a sixth positional argument: the path to
// the .env file to scan. This is an assumption, not a quotation from the
// spec, and is called out again in this run's report.

const CHECK_DEPLOY_PAIRING_SCRIPT = path.resolve(REPO_ROOT, 'scripts', 'check-deploy-pairing.sh')

const STAGING_ROW = {
  stack: 'confession',
  port: '8182',
  origin: 'https://stg.confession.fayad.app',
  dir: '/srv/apps/confession',
}

function runCheckDeployPairing(args: string[]): { status: number | null; stderr: string } {
  const result = spawnSync(BASH, [CHECK_DEPLOY_PAIRING_SCRIPT, ...args], { encoding: 'utf8' })
  return { status: result.status, stderr: result.stderr ?? '' }
}

function stagingArgs(envFile: string): string[] {
  return [STAGING_ROW.stack, STAGING_ROW.port, STAGING_ROW.origin, '', STAGING_ROW.dir, envFile]
}

// item 14: rejects an unquoted $-bearing ADMIN_BOOTSTRAP_PASSWORD_HASH,
// naming the variable.
test('item 14: check-deploy-pairing.sh rejects an .env whose ADMIN_BOOTSTRAP_PASSWORD_HASH contains $ and is not single-quoted, naming the variable (spec section 3 item 1, section 5 item 14)', () => {
  withTempDir((dir) => {
    const envFile = path.join(dir, '.env')
    writeFileSync(envFile, 'ADMIN_BOOTSTRAP_PASSWORD_HASH=scrypt$16384$8$1$abcdefgh$ijklmnop\n')
    const { status, stderr } = runCheckDeployPairing(stagingArgs(envFile))
    assert.notEqual(
      status,
      0,
      'an unquoted $-bearing ADMIN_BOOTSTRAP_PASSWORD_HASH must be refused before the build (spec section 3 item 1)',
    )
    assert.match(
      stderr,
      /ADMIN_BOOTSTRAP_PASSWORD_HASH/,
      'the refusal must name the offending variable, not just say something is wrong',
    )
  })
})

// item 15: accepts the same value single-quoted.
test('item 15: check-deploy-pairing.sh accepts the same .env once ADMIN_BOOTSTRAP_PASSWORD_HASH is single-quoted (spec section 5 item 15)', () => {
  withTempDir((dir) => {
    const envFile = path.join(dir, '.env')
    writeFileSync(envFile, "ADMIN_BOOTSTRAP_PASSWORD_HASH='scrypt$16384$8$1$abcdefgh$ijklmnop'\n")
    const { status, stderr } = runCheckDeployPairing(stagingArgs(envFile))
    assert.equal(status, 0, `a single-quoted $-bearing value must be accepted; stderr:\n${stderr}`)
  })
})

// item 16: accepts an .env with no ADMIN_BOOTSTRAP_PASSWORD_HASH at all.
test('item 16: check-deploy-pairing.sh accepts an .env with no ADMIN_BOOTSTRAP_PASSWORD_HASH at all (spec section 5 item 16)', () => {
  withTempDir((dir) => {
    const envFile = path.join(dir, '.env')
    writeFileSync(envFile, 'SOME_UNRELATED_KEY=some-unrelated-value\n')
    const { status, stderr } = runCheckDeployPairing(stagingArgs(envFile))
    assert.equal(
      status,
      0,
      `a stack with no administrator configured is legal (spec week 7 section 2.5); stderr:\n${stderr}`,
    )
  })
})

// item 17: the rule is about Compose, not about that one variable.
test('item 17: check-deploy-pairing.sh rejects an unquoted $-bearing value under any key, not just ADMIN_BOOTSTRAP_PASSWORD_HASH (spec section 5 item 17)', () => {
  withTempDir((dir) => {
    const envFile = path.join(dir, '.env')
    writeFileSync(envFile, 'SOME_OTHER_KEY=has$adollarsign\n')
    const { status, stderr } = runCheckDeployPairing(stagingArgs(envFile))
    assert.notEqual(
      status,
      0,
      'a $-bearing unquoted value must be refused regardless of which key carries it -- the failure mode is Docker Compose interpolation of env_file values, not something specific to the admin hash (spec section 3 item 1)',
    )
    assert.match(stderr, /SOME_OTHER_KEY/, 'the refusal must name the offending key')
  })
})

// item 18: hash-admin-password.ts still prints exactly one stdout line, and
// the quoting warning is on stderr.
test('item 18: scripts/hash-admin-password.ts still prints exactly one line on stdout, and the quoting warning is on stderr (spec section 3 item 3, section 5 item 18)', () => {
  const scriptPath = path.resolve(REPO_ROOT, 'scripts', 'hash-admin-password.ts')
  const result = spawnSync('node', ['--import', 'tsx', scriptPath], {
    input: 'a password for the hash-admin-password stdout test\n',
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, `hash-admin-password.ts must exit 0 on a valid password; stderr:\n${result.stderr}`)

  const stdoutLines = result.stdout.split('\n').filter((l) => l.length > 0)
  assert.equal(
    stdoutLines.length,
    1,
    'stdout must remain exactly one line so every existing $(...) use of this script is unchanged (spec section 3 item 3)',
  )
  assert.match(stdoutLines[0]!, /^scrypt\$/, 'the one stdout line must be the bare hash')

  assert.match(
    result.stderr,
    /single.?quot/i,
    'stderr must gain a line telling the operator the printed value must be single-quoted in .env (spec section 3 item 3); ' +
      `got stderr:\n${result.stderr}`,
  )
})

// ===========================================================================
// Finding D -- items 19 through 22
// ===========================================================================

const CHECK_ENV_SCRIPT = path.resolve(REPO_ROOT, 'scripts', 'check-env.mjs')

// Run with plain `node`, no tsx: scripts/check-env.mjs is modelled on
// scripts/migrate.mjs (spec section 4), which docker-entrypoint.sh runs with
// plain `node` inside a runtime image that carries no dev dependencies.
function runCheckEnv(envOverrides: Record<string, string>): { status: number | null; stdout: string; stderr: string } {
  const baseEnv: Record<string, string> = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://user:pass@localhost:5432/confession',
    SESSION_SECRET: 'n'.repeat(32),
    APP_ORIGIN: 'https://stg.confession.fayad.app',
  }
  const result = spawnSync('node', [CHECK_ENV_SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, ...baseEnv, ...envOverrides },
    cwd: REPO_ROOT,
  })
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

// item 19: exits 0 on a valid environment.
test('item 19: scripts/check-env.mjs exits 0 on a valid environment (spec section 4, section 5 item 19)', () => {
  const { status, stderr, stdout } = runCheckEnv({})
  assert.equal(status, 0, `check-env.mjs must exit 0 silently on a valid environment; stdout:\n${stdout}\nstderr:\n${stderr}`)
})

// item 20: exits 1 and prints the thrown message for the exact truncated
// hash section 0.3 measured.
test('item 20: scripts/check-env.mjs exits 1 and prints the thrown message for the truncated scrypt$16384$8$1 hash Compose actually produced (spec section 5 item 20)', () => {
  const { status, stdout, stderr } = runCheckEnv({
    ADMIN_BOOTSTRAP_USERNAME: 'siteadmin',
    ADMIN_BOOTSTRAP_PASSWORD_HASH: 'scrypt$16384$8$1',
  })
  assert.notEqual(
    status,
    0,
    'check-env.mjs must exit non-zero for the 16-byte truncated hash this session actually produced (spec section 0.3, section 4)',
  )
  const combined = stdout + stderr
  assert.match(
    combined,
    /scrypt\$N\$r\$p\$salt\$key/,
    'the printed message must be the same thrown message src/env.ts already produces for this exact defect, prefixed ' +
      `check-env: per spec section 4; got stdout:\n${stdout}\nstderr:\n${stderr}`,
  )
})

// item 21: no part of any environment variable's value ever appears in the
// output, checked with a canary.
test('item 21: scripts/check-env.mjs output contains no part of any environment variable value (canary check) (spec section 4, section 5 item 21)', () => {
  const canary = 'CANARYVALUEDONOTPRINT8B3F1C'
  const { status, stdout, stderr } = runCheckEnv({
    SESSION_SECRET: canary.padEnd(32, 'x'),
    POSTGRES_PASSWORD: canary,
    // Exercised on its failure path too, per section 5 item 20 -- the path
    // with the most incentive to leak a value in an error message.
    ADMIN_BOOTSTRAP_USERNAME: 'siteadmin',
    ADMIN_BOOTSTRAP_PASSWORD_HASH: 'scrypt$16384$8$1',
  })
  // Guards against a vacuous pass: if the script is missing entirely,
  // spawnSync produces no stdout or stderr at all (status null, an ENOENT),
  // which would satisfy "the canary appears zero times" for the wrong
  // reason. The failure this item is actually about must have run and
  // produced the item-20 message before the canary check means anything.
  assert.notEqual(
    status,
    null,
    `scripts/check-env.mjs must exist and run for this check to mean anything (a null status is spawnSync failing to ` +
      `launch it at all); stderr:\n${stderr}`,
  )
  assert.match(
    stdout + stderr,
    /scrypt\$N\$r\$p\$salt\$key/,
    'this probe must actually exercise the failure path (the same truncated-hash case as item 20) before the absence ' +
      'of the canary is evidence of anything',
  )
  assert.equal(
    (stdout + stderr).includes(canary),
    false,
    'no part of SESSION_SECRET or POSTGRES_PASSWORD may appear in check-env.mjs output, on the success path or the ' +
      'failure path (spec section 4: "it prints no variable values, ever")',
  )
})

// item 22: docker-entrypoint.sh runs check-env.mjs before migrate.mjs.
test('item 22: docker-entrypoint.sh invokes check-env.mjs before migrate.mjs (spec section 4, section 5 item 22)', () => {
  const src = readFileSync(path.resolve(REPO_ROOT, 'docker-entrypoint.sh'), 'utf8')
  const lines = src.split('\n')
  const checkEnvLine = lines.findIndex((l) => l.includes('check-env.mjs'))
  const migrateLine = lines.findIndex((l) => l.includes('migrate.mjs'))
  assert.notEqual(checkEnvLine, -1, 'docker-entrypoint.sh must invoke check-env.mjs (spec section 4)')
  assert.notEqual(migrateLine, -1, 'docker-entrypoint.sh must invoke migrate.mjs')
  assert.ok(
    checkEnvLine < migrateLine,
    'check-env.mjs must run before migrate.mjs, so a stack that cannot serve a request never writes to the database ' +
      '(spec section 4)',
  )
})
