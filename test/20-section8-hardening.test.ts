// test/20-section8-hardening.test.ts
//
// Written from docs/SPEC-week10-account-deletion.md section 8 alone (section
// 8.1 through 8.4, plus section 2.2, section 3.1 and section 4.3 for the
// surrounding contract), by an agent that has not read and must not read
// the repair for these three findings, being written in parallel in a
// different worktree. Red is the expected and correct result for most items
// below; a green item is called out with the reason it is legitimately
// green (usually: it is a regression guard for behaviour the repair must
// not break, and that behaviour already exists in this tree).
//
// Section 8's three findings sit on top of a week 10 base slice (section 1
// through section 7, acceptance items 1 through 32) that is already built
// and merged in this tree -- unlike a from-scratch slice, most of the
// scaffolding this file needs (deleteAccount, isAccountActive,
// requireActiveViewerAccountId, the accounts/links CHECKs and triggers)
// already exists and is imported statically below. Only the three specific
// repairs section 8 asks for -- the requireActiveViewerAccountId call in
// acceptTermsAction, the strengthened accounts CHECK, and the database
// lookup in app/page.tsx -- are absent, so items 33, 34, 36 and 38 are
// expected red. Nothing here is imported dynamically merely for caution;
// dynamic import is used only where the target genuinely might not exist
// (item 39's predicate, whose export name section 8 never states).
//
// One PGlite instance is shared across every item that needs a database
// (opened in `before`, closed in `after`), per the project's own note that
// many PGlite instances in one process can exceed this container's memory
// limit.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { freshDb } from './harness.js'
import { createAccount } from './fixtures.js'
import { deleteAccount } from '../src/account-deletion.js'
import { getAccountById } from '../src/accounts.js'
import type { Db } from '../src/db.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

type Ctx = Awaited<ReturnType<typeof freshDb>>
type PgliteClient = Ctx['client']

let sharedDb: Db
let sharedClient: PgliteClient

before(async () => {
  const ctx = await freshDb()
  sharedDb = ctx.db
  sharedClient = ctx.client
})

after(async () => {
  await sharedClient.close()
})

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function readIfExists(p: string): string | null {
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

function pgErrorCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined
}

// Rules out the row failing because a column or table is simply absent
// (42703 / 42P01), which would make a constraint test pass for the wrong
// reason -- mirrors test/19-account-deletion.test.ts's own helper of the
// same shape.
function notMissingSchemaError(err: unknown): boolean {
  const code = pgErrorCode(err)
  assert.notEqual(code, '42703', `expected a constraint violation, got an undefined-column error: ${String(err)}`)
  assert.notEqual(code, '42P01', `expected a constraint violation, got an undefined-relation error: ${String(err)}`)
  return true
}

function isCheckViolation(err: unknown): boolean {
  notMissingSchemaError(err)
  assert.equal(pgErrorCode(err), '23514', `expected a CHECK violation (23514), got: ${String(err)}`)
  return true
}

async function fetchAccountRaw(client: PgliteClient, accountId: string) {
  const { rows } = await client.query<{
    provider_user_id: string
    display_name: string
    deleted_at: string | null
    disabled_at: string | null
  }>(`select provider_user_id, display_name, deleted_at, disabled_at from accounts where id = $1`, [accountId])
  return rows[0] ?? null
}

// Recursively lists every .ts/.tsx file under a directory. Used instead of a
// hardcoded file list (spec section 8.4 item 33: "The list is enumerated
// from the filesystem, not hardcoded, so a file added later is covered").
// No glob dependency is added; this project has none and the task forbids
// adding one, so a plain recursive readdir stands in for one.
function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      listSourceFiles(full, out)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      out.push(full)
    }
  }
  return out
}

// A file is treated as an independent POST endpoint reachable on its own
// (spec section 8.1: "A Next server action is an independent POST
// endpoint") when the literal directive appears anywhere in its text, with
// either quote style Next accepts.
function hasUseServerDirective(src: string): boolean {
  return src.includes("'use server'") || src.includes('"use server"')
}

function toRelPosix(absPath: string): string {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join('/')
}

// app/admin/** is a separate identity with its own guard
// (app/admin/_lib/auth.ts, week 9's admin session model) and its own
// acceptance list (week 9's, and week 7's before it) -- it is not gated by
// requireActiveViewerAccountId at all, by design, because an administrator
// is not a viewer account. Section 8.4 item 33 says explicitly that
// app/admin/** is out of scope, so it is excluded here before the
// session/database heuristic below ever looks at it, rather than being
// judged by a rule that was never meant to apply to it.
function isOutOfScopeForItem33(relPath: string): boolean {
  return relPath.startsWith('admin/')
}

function discoverUseServerFiles(): Array<{ relPath: string; absPath: string; src: string }> {
  const files = listSourceFiles(APP_DIR)
  const found: Array<{ relPath: string; absPath: string; src: string }> = []
  for (const absPath of files) {
    const relToApp = path.relative(APP_DIR, absPath).split(path.sep).join('/')
    if (isOutOfScopeForItem33(relToApp)) continue
    const src = readFileSync(absPath, 'utf8')
    if (hasUseServerDirective(src)) {
      found.push({ relPath: toRelPosix(absPath), absPath, src })
    }
  }
  return found
}

// A file "reaches a database write from a session" (spec section 8.4 item
// 33) is approximated here as: it derives an account id from the session
// cookie (through any of the three functions app/_lib/auth.ts exports for
// that purpose) AND it opens a database handle. Every 'use server' file in
// this app that writes anything calls getDb() to do it -- there is no other
// way to reach the database from app/ -- so this is a sound proxy for "does
// a write" without having to parse which specific call is a write and which
// is a read.
const SESSION_DERIVED_PATTERN = /getViewerAccountId\(|requireViewerAccountId\(|requireActiveViewerAccountId\(/
const REACHES_DB_PATTERN = /getDb\(/

// Files that derive a session account id and reach the database, but are
// not gated by requireActiveViewerAccountId, together with the reason (spec
// section 8.4 item 33: "or is named here with the reason it cannot").
//
// app/c/[slug]/actions.ts (sendConfessionAction) is the one file in this
// position. It intentionally does not use requireActiveViewerAccountId:
// that function redirects an unauthenticated visitor to '/', but a visitor
// on a stranger's confession link with no session at all is the ordinary,
// expected case here and must instead redirect back to the same slug with
// a sign-in prompt (?error=signin), not home. A *deleted* sender is refused
// separately, in the domain layer, by sendConfession itself (spec section
// 3.3) via the trigger of spec section 2.4 item 6 and its application-level
// check -- so the guarantee item 33 is chasing (a deleted account cannot
// write through a session-authenticated action) still holds for this file,
// just enforced one layer lower than requireActiveViewerAccountId.
const SESSION_WRITE_EXEMPTIONS = new Map<string, string>([
  [
    'app/c/[slug]/actions.ts',
    'sendConfessionAction must let an anonymous visitor through to a sign-in prompt on the same slug rather than ' +
      'bouncing home, and a deleted sender is refused independently by sendConfession in the domain layer (spec section 3.3).',
  ],
])

// ---------------------------------------------------------------------------
// Item 33
// ---------------------------------------------------------------------------

test('item 33: every use-server file under app/ (excluding app/admin/**) that derives a session account id and reaches the database calls requireActiveViewerAccountId, or is named in the exemption list above with the reason it cannot (spec section 8.4 item 33)', () => {
  const files = discoverUseServerFiles()
  assert.ok(
    files.length > 0,
    `expected to find at least one 'use server' file under ${APP_DIR} by walking the filesystem; found none`,
  )

  const offenders: string[] = []
  for (const { relPath, src } of files) {
    const derivesFromSession = SESSION_DERIVED_PATTERN.test(src)
    const reachesDatabase = REACHES_DB_PATTERN.test(src)
    if (!derivesFromSession || !reachesDatabase) continue

    if (src.includes('requireActiveViewerAccountId(')) continue
    if (SESSION_WRITE_EXEMPTIONS.has(relPath)) continue
    offenders.push(relPath)
  }

  assert.deepEqual(
    offenders,
    [],
    'these use-server files derive an account id from the session and reach the database, but call neither ' +
      `requireActiveViewerAccountId nor appear in this file's exemption list: ${JSON.stringify(offenders)} ` +
      '(spec section 8.1: "gating the page gates nothing" -- a server action is reachable without its page)',
  )
})

// ---------------------------------------------------------------------------
// Items 34 and 35 -- app/onboarding/actions.ts
// ---------------------------------------------------------------------------

const ONBOARDING_ACTIONS = path.resolve(APP_DIR, 'onboarding', 'actions.ts')

// A small, self-contained import-clause reader: true when `name` appears in
// a `{ ... }` import clause whose module specifier contains
// `moduleSubstring`. Used instead of a plain substring search on `name` so
// this cannot be fooled by a comment or an unrelated local variable of the
// same name.
function importsNameFrom(src: string, name: string, moduleSubstring: string): boolean {
  const importBlockPattern = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = importBlockPattern.exec(src))) {
    const names = match[1] ?? ''
    const modulePath = match[2] ?? ''
    if (modulePath.includes(moduleSubstring) && new RegExp(`\\b${name}\\b`).test(names)) {
      return true
    }
  }
  return false
}

// The split point between the session branch and the pending-identity
// (signup) branch of acceptTermsAction, as the function is written today
// (app/onboarding/page.tsx uses the identical read as its own split point,
// one function over): `store.get(PENDING_IDENTITY_COOKIE)`. Spec section
// 8.1 requires the session branch to gain a check and requires the
// pending-identity branch to stay untouched, so both item 34 and item 35
// below use this same textual boundary rather than two independent guesses
// at where it is.
const PENDING_IDENTITY_MARKER = '.get(PENDING_IDENTITY_COOKIE)'

test('item 34: acceptTermsAction specifically calls requireActiveViewerAccountId, on the session branch and before the pending-identity branch begins (spec section 8.4 item 34)', () => {
  const src = readIfExists(ONBOARDING_ACTIONS)
  assert.ok(src, `app/onboarding/actions.ts must exist; looked at ${ONBOARDING_ACTIONS}`)

  assert.ok(
    importsNameFrom(src!, 'requireActiveViewerAccountId', '_lib/auth'),
    'app/onboarding/actions.ts must import requireActiveViewerAccountId from the auth module ' +
      '(spec section 8.1: "acceptTermsAction takes requireActiveViewerAccountId(db) on its session branch")',
  )

  const pendingBranchStart = src!.indexOf(PENDING_IDENTITY_MARKER)
  assert.notEqual(
    pendingBranchStart,
    -1,
    `expected to still find ${PENDING_IDENTITY_MARKER} in app/onboarding/actions.ts, to locate the session branch`,
  )

  const sessionBranchSource = src!.slice(0, pendingBranchStart)
  assert.match(
    sessionBranchSource,
    /requireActiveViewerAccountId\(/,
    'requireActiveViewerAccountId must actually be called before the pending-identity branch begins, on the session ' +
      'branch (spec section 8.1) -- an import with no call would not close the gap the finding describes',
  )
})

test('item 35: app/onboarding/actions.ts\'s pending-identity branch is unchanged -- a signup with a valid pending-identity cookie and no session still creates an account, and that branch is not gated behind requireActiveViewerAccountId (spec section 8.4 item 35)', () => {
  const src = readIfExists(ONBOARDING_ACTIONS)
  assert.ok(src, `app/onboarding/actions.ts must exist; looked at ${ONBOARDING_ACTIONS}`)

  const pendingBranchStart = src!.indexOf(PENDING_IDENTITY_MARKER)
  assert.notEqual(
    pendingBranchStart,
    -1,
    `expected to still find ${PENDING_IDENTITY_MARKER} in app/onboarding/actions.ts, to locate the pending-identity branch`,
  )

  const pendingBranchSource = src!.slice(pendingBranchStart)

  assert.match(
    pendingBranchSource,
    /verifyPendingIdentityCookieValue\(/,
    'the pending-identity branch must still verify the pending-identity cookie',
  )
  assert.match(
    pendingBranchSource,
    /createAccountWithTerms\(/,
    'the pending-identity branch must still create an account for a valid pending identity: a signup with a valid ' +
      'pending-identity cookie and no session must still work (spec section 8.1: "the pending-identity branch below ' +
      'it is the signup path and must not be touched")',
  )
  assert.doesNotMatch(
    pendingBranchSource,
    /requireActiveViewerAccountId\(/,
    'the pending-identity branch must not be gated behind requireActiveViewerAccountId -- that predicate is about an ' +
      'existing account\'s state and would wrongly refuse a brand-new signup, which by definition has no account yet',
  )
})

// ---------------------------------------------------------------------------
// Item 36 -- the strengthened accounts CHECK
// ---------------------------------------------------------------------------

test('item 36: the accounts CHECK rejects deleted_at set with provider_user_id equal to a different row\'s uuid, and accepts it with the row\'s own uuid (spec section 8.4 item 36)', async () => {
  const { id: victimId } = await createAccount(sharedDb, { displayName: 'item36 victim real name' })
  const { id: attackerId } = await createAccount(sharedDb, { displayName: 'item36 attacker real name' })

  await assert.rejects(
    sharedClient.query(
      `update accounts set deleted_at = now(), display_name = '[deleted]', provider_user_id = $2 where id = $1`,
      [attackerId, `deleted:${victimId}`],
    ),
    isCheckViolation,
    'the accounts CHECK must reject deleted_at set with provider_user_id carrying a different row\'s uuid ' +
      '(spec section 8.2: the current CHECK only tests the "deleted:" prefix, so any string with that prefix ' +
      'satisfies it today)',
  )

  const afterRejected = await fetchAccountRaw(sharedClient, attackerId)
  assert.equal(afterRejected!.deleted_at, null, 'the rejected update must not have left the row half-tombstoned')

  await sharedClient.query(
    `update accounts set deleted_at = now(), display_name = '[deleted]', provider_user_id = $2 where id = $1`,
    [attackerId, `deleted:${attackerId}`],
  )
  const afterOwn = await fetchAccountRaw(sharedClient, attackerId)
  assert.equal(
    afterOwn!.provider_user_id,
    `deleted:${attackerId}`,
    'the same shape must still be accepted when provider_user_id carries the row\'s own uuid (spec section 8.2: ' +
      '"the CHECK asserts provider_user_id = \'deleted:\' || id::text")',
  )
  assert.notEqual(afterOwn!.deleted_at, null)
})

// ---------------------------------------------------------------------------
// Item 37 -- deleteAccount still works under the strengthened CHECK
// ---------------------------------------------------------------------------

test('item 37: deleteAccount still succeeds end to end under the strengthened accounts CHECK, and test/19-account-deletion.test.ts items 11 through 17 still pass (spec section 8.4 item 37)', async () => {
  const { id } = await createAccount(sharedDb, { displayName: 'item37 real name', providerUserId: 'item37-fb-id' })
  await deleteAccount(sharedDb, { accountId: id })

  const row = await fetchAccountRaw(sharedClient, id)
  assert.ok(row, 'the account row must still exist after deletion')
  assert.equal(
    row!.provider_user_id,
    `deleted:${id}`,
    'deleteAccount always writes the account\'s own id, so it must still satisfy a CHECK strengthened to require ' +
      'exactly that (spec section 8.2)',
  )
  assert.equal(row!.display_name, '[deleted]')
  assert.notEqual(row!.deleted_at, null)

  // The regression net spec section 8.4 item 37 asks for by name: the
  // acceptance items that cover deleteAccount's own contract, re-run
  // against this tree exactly as they run standalone, filtered to items 11
  // through 17 (--test-name-pattern), so a strengthened CHECK that broke
  // deleteAccount itself would show up here without this file re-deriving
  // every one of those items' assertions by hand.
  const item19Path = path.resolve(REPO_ROOT, 'test', '19-account-deletion.test.ts')
  // NODE_TEST_CONTEXT is set by this very process (it is itself running
  // under `node --test`) and, if inherited, switches the child test run to
  // a machine-readable reporter with no human-readable stdout at all --
  // which would make the "# pass 7" check below fail for a reason that has
  // nothing to do with item 37. It is stripped here so the child runs
  // exactly as it does invoked standalone.
  const childEnv = { ...process.env }
  delete childEnv.NODE_TEST_CONTEXT
  const result = spawnSync(
    'node',
    ['--import', 'tsx', '--test', '--test-name-pattern', '^item (11|12|13|14|15|16|17):', item19Path],
    { encoding: 'utf8', cwd: REPO_ROOT, env: childEnv },
  )
  assert.equal(
    result.status,
    0,
    'test/19-account-deletion.test.ts items 11 through 17 must still pass under the strengthened accounts CHECK ' +
      `(spec section 8.4 item 37). stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  )
  assert.match(
    result.stdout,
    /# pass 7/,
    `expected exactly the 7 filtered items (11-17) to run and pass; got:\n${result.stdout}`,
  )
})

// ---------------------------------------------------------------------------
// Item 38 -- app/page.tsx resolves the session against the database
// ---------------------------------------------------------------------------

const HOME_PAGE = path.resolve(APP_DIR, 'page.tsx')

test('item 38: the redirect to /inbox is gated on an account resolved from the database, so a missing, disabled or deleted account is not redirected (spec section 8.4 item 38)', async () => {
  const src = readIfExists(HOME_PAGE)
  assert.ok(src, `app/page.tsx must exist; looked at ${HOME_PAGE}`)

  const inboxRedirectIdx = src!.indexOf("redirect('/inbox')")
  assert.notEqual(inboxRedirectIdx, -1, 'app/page.tsx must still redirect to /inbox for a usable session')

  // Structure, but only as far as item 38 actually states it: the redirect is
  // taken on a value the page awaited from a resolver it HANDED SOMETHING --
  // the database. Where that resolver keeps getAccountById / isAccountActive
  // is its own business. The first version of this item asserted that those
  // names appeared in the span between the cookie read and the redirect, and
  // so it failed against a correct repair that moved them one call deeper
  // (section 8.6). Re-aimed here at the decision instead of at the text.
  const head = src!.slice(0, inboxRedirectIdx)
  const resolved = [...head.matchAll(/const\s+(\w+)\s*=\s*await\s+([\w.]+)\s*\(([^)]*)\)/g)]
  const gate = resolved.find(
    (m) =>
      m[3].trim().length > 0 &&
      new RegExp(`if\\s*\\(\\s*${m[1]}\\s*\\)`).test(src!.slice(m.index ?? 0, inboxRedirectIdx + 40)),
  )
  assert.ok(
    gate,
    'app/page.tsx must reach redirect(\'/inbox\') only inside `if (<x>)`, where <x> was awaited from a resolver ' +
      'called WITH an argument -- the database handle. Redirecting on a zero-argument cookie read is exactly the ' +
      'loop spec section 8.3 describes ("/ trusts the cookie alone and loops with /inbox").',
  )

  // Behaviour, proven against real rows rather than source text. This is the
  // half of item 38 that matters: an account that is missing or deleted is
  // decided un-redirectable by the same predicate the page's resolver uses.
  const found = await loadActiveAccountPredicate()
  assert.ok(found, 'item 39 must find the predicate before item 38 can assert what it decides')
  if (!found) return

  const { id } = await createAccount(sharedDb, { displayName: 'item38 real name', providerUserId: 'item38-fb-id' })
  const live = await getAccountById(sharedDb, { accountId: id })
  assert.ok(live, 'a freshly created account must be readable back')
  assert.equal(found.fn(live as never), true, 'an active account resolves, so / redirects it to /inbox')

  await deleteAccount(sharedDb, { accountId: id })
  const tombstoned = await getAccountById(sharedDb, { accountId: id })
  assert.equal(
    found.fn((tombstoned ?? null) as never),
    false,
    'a deleted account must not resolve, so / renders the landing page instead of bouncing to /inbox',
  )

  assert.equal(found.fn(null as never), false, 'a missing account must not resolve')
})

// ---------------------------------------------------------------------------
// Item 39 -- the decision behind item 38, reachable without next/headers
// ---------------------------------------------------------------------------

// Section 8.3's required fix does not name an export for the decision it
// asks app/page.tsx to make. The existing isAccountActive predicate in
// src/accounts.ts (spec section 4.3's own pure predicate, already exported
// and already usable with no next/headers in the chain) is the obvious
// candidate to reuse for this too, but section 8 never says the repair must
// reuse it rather than add a second, differently named one -- so this
// searches a short list of plausible names, the same way
// test/19-account-deletion.test.ts's item 30 does, and fails with a message
// naming everything it looked for if none of them exist.
const PREDICATE_CANDIDATES: Array<{ modulePath: string; exportNames: string[] }> = [
  { modulePath: '../src/accounts.js', exportNames: ['isAccountActive', 'isActiveAccount', 'isAccountInactive', 'canReachInbox', 'accountIsActive'] },
  { modulePath: '../app/_lib/auth.js', exportNames: ['isAccountActive', 'isActiveAccount', 'isAccountInactive', 'canReachInbox', 'accountIsActive'] },
]

async function loadActiveAccountPredicate(): Promise<
  { fn: (account: { disabledAt: Date | null; deletedAt: Date | null } | null) => boolean; modulePath: string; exportName: string } | null
> {
  for (const candidate of PREDICATE_CANDIDATES) {
    const mod = (await import(candidate.modulePath).catch(() => ({}))) as Record<string, unknown>
    for (const name of candidate.exportNames) {
      if (typeof mod[name] === 'function') {
        return {
          fn: mod[name] as (a: { disabledAt: Date | null; deletedAt: Date | null } | null) => boolean,
          modulePath: candidate.modulePath,
          exportName: name,
        }
      }
    }
  }
  return null
}

test('item 39: the decision behind item 38 is reachable without next/headers, as a plain exported predicate over an account row (spec section 8.4 item 39)', async () => {
  const found = await loadActiveAccountPredicate()
  assert.ok(
    found,
    'no exported pure predicate over an account row was found under any of the candidate names this test looked for ' +
      `(${PREDICATE_CANDIDATES.map((c) => `${c.modulePath}: ${c.exportNames.join('/')}`).join('; ')}). Spec section ` +
      '8.4 item 39 requires such a predicate to be reachable without next/headers, but section 8.3 does not name it ' +
      '-- see this run\'s report for the ambiguity.',
  )
  if (!found) return

  const active = found.fn({ disabledAt: null, deletedAt: null })
  const missing = found.fn(null)
  const disabled = found.fn({ disabledAt: new Date(), deletedAt: null })
  const deleted = found.fn({ disabledAt: null, deletedAt: new Date() })

  assert.equal(typeof active, 'boolean', `${found.exportName} must return a boolean`)
  assert.notEqual(active, missing, 'a missing account must be decided oppositely from an active one')
  assert.notEqual(active, disabled, 'a disabled account must be decided oppositely from an active one')
  assert.notEqual(active, deleted, 'a deleted account must be decided oppositely from an active one')
  assert.equal(missing, disabled, 'missing and disabled must be decided the same way (both are "not usable")')
  assert.equal(disabled, deleted, 'disabled and deleted must be decided the same way (both are "not usable")')
})
