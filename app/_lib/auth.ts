// Session lookup for Server Components and Server Actions. Every mutation
// re-derives the viewer's account id from this cookie, server-side, never
// from a form field (spec §5.3).
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Db } from './domain/db.js'
import { getAccountById, isAccountActive } from './domain/accounts.js'
import { SID_COOKIE, verifySessionCookieValue } from './session.js'

export async function getViewerAccountId(): Promise<string | null> {
  const store = await cookies()
  const raw = store.get(SID_COOKIE)?.value
  if (!raw) return null
  const session = verifySessionCookieValue(raw)
  return session ? session.accountId : null
}

// For pages/actions that require a signed-in viewer. Sends an anonymous
// visitor home rather than rendering an error — there is nothing owed to a
// direct hit on a protected URL beyond "go sign in".
//
// Kept, unchanged, and left with no callers (docs/SPEC-week10-account-
// deletion.md §4.3): it trusts the signed cookie for its full seven days and
// never touches the database, so a disabled or deleted account's live
// cookie would keep working through it. requireActiveViewerAccountId below
// is the new decision every authenticated surface uses instead — a second,
// separate function, not a rewrite of this one out from under the nine
// surfaces that already depended on its exact behaviour.
export async function requireViewerAccountId(): Promise<string> {
  const accountId = await getViewerAccountId()
  if (!accountId) {
    redirect('/')
  }
  return accountId
}

// The session-plus-database decision every authenticated surface uses (spec
// §4.3): redirects home when there is no session, when the account no
// longer exists, when disabled_at is set (terms clause 4), or when
// deleted_at is set (terms clause 6, week 10) — a deleted or disabled
// account's cookie stops working on the very next request instead of
// waiting out its seven days, the same repair week 9 made for
// administrators (app/admin/_lib/auth.ts).
//
// The actual account/disabled/deleted decision is the pure isAccountActive
// predicate in src/accounts.ts, so it is testable with a plain object and no
// next/headers in the require chain.
export async function requireActiveViewerAccountId(db: Db): Promise<string> {
  const accountId = await getViewerAccountId()
  if (!accountId) {
    redirect('/')
  }

  const account = await getAccountById(db, { accountId })
  if (!isAccountActive(account)) {
    redirect('/')
  }

  return accountId
}
