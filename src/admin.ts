// src/admin.ts
//
// The database half of admin authentication (spec §2.3) and the reports
// reader (spec §3.4). Query functions over Db only -- no cookies, no
// next/headers here, the same split as src/session.ts versus
// app/_lib/session.ts.

import { desc, eq } from 'drizzle-orm'
import type { Db } from './db.js'
import { adminUsers, confessions, reports } from './schema.js'
import { hashAdminPassword, verifyAdminPassword } from './admin-auth.js'

export type AdminUser = {
  id: string
  username: string
  disabledAt: Date | null
  // Week 9 spec §1.4 item 4: null means this operator has never logged out.
  loggedOutBefore: Date | null
}

export async function findAdminUserByUsername(
  db: Db,
  { username }: { username: string },
): Promise<
  | { id: string; username: string; passwordHash: string; disabledAt: Date | null; loggedOutBefore: Date | null }
  | null
> {
  const [row] = await db
    .select({
      id: adminUsers.id,
      username: adminUsers.username,
      passwordHash: adminUsers.passwordHash,
      disabledAt: adminUsers.disabledAt,
      loggedOutBefore: adminUsers.loggedOutBefore,
    })
    .from(adminUsers)
    .where(eq(adminUsers.username, username))
    .limit(1)

  return row ?? null
}

export async function getAdminUserById(
  db: Db,
  { adminUserId }: { adminUserId: string },
): Promise<AdminUser | null> {
  // loggedOutBefore is one more field on a select that is already being
  // issued on every protected admin request -- the repair costs zero
  // additional round trips (week 9 spec §1.1).
  const [row] = await db
    .select({
      id: adminUsers.id,
      username: adminUsers.username,
      disabledAt: adminUsers.disabledAt,
      loggedOutBefore: adminUsers.loggedOutBefore,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, adminUserId))
    .limit(1)

  // A disabled row comes back as null here rather than as itself, so that a
  // cookie already issued to a now-disabled administrator stops working on
  // the very next request instead of waiting out its eight hours (spec
  // §2.3).
  if (!row || row.disabledAt !== null) return null
  return row
}

// Sets logged_out_before to the given instant for one administrator (week 9
// spec §1.4 item 4). Takes `at` as an argument rather than calling
// `new Date()` itself, so the caller's clock -- the application clock, not
// Postgres's -- is the one and only clock in play (spec §1.2), and so a
// test can pin the instant.
export async function revokeAdminSessions(
  db: Db,
  { adminUserId, at }: { adminUserId: string; at: Date },
): Promise<void> {
  await db.update(adminUsers).set({ loggedOutBefore: at }).where(eq(adminUsers.id, adminUserId))
}

// Computed once, at module load, at the same cost as a real stored hash and
// never compared against a real password -- used only so that "no such
// username" and "wrong password" take the same wall-clock time in
// authenticateAdmin below (spec §2.3).
const DUMMY_PASSWORD_HASH = hashAdminPassword('admin-throttle-constant-time-padding-only')

// Returns null -- with no distinction whatsoever between the cases -- for
// an unknown username, a wrong password, or a disabled row (spec §2.3). The
// hash comparison always runs, against the real stored hash when the
// username exists and against the fixed dummy hash otherwise, so the
// branch below carries no timing signal about which case this is.
export async function authenticateAdmin(
  db: Db,
  { username, password }: { username: string; password: string },
): Promise<AdminUser | null> {
  const row = await findAdminUserByUsername(db, { username })
  const passwordOk = verifyAdminPassword(password, row ? row.passwordHash : DUMMY_PASSWORD_HASH)

  if (!row || !passwordOk || row.disabledAt !== null) return null

  return { id: row.id, username: row.username, disabledAt: row.disabledAt, loggedOutBefore: row.loggedOutBefore }
}

// ---------------------------------------------------------------------------
// Reports reader (spec §3.4) -- the read half of the report button.
// ---------------------------------------------------------------------------

export type AdminReportRow = {
  reportId: string
  confessionId: string
  body: string
  createdHour: Date
  status: 'delivered' | 'hidden_by_recipient' | 'reported'
  reason: string
  createdAt: Date
  senderMasked: true
}

export async function getAdminReports(db: Db, { limit }: { limit: number }): Promise<AdminReportRow[]> {
  // Neither side is identified (spec §3.4, §4.1): reports.reported_by_account_id
  // is never in the select list below, and confessions.sender_account_id is
  // not joined at all -- there is nothing selected here that could leak it.
  const rows = await db
    .select({
      reportId: reports.id,
      confessionId: reports.confessionId,
      body: confessions.body,
      createdHour: confessions.createdHour,
      status: confessions.status,
      reason: reports.reason,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .innerJoin(confessions, eq(confessions.id, reports.confessionId))
    .orderBy(desc(reports.createdAt))
    .limit(limit)

  return rows.map((r) => ({ ...r, senderMasked: true as const }))
}
