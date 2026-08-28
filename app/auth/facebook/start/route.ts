import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { env } from '../../../_lib/domain/env.js'
import { buildAuthorizeUrl } from '../../../../src/facebook.js'
import { FB_OAUTH_STATE_COOKIE, fbOauthStateCookieOptions } from '../../../_lib/session.js'

export async function GET() {
  if (!env.facebookAppId) {
    return new Response('facebook login not configured', { status: 503 })
  }

  const state = randomBytes(32).toString('base64url')
  const store = await cookies()
  store.set(FB_OAUTH_STATE_COOKIE, state, fbOauthStateCookieOptions)

  // The URL, the scope and the pinned Graph version all come from
  // src/facebook.ts (spec §3.1) — this route owns the state cookie and the
  // redirect, and nothing about the OAuth shape itself.
  const authorizeUrl = buildAuthorizeUrl({
    appId: env.facebookAppId,
    redirectUri: `${env.appOrigin}/auth/facebook/callback`,
    state,
  })

  return Response.redirect(authorizeUrl, 302)
}
