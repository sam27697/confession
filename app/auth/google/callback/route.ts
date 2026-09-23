import { cookies } from 'next/headers'
import { env } from '../../../_lib/domain/env.js'
import { exchangeCodeForToken, fetchProfile } from '../../../../src/google.js'
import { AFTER_LOGIN_COOKIE, GOOGLE_OAUTH_STATE_COOKIE } from '../../../_lib/session.js'
import { resolveLoginAndRedirect } from '../../../_lib/login-flow.js'

export async function GET(request: Request) {
  if (!env.googleClientId || !env.googleClientSecret) {
    return new Response('google login not configured', { status: 503 })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const store = await cookies()
  const expectedState = store.get(GOOGLE_OAUTH_STATE_COOKIE)?.value
  store.delete(GOOGLE_OAUTH_STATE_COOKIE)

  if (!code || !state || !expectedState || state !== expectedState) {
    return new Response('bad request', { status: 400 })
  }

  const redirectUri = `${env.appOrigin}/auth/google/callback`

  let profile: { id: string; name: string }
  try {
    // The token is used for exactly one call and then goes out of scope: it
    // is never stored, never put in a cookie, never logged.
    const { accessToken } = await exchangeCodeForToken({
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
      redirectUri,
      code,
    })
    profile = await fetchProfile({ accessToken })
  } catch (err) {
    // Error name only. The message can carry a status and the response body
    // can carry request-identifying detail (spec §1 rule 3).
    console.error('google login failed', err instanceof Error ? err.name : 'unknown')
    return new Response('login failed', { status: 400 })
  }

  // Set by /auth/google/start from its ?next= (week 15 §2.3).
  // resolveLoginAndRedirect sanitises it again and, if the visitor still
  // has terms to accept, carries it on through /onboarding.
  const remembered = store.get(AFTER_LOGIN_COOKIE)?.value ?? null
  store.delete(AFTER_LOGIN_COOKIE)

  await resolveLoginAndRedirect(
    { provider: 'google', providerUserId: profile.id, displayName: profile.name },
    remembered,
  )
  return new Response(null, { status: 302 })
}
