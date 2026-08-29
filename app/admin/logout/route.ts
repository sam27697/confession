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
import { NextResponse } from 'next/server'
import { env } from '../../_lib/domain/env.js'
import { ADMIN_SID_COOKIE, adminSidCookieOptions } from '../_lib/session.js'

export async function POST() {
  if (!env.adminEnabled) {
    return new Response('not found', { status: 404 })
  }

  const response = NextResponse.redirect(new URL('/admin/login', env.appOrigin), 303)
  response.cookies.set(ADMIN_SID_COOKIE, '', { ...adminSidCookieOptions(), maxAge: 0 })
  return response
}
