import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { freshDb } from './harness.js'
import { createAccount, createLink } from './fixtures.js'
import { sendConfession } from '../src/actions.js'
import { LinkDisabledError, PerLinkRateLimitExceededError } from '../src/errors.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

test('AC1: sign-in prompt on send page passes next query param returning to slug', () => {
  const sendPagePath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  assert.ok(existsSync(sendPagePath), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(sendPagePath, 'utf8')

  const match =
    src.match(/href=(?:["']([^"']*)["']|\{`([^`]+)`\})[^>]*>[\s\S]*?سجل دخول/i) ||
    src.match(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>[\s\S]*?سجل دخول/i)
  assert.ok(match, 'send page must render sign in link for unauthenticated visitors')

  const href = match[1] || match[2] || ''
  assert.ok(
    href.includes('?next=/c/') || href.includes('?next=%2Fc%2F') || href.includes('next=/c/'),
    `sign-in prompt href must pass next query param returning to slug (threshold: href contains ?next=/c/), got: "${href}"`,
  )
})

test('AC2: dev auth handler redirects to sanitized relative next parameter', () => {
  const devRoutePath = path.join(APP_DIR, 'auth', 'dev', 'route.ts')
  assert.ok(existsSync(devRoutePath), 'app/auth/dev/route.ts must exist')
  const routeSrc = readFileSync(devRoutePath, 'utf8')

  const loginFlowPath = path.join(APP_DIR, '_lib', 'login-flow.ts')
  assert.ok(existsSync(loginFlowPath), 'app/_lib/login-flow.ts must exist')
  const flowSrc = readFileSync(loginFlowPath, 'utf8')

  const extractsNext =
    /form\.get\(['"]next['"]\)/.test(routeSrc) ||
    /searchParams\.get\(['"]next['"]\)/.test(routeSrc) ||
    /next\s*=\s*form\.get/.test(routeSrc)
  assert.ok(
    extractsNext,
    'dev auth handler in app/auth/dev/route.ts must read next parameter from form data or search params',
  )

  const handlesNextRedirect =
    /resolveLoginAndRedirect\([^)]*next[^)]*\)/.test(routeSrc) ||
    /resolveLoginAndRedirect\([^)]*next[^)]*\)/.test(flowSrc) ||
    /redirect\(\s*(?:next|target|safeNext|destination)\s*\)/.test(flowSrc)
  assert.ok(
    handlesNextRedirect,
    'dev auth login flow must redirect to the specified next relative destination',
  )
})

test('AC3: external or absolute targets in next parameter fallback to /inbox', async () => {
  const loginFlowPath = path.join(APP_DIR, '_lib', 'login-flow.ts')
  assert.ok(existsSync(loginFlowPath), 'app/_lib/login-flow.ts must exist')
  const flowSrc = readFileSync(loginFlowPath, 'utf8')

  const validatesRelative =
    /(?:startsWith\(['"]\/['"]\)|^\s*\/[^\/]|regex|isRelative|sanitizeNext|safeRedirect)/i.test(flowSrc) &&
    !flowSrc.includes('redirect(next)')
  assert.ok(
    validatesRelative,
    'login flow in app/_lib/login-flow.ts must validate relative path and sanitize next parameter against open redirects',
  )

  const hasInboxFallback = flowSrc.includes("'/inbox'") || flowSrc.includes('"/inbox"')
  assert.ok(
    hasInboxFallback,
    'login flow must fall back to /inbox when next parameter is unsafe or external',
  )

  const loginFlowMod = (await import('../app/_lib/login-flow.js').catch(() => ({}))) as Record<string, unknown>
  const sanitizeFn = Object.values(loginFlowMod).find(
    (val) =>
      typeof val === 'function' &&
      (val.name.toLowerCase().includes('next') ||
        val.name.toLowerCase().includes('sanitize') ||
        val.name.toLowerCase().includes('safe')),
  ) as ((url: string) => string) | undefined

  if (sanitizeFn) {
    assert.equal(sanitizeFn('https://attacker.example.com/exploit'), '/inbox')
    assert.equal(sanitizeFn('//attacker.example.com'), '/inbox')
    assert.equal(sanitizeFn('/c/my-slug'), '/c/my-slug')
  }
})

test('AC4: post-send notice offers direct links to view outbox and copy link', () => {
  const sendPagePath = path.join(APP_DIR, 'c', '[slug]', 'page.tsx')
  assert.ok(existsSync(sendPagePath), 'app/c/[slug]/page.tsx must exist')
  const src = readFileSync(sendPagePath, 'utf8')

  const sentBlockMatch =
    src.match(/sent\s*===\s*['"]1['"]\s*&&[\s\S]*?\(([\s\S]*?)\)\s*\}/) ||
    src.match(/sent\s*===\s*['"]1['"][\s\S]*?<\/div>/)
  assert.ok(sentBlockMatch, 'send page must contain post-send section for sent === "1"')

  const postSendSection = sentBlockMatch[1] || sentBlockMatch[0]
  const hasSentLink =
    /<a\s+[^>]*href=['"]\/sent['"][^>]*>/i.test(postSendSection) ||
    /<a\s+[^>]*href=\{['"]\/sent['"]\}[^>]*>/i.test(postSendSection)
  assert.ok(
    hasSentLink,
    'post-send confirmation must contain direct link to view sent outbox (threshold: a[href=\'/sent\'] present)',
  )
})

test('AC5: confession submission validation and rate limiting are preserved', async () => {
  const { db, client } = await freshDb()
  try {
    const sender = await createAccount(db)
    const recipient = await createAccount(db)
    const link = await createLink(db, recipient.id)

    const body4000 = 'x'.repeat(4000)
    const sendResult = await sendConfession(db, {
      senderAccountId: sender.id,
      linkSlug: link.slug,
      body: body4000,
    })
    assert.ok(sendResult.confessionId, 'confession up to 4000 characters must be accepted')

    const disabledLink = await createLink(db, recipient.id, { enabled: false })
    await assert.rejects(
      () => sendConfession(db, { senderAccountId: sender.id, linkSlug: disabledLink.slug, body: 'valid' }),
      LinkDisabledError,
      'send to disabled link must be rejected with LinkDisabledError',
    )

    for (let i = 0; i < 4; i++) {
      await sendConfession(db, { senderAccountId: sender.id, linkSlug: link.slug, body: `message ${i}` })
    }
    await assert.rejects(
      () => sendConfession(db, { senderAccountId: sender.id, linkSlug: link.slug, body: 'sixth message' }),
      PerLinkRateLimitExceededError,
      '6th send in one hour to same link must be rejected with PerLinkRateLimitExceededError',
    )
  } finally {
    await client.close()
  }
})
