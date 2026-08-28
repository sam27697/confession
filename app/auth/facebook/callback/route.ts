import { cookies } from 'next/headers'
import { env } from '../../../_lib/domain/env.js'
import { exchangeCodeForToken, fetchProfile } from '../../../../src/facebook.js'
import { FB_OAUTH_STATE_COOKIE } from '../../../_lib/session.js'
import { resolveLoginAndRedirect } from '../../../_lib/login-flow.js'

export async function GET(request: Request) {
  if (!env.facebookAppId || !env.facebookAppSecret) {
    return new Response('facebook login not configured', { status: 503 })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const store = await cookies()
  const expectedState = store.get(FB_OAUTH_STATE_COOKIE)?.value
  store.delete(FB_OAUTH_STATE_COOKIE)

  if (!code || !state || !expectedState || state !== expectedState) {
    return new Response('bad request', { status: 400 })
  }

  const redirectUri = `${env.appOrigin}/auth/facebook/callback`

  let profile: { id: string; name: string }
  try {
    // The token is used for exactly one call and then goes out of scope: it
    // is never stored, never put in a cookie, never logged (spec §3.1).
    const { accessToken } = await exchangeCodeForToken({
      appId: env.facebookAppId,
      appSecret: env.facebookAppSecret,
      redirectUri,
      code,
    })
    profile = await fetchProfile({ accessToken })
  } catch (err) {
    // Error name only. The message can carry a status and the response body
    // can carry request-identifying detail (spec §1 rule 3).
    console.error('facebook login failed', err instanceof Error ? err.name : 'unknown')
    return new Response('login failed', { status: 400 })
  }

  await resolveLoginAndRedirect({ provider: 'facebook', providerUserId: profile.id, displayName: profile.name })
  return new Response(null, { status: 302 })
}
