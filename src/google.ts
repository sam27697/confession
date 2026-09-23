// src/google.ts
//
// Google OAuth 2.0 / OpenID Connect (the second auth provider). Same shape
// and the same rules as src/facebook.ts: pure functions built around global
// `fetch`, no cookie, no session, no Next.js request/response object touched
// here. The route handlers that own `google_oauth_state` and the redirect
// responses are the only callers.

// The scope string appears in exactly this one constant, and both of its
// values are NON-SENSITIVE in Google's classification. That is the entire
// reason this provider exists: non-sensitive scopes need no OAuth
// verification, have no 100-user cap and show no "unverified app" screen,
// so publishing is the operator's decision rather than a reviewer's.
//
// `email` is deliberately absent, for the same reason it is absent from
// FACEBOOK_SCOPE: accounts are keyed on the stable `sub` claim and the
// product displays a name. An address the app never uses is an address it
// should never hold. Adding a scope here changes the app's publishing
// status -- it is a decision, not a detail.
export const GOOGLE_SCOPE = 'openid profile'

// Pinned in one place each, for the same reason GRAPH_API_VERSION is: an
// endpoint move becomes a one-line change and not a silent behaviour shift
// under a running deploy.
export const GOOGLE_AUTHORIZE_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
export const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'

export function buildAuthorizeUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const url = new URL(GOOGLE_AUTHORIZE_ENDPOINT)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', GOOGLE_SCOPE)
  url.searchParams.set('response_type', 'code')
  // online, not offline: a refresh token is a durable credential for an
  // account this app reads exactly once, at login. Asking for one would be
  // asking for something to store, and there is nowhere to store it.
  url.searchParams.set('access_type', 'online')
  // Someone signing in to a confession app from a shared or family device
  // must be able to choose which account, rather than be silently carried
  // into whichever one the browser is already holding.
  url.searchParams.set('prompt', 'select_account')
  return url.toString()
}

export type GoogleTokenResult = { accessToken: string }

// The access token this returns is used for exactly one call -- fetchProfile
// below -- and then discarded by the caller. It is never stored, never put
// in a cookie, never logged.
export async function exchangeCodeForToken({
  clientId,
  clientSecret,
  redirectUri,
  code,
}: {
  clientId: string
  clientSecret: string
  redirectUri: string
  code: string
}): Promise<GoogleTokenResult> {
  // Google's token endpoint is POST-with-a-form, unlike Meta's GET. The
  // secret therefore travels in a request body rather than a query string,
  // which is the reason not to "simplify" this into a URL.
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
  })

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    // Status only -- the response body can carry request-identifying detail
    // and this error may end up in a log (spec §1 rule 3).
    throw new Error(`google token exchange failed with status ${res.status}`)
  }

  const parsed = (await res.json()) as { access_token?: unknown }
  if (typeof parsed.access_token !== 'string' || parsed.access_token.length === 0) {
    throw new Error('google token exchange response had no access_token')
  }

  return { accessToken: parsed.access_token }
}

export type GoogleProfile = { id: string; name: string }

// The userinfo endpoint rather than the id_token: the token came straight
// from Google over TLS in a server-to-server call we initiated, so there is
// nothing a local JWT signature check would add here except a JWKS fetch, a
// key cache and three more ways to be wrong. What comes back is `sub` and
// `name` and nothing else is read from it.
export async function fetchProfile({ accessToken }: { accessToken: string }): Promise<GoogleProfile> {
  const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error(`google profile fetch failed with status ${res.status}`)
  }

  const body = (await res.json()) as { sub?: unknown; name?: unknown }

  // `sub` is the account key. It is stable for this client for the lifetime
  // of the Google account, which is what accounts.provider_user_id needs.
  if (typeof body.sub !== 'string' || body.sub.length === 0) {
    throw new Error('google profile response had no sub')
  }

  // displayName is NOT NULL on accounts, so a profile with no usable name
  // is a failed login rather than an account called "".
  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    throw new Error('google profile response had no name')
  }

  return { id: body.sub, name: body.name }
}
