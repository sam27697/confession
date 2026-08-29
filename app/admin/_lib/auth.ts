// Admin session lookup for the pages and route handlers under app/admin/**.
// Every protected admin route re-derives the admin user id from the
// `admin_sid` cookie and re-checks it against the database (spec §2.3): a
// disabled administrator's cookie stops working on the very next request
// instead of waiting out its eight hours, because getAdminUserById returns
// null for a disabled row. The only cookie this file, or anything else
// under app/admin/**, ever reads is admin_sid itself (spec §4.4).

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Db } from '../../../src/db.js'
import { getAdminUserById } from '../../../src/admin.js'
import { isAdminSessionRevoked } from '../../../src/admin-auth.js'
import { ADMIN_SID_COOKIE, verifyAdminSessionCookieValue } from './session.js'

// Requires a valid, non-disabled, non-revoked admin session; otherwise 307
// to /admin/login (spec §3.2, §3.3; week 9 spec §1.4 item 5). A revoked
// session and a forged one are indistinguishable to the client: both take
// the identical redirect (week 9 spec §1.4 item 5). Callers reach this only
// once env.adminEnabled has already been checked (spec §3.0's kill switch),
// so this function itself does not repeat that check.
export async function requireAdminUserId(db: Db): Promise<string> {
  const store = await cookies()
  const raw = store.get(ADMIN_SID_COOKIE)?.value
  const session = raw ? verifyAdminSessionCookieValue(raw) : null
  if (!session) {
    redirect('/admin/login')
  }

  const adminUser = await getAdminUserById(db, { adminUserId: session.adminUserId })
  if (!adminUser) {
    redirect('/admin/login')
  }

  if (isAdminSessionRevoked(session.issuedAtMs, adminUser.loggedOutBefore)) {
    redirect('/admin/login')
  }

  return adminUser.id
}
