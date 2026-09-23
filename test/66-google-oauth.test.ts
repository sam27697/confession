// test/64-google-oauth.test.ts
//
// The Google provider's contract, tested the way src/google.ts is written:
// pure functions over `fetch`, so `fetch` is the only thing stubbed and
// nothing here touches a database, a cookie or Next.js.
//
// The first test is the one that matters most and is not about code style.
// Google's openid/profile scopes are non-sensitive, which is why this app
// can be published with no OAuth verification, no 100-user cap and no
// "unverified app" screen. Adding `email` -- or anything else -- to
// GOOGLE_SCOPE silently moves the app into a class that needs Google's
// review, exactly as `email` would have re-opened Business Verification on
// the Facebook side. This test is the tripwire for that.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  GOOGLE_SCOPE,
  GOOGLE_AUTHORIZE_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchProfile,
} from '../src/google.js'

type FetchArgs = { url: string; init?: RequestInit }

function stubFetch(handler: (args: FetchArgs) => Response | Promise<Response>) {
  const original = globalThis.fetch
  const calls: FetchArgs[] = []
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const args = { url: String(input), init }
    calls.push(args)
    return handler(args)
  }) as typeof fetch
  return {
    calls,
    restore() {
      globalThis.fetch = original
    },
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

test('GOOGLE_SCOPE stays non-sensitive: openid and profile, nothing else', () => {
  const scopes = GOOGLE_SCOPE.split(' ').filter((s) => s.length > 0)
  assert.deepEqual(scopes.sort(), ['openid', 'profile'])
  // Named explicitly rather than left to the deepEqual, so the failure
  // message says what was added and why it is not free.
  assert.ok(!scopes.includes('email'), 'email is a scope this app never requests')
})

test('buildAuthorizeUrl targets Google and carries scope, state and response_type', () => {
  const url = new URL(
    buildAuthorizeUrl({
      clientId: 'client-123',
      redirectUri: 'https://masaraha.provefair.app/auth/google/callback',
      state: 'state-abc',
    }),
  )

  assert.equal(`${url.origin}${url.pathname}`, GOOGLE_AUTHORIZE_ENDPOINT)
  assert.equal(url.searchParams.get('client_id'), 'client-123')
  assert.equal(url.searchParams.get('redirect_uri'), 'https://masaraha.provefair.app/auth/google/callback')
  assert.equal(url.searchParams.get('state'), 'state-abc')
  assert.equal(url.searchParams.get('scope'), GOOGLE_SCOPE)
  assert.equal(url.searchParams.get('response_type'), 'code')
  // online, so Google never issues a refresh token: there is nowhere in
  // this app to store one and nothing that would use it.
  assert.equal(url.searchParams.get('access_type'), 'online')
  assert.equal(url.searchParams.get('prompt'), 'select_account')
})

test('exchangeCodeForToken POSTs a form and never puts the secret in the URL', async () => {
  const stub = stubFetch(() => json({ access_token: 'tok-1' }))
  try {
    const result = await exchangeCodeForToken({
      clientId: 'client-123',
      clientSecret: 'secret-xyz',
      redirectUri: 'https://masaraha.provefair.app/auth/google/callback',
      code: 'code-1',
    })
    assert.deepEqual(result, { accessToken: 'tok-1' })

    assert.equal(stub.calls.length, 1)
    const [call] = stub.calls
    assert.equal(call.url, GOOGLE_TOKEN_ENDPOINT)
    assert.equal(call.init?.method, 'POST')
    // A query string ends up in server logs and proxy logs; a body does not.
    assert.ok(!call.url.includes('secret-xyz'), 'the client secret must not travel in the URL')

    const body = new URLSearchParams(String(call.init?.body))
    assert.equal(body.get('client_secret'), 'secret-xyz')
    assert.equal(body.get('grant_type'), 'authorization_code')
    assert.equal(body.get('code'), 'code-1')
  } finally {
    stub.restore()
  }
})

test('exchangeCodeForToken reports status only, never the response body', async () => {
  const stub = stubFetch(() => json({ error: 'invalid_grant', request_id: 'req-secret' }, 400))
  try {
    await assert.rejects(
      () =>
        exchangeCodeForToken({
          clientId: 'c',
          clientSecret: 's',
          redirectUri: 'https://masaraha.provefair.app/auth/google/callback',
          code: 'bad',
        }),
      (err: Error) => {
        assert.match(err.message, /status 400/)
        assert.ok(!err.message.includes('req-secret'), 'the response body must not reach the message')
        return true
      },
    )
  } finally {
    stub.restore()
  }
})

test('exchangeCodeForToken rejects a 200 with no access_token', async () => {
  const stub = stubFetch(() => json({}))
  try {
    await assert.rejects(() =>
      exchangeCodeForToken({
        clientId: 'c',
        clientSecret: 's',
        redirectUri: 'https://masaraha.provefair.app/auth/google/callback',
        code: 'c',
      }),
    )
  } finally {
    stub.restore()
  }
})

test('fetchProfile reads sub and name from userinfo and sends a bearer token', async () => {
  const stub = stubFetch(() => json({ sub: '1029384756', name: 'سام', email: 'nobody@example.com' }))
  try {
    const profile = await fetchProfile({ accessToken: 'tok-1' })
    // sub becomes provider_user_id; email is present in the payload and is
    // deliberately dropped on the floor.
    assert.deepEqual(profile, { id: '1029384756', name: 'سام' })

    const [call] = stub.calls
    assert.equal(call.url, GOOGLE_USERINFO_ENDPOINT)
    assert.equal((call.init?.headers as Record<string, string>).authorization, 'Bearer tok-1')
  } finally {
    stub.restore()
  }
})

test('fetchProfile refuses a profile with no sub or no usable name', async () => {
  for (const body of [{ name: 'Sam' }, { sub: '1' }, { sub: '1', name: '   ' }]) {
    const stub = stubFetch(() => json(body))
    try {
      await assert.rejects(
        () => fetchProfile({ accessToken: 'tok-1' }),
        `expected a rejection for ${JSON.stringify(body)}`,
      )
    } finally {
      stub.restore()
    }
  }
})
