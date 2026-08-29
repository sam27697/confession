// Cookie wrapper for `admin_sid`, the admin-only counterpart to
// app/_lib/session.ts's `sid` cookie. The signing key is derived inside
// src/admin-auth.ts (adminSessionKey), not configured here, so a valid
// `sid` cannot be replayed as `admin_sid` and vice versa (spec §2.1, §4.6).
// The wire format and the HMAC itself live in src/session.ts and
// src/admin-auth.ts; this file is only the cookie-shaped wrapper: the name,
// the attributes and the payload type.

import { ADMIN_SESSION_MAX_AGE_MS, signAdminSession, verifyAdminSession } from '../../../src/admin-auth.js'
import { env } from '../../_lib/domain/env.js'

export const ADMIN_SID_COOKIE = 'admin_sid'

export function createAdminSessionCookieValue(adminUserId: string): string {
  return signAdminSession(env.sessionSecret, { adminUserId })
}

export function verifyAdminSessionCookieValue(value: string): { adminUserId: string } | null {
  return verifyAdminSession(env.sessionSecret, value)
}

// Path=/admin (spec §3.1): the admin cookie is never attached to a request
// for a public page, `/c/<slug>` included. Secure only when the deployed
// origin is https, computed at call time rather than baked into a
// module-level constant, so this reflects the real running configuration
// and not whatever placeholder was present when the module first loaded.
export function adminSidCookieOptions(): {
  httpOnly: true
  sameSite: 'lax'
  path: '/admin'
  maxAge: number
  secure: boolean
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/admin',
    maxAge: ADMIN_SESSION_MAX_AGE_MS / 1000,
    secure: env.appOrigin.startsWith('https://'),
  }
}
