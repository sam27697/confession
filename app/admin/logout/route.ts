// POST /admin/logout (spec §3.5). Clears admin_sid with the same attributes
// it was set with and Max-Age=0, then a 303 to /admin/login. A plain
// redirect() from next/navigation defaults to 307 outside a Server Action,
// so the response is built by hand here to get the status the spec asks
// for, with the cookie clear attached to that same response.
//
// The redirect target is built from the configured origin, not from the
// incoming request. Inside the container the request's own URL reflects
// the process bind address, which is not a hostname a browser can follow
// (spec §9.0 defect 2).
//
// Week 9 spec §1.4 item 6: before clearing the cookie, a presented and
// still-cryptographically-valid admin_sid revokes every outstanding token
// for that operator (spec §1.5), not just the one presented. An absent,
// malformed or already-revoked cookie still gets the identical 303 and the
// identical cookie clear -- logout tells the caller nothing about whether
// it was carrying a real session. A database failure during the revoke must
// not turn logout into a 500 that leaves the cookie in place, so it is
// caught and logged as its class only, matching app/healthz/route.ts.
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getDb } from '../../_lib/domain/db.js'
import { env } from '../../_lib/domain/env.js'
import { revokeAdminSessions } from '../../../src/admin.js'
import { ADMIN_SID_COOKIE, adminSidCookieOptions, verifyAdminSessionCookieValue } from '../_lib/session.js'
import { adminMethodNotAllowed } from '../_lib/method-guard.js'

// Week 9 spec §2.1: the other five methods all delegate to the shared
// guard so a hidden route no longer names the method it accepts. HEAD is
// not exported -- Next derives it from GET, and GET here already answers
// 404/405 with no body.
export const GET = adminMethodNotAllowed
export const PUT = adminMethodNotAllowed
export const PATCH = adminMethodNotAllowed
export const DELETE = adminMethodNotAllowed
export const OPTIONS = adminMethodNotAllowed

export async function POST() {
  if (!env.adminEnabled) {
    return new Response('not found', { status: 404 })
  }

  const store = await cookies()
  const raw = store.get(ADMIN_SID_COOKIE)?.value
  const session = raw ? verifyAdminSessionCookieValue(raw) : null

  if (session) {
    try {
      await revokeAdminSessions(getDb(), { adminUserId: session.adminUserId, at: new Date() })
    } catch (err) {
      // error class only -- never the message, matching app/healthz/route.ts
      // (spec §1 rule 3; week 9 spec §1.4 item 6). The cookie is still
      // cleared and the 303 is still returned below.
      console.error('admin logout revoke failed', err instanceof Error ? err.name : 'unknown')
    }
  }

  const response = NextResponse.redirect(new URL('/admin/login', env.appOrigin), 303)
  response.cookies.set(ADMIN_SID_COOKIE, '', { ...adminSidCookieOptions(), maxAge: 0 })
  return response
}
