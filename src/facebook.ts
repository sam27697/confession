// src/facebook.ts
//
// Facebook OAuth (spec §3.1). Pure functions built around global `fetch` —
// no cookie, no session, no Next.js request/response object touched here.
// The route handlers that own `fb_oauth_state` and the redirect responses
// are the only callers, and they are outside this slice's scope.

// Graph API version, pinned in one constant rather than scattered through
// URLs, so a Meta version bump is a one-line change and not a silent
// behaviour shift under a running deploy (spec §3.1).
const GRAPH_VERSION = 'v21.0'

// public_profile is the only scope this app ever requests, and it appears
// in exactly this one constant. BRIEF.md's measured finding: public_profile
// needs no App Review; anything else — email included — re-opens Business
// Verification and a document from Sam personally (spec §3.1). Do not add a
// second scope to this string.
export const FACEBOOK_SCOPE = 'public_profile'

export function buildAuthorizeUrl({
  appId,
  redirectUri,
  state,
}: {
  appId: string
  redirectUri: string
  state: string
}): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', FACEBOOK_SCOPE)
  url.searchParams.set('response_type', 'code')
  return url.toString()
}

export type FacebookTokenResult = { accessToken: string }

// The access token this returns is used for exactly one call — fetchProfile
// below — and then discarded by the caller. It is never stored, never put
// in a cookie, never logged (spec §3.1).
export async function exchangeCodeForToken({
  appId,
  appSecret,
  redirectUri,
  code,
}: {
  appId: string
  appSecret: string
  redirectUri: string
  code: string
}): Promise<FacebookTokenResult> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('code', code)

  const res = await fetch(url.toString())
  if (!res.ok) {
    // Status only — the response body can carry request-identifying detail
    // and this error may end up in a log (spec §1 rule 3).
    throw new Error(`facebook token exchange failed with status ${res.status}`)
  }

  const body = (await res.json()) as { access_token?: unknown }
  if (typeof body.access_token !== 'string' || body.access_token.length === 0) {
    throw new Error('facebook token exchange response had no access_token')
  }

  return { accessToken: body.access_token }
}

export type FacebookProfile = { id: string; name: string }

// fields is "id,name" and nothing else (spec §3.1) — no email, no picture,
// no friend list.
export async function fetchProfile({ accessToken }: { accessToken: string }): Promise<FacebookProfile> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me`)
  url.searchParams.set('fields', 'id,name')
  url.searchParams.set('access_token', accessToken)

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`facebook profile fetch failed with status ${res.status}`)
  }

  const body = (await res.json()) as { id?: unknown; name?: unknown }
  if (typeof body.id !== 'string' || typeof body.name !== 'string') {
    throw new Error('facebook profile response missing id or name')
  }

  return { id: body.id, name: body.name }
}
