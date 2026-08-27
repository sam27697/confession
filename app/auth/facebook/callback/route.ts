import { cookies } from 'next/headers'
import { env } from '../../../_lib/domain/env.js'
import { GRAPH_API_VERSION } from '../../../_lib/domain/facebook.js'
import { FB_OAUTH_STATE_COOKIE } from '../../../_lib/session.js'
import { resolveLoginAndRedirect } from '../../../_lib/login-flow.js'

export async function GET(request: Request) {
  if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) {
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

  const redirectUri = `${env.APP_ORIGIN}/auth/facebook/callback`

  let accessToken: string
  try {
    const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`)
    tokenUrl.searchParams.set('client_id', env.FACEBOOK_APP_ID)
    tokenUrl.searchParams.set('client_secret', env.FACEBOOK_APP_SECRET)
    tokenUrl.searchParams.set('redirect_uri', redirectUri)
    tokenUrl.searchParams.set('code', code)
    const tokenRes = await fetch(tokenUrl.toString())
    if (!tokenRes.ok) throw new Error('token exchange failed')
    const tokenJson = (await tokenRes.json()) as { access_token?: string }
    if (!tokenJson.access_token) throw new Error('no access token')
    accessToken = tokenJson.access_token
  } catch (err) {
    console.error('facebook token exchange failed', err instanceof Error ? err.name : 'unknown')
    return new Response('login failed', { status: 400 })
  }

  let profile: { id: string; name: string }
  try {
    const profileUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/me`)
    profileUrl.searchParams.set('fields', 'id,name')
    profileUrl.searchParams.set('access_token', accessToken)
    const profileRes = await fetch(profileUrl.toString())
    if (!profileRes.ok) throw new Error('profile fetch failed')
    const profileJson = (await profileRes.json()) as { id?: string; name?: string }
    if (!profileJson.id || !profileJson.name) throw new Error('incomplete profile')
    profile = { id: profileJson.id, name: profileJson.name }
  } catch (err) {
    console.error('facebook profile fetch failed', err instanceof Error ? err.name : 'unknown')
    return new Response('login failed', { status: 400 })
  }
  // accessToken is used for the one profile call above and discarded here —
  // never stored, never put in a cookie, never logged (spec §3.1).

  await resolveLoginAndRedirect({ provider: 'facebook', providerUserId: profile.id, displayName: profile.name })
  return new Response(null, { status: 302 })
}
