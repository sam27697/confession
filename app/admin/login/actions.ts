'use server'
// POST /admin/login (spec §3.1), a Server Action so it follows the same
// convention as every other mutation in this app (see app/inbox/actions.ts).
// The password never appears anywhere after this function returns: on
// failure the redirect below carries only a fixed error code in the query
// string, never the submitted value.

import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getDb } from '../../_lib/domain/db.js'
import { env } from '../../_lib/domain/env.js'
import { authenticateAdmin } from '../../../src/admin.js'
import { clearFailures, isLockedOut, recordFailure } from '../../../src/admin-throttle.js'
import { adminThrottleState } from '../_lib/throttle.js'
import { ADMIN_SID_COOKIE, adminSidCookieOptions, createAdminSessionCookieValue } from '../_lib/session.js'

export async function adminLoginAction(formData: FormData) {
  if (!env.adminEnabled) {
    notFound()
  }

  const username = String(formData.get('username') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  // Locked out re-renders with the same generic message as any other
  // failure, without even attempting the password check (spec §3.1, §2.6).
  if (isLockedOut(adminThrottleState, username)) {
    redirect('/admin/login?error=invalid')
  }

  const db = getDb()
  const admin = await authenticateAdmin(db, { username, password })

  if (!admin) {
    recordFailure(adminThrottleState, username)
    redirect('/admin/login?error=invalid')
  }

  clearFailures(adminThrottleState, username)

  const store = await cookies()
  store.set(ADMIN_SID_COOKIE, createAdminSessionCookieValue(admin.id), adminSidCookieOptions())

  redirect('/admin')
}
