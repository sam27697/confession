import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { env } from '../../../_lib/domain/env.js'
import { buildAuthorizeUrl } from '../../../../src/google.js'
import { GOOGLE_OAUTH_STATE_COOKIE, oauthStateCookieOptions } from '../../../_lib/session.js'
import { rememberDestination } from '../../../_lib/login-flow.js'

export async function GET(request: Request) {
  if (!env.googleClientId) {
    return new Response('google login not configured', { status: 503 })
  }

  const state = randomBytes(32).toString('base64url')
  const store = await cookies()
  store.set(GOOGLE_OAUTH_STATE_COOKIE, state, oauthStateCookieOptions)
  // Google, like Facebook, sends the visitor back to a fixed callback URL,
  // so where they were going waits in a cookie for the round trip (week 15
  // §2.3). Without this, the only public login would silently undo that
  // work: open a friend's link, sign in, land in your own empty inbox.
  rememberDestination(store, new URL(request.url).searchParams.get('next'))

  // The URL, the scope and the endpoints all come from src/google.ts -- this
  // route owns the state cookie and the redirect, and nothing about the
  // OAuth shape itself. Its own cookie name, not Facebook's: a user who
  // starts both flows in two tabs must not have one overwrite the other's
  // state and turn a normal login into a 400.
  const authorizeUrl = buildAuthorizeUrl({
    clientId: env.googleClientId,
    redirectUri: `${env.appOrigin}/auth/google/callback`,
    state,
  })

  return Response.redirect(authorizeUrl, 302)
}
