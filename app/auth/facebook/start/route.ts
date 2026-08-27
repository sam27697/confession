import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { env } from '../../../_lib/domain/env.js'
import { FACEBOOK_SCOPE } from '../../../_lib/domain/facebook.js'
import { FB_OAUTH_STATE_COOKIE, fbOauthStateCookieOptions } from '../../../_lib/session.js'

const GRAPH_VERSION = 'v21.0' // spec §3.1

export async function GET() {
  if (!env.FACEBOOK_APP_ID) {
    return new Response('facebook login not configured', { status: 503 })
  }

  const state = randomBytes(32).toString('base64url')
  const store = await cookies()
  store.set(FB_OAUTH_STATE_COOKIE, state, fbOauthStateCookieOptions)

  const redirectUri = `${env.APP_ORIGIN}/auth/facebook/callback`
  const authorizeUrl = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`)
  authorizeUrl.searchParams.set('client_id', env.FACEBOOK_APP_ID)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('scope', FACEBOOK_SCOPE)
  authorizeUrl.searchParams.set('response_type', 'code')

  return Response.redirect(authorizeUrl.toString(), 302)
}
