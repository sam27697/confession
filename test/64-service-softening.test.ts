// test/64-service-softening.test.ts
//
// docs/SPEC-week15-service-softening.md §4: the tripwire for week 15. Query
// properties run on PGlite against the real migrations; source properties read
// the files, the way test/63 does, because what they protect is a line of code
// that a later pass could quietly drop.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { freshDb } from './harness.js'
import { createAccount, createLink } from './fixtures.js'
import { confessions } from '../src/schema.js'
import {
  getInboxForRecipient,
  getSentForSender,
  countVisibleInboxForLink,
  countSentForSender,
} from '../src/views.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

function read(rel: string): string {
  return readFileSync(path.join(REPO_ROOT, rel), 'utf8')
}

function listTsx(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listTsx(full))
    else if (entry.name.endsWith('.tsx')) out.push(full)
  }
  return out
}

// Inserted out of order on purpose (5h ago, 1h ago, 30h ago), so a list that
// merely came back in insertion order would fail as surely as one that came
// back oldest first.
async function seedThreeHours() {
  const { db, client } = await freshDb()
  const recipient = await createAccount(db)
  const sender = await createAccount(db)
  const link = await createLink(db, recipient.id)
  for (const [hoursAgo, body] of [
    [5, 'five hours ago'],
    [1, 'one hour ago'],
    [30, 'thirty hours ago'],
  ] as const) {
    await client.query(
      `insert into confessions (link_id, sender_account_id, body, created_hour)
       values ($1, $2, $3, date_trunc('hour', now()) - make_interval(hours => $4))`,
      [link.id, sender.id, body, hoursAgo],
    )
  }
  return { db, client, recipient, sender, link }
}

// --- §4.1 ordering ---------------------------------------------------------

test('4.1: getInboxForRecipient returns the newest confession first (week 15 §0.1)', async () => {
  const { db, client, recipient, link } = await seedThreeHours()
  try {
    const rows = await getInboxForRecipient(db, { linkId: link.id, viewerAccountId: recipient.id })
    assert.deepEqual(
      rows.map((r) => r.body),
      ['one hour ago', 'five hours ago', 'thirty hours ago'],
      'the inbox must list the message that just arrived at the top, not yesterday\'s',
    )
  } finally {
    await client.close()
  }
})

test('4.1: getSentForSender returns the newest confession first (week 15 §0.1)', async () => {
  const { db, client, sender } = await seedThreeHours()
  try {
    const rows = await getSentForSender(db, { senderAccountId: sender.id })
    assert.deepEqual(rows.map((r) => r.body), ['one hour ago', 'five hours ago', 'thirty hours ago'])
  } finally {
    await client.close()
  }
})

test('4.1: within one hour bucket the order is stable across reads (the uuid tiebreak, §2.1)', async () => {
  const { db, client } = await freshDb()
  try {
    const recipient = await createAccount(db)
    const sender = await createAccount(db)
    const link = await createLink(db, recipient.id)
    for (let i = 0; i < 6; i++) {
      await client.query(
        `insert into confessions (link_id, sender_account_id, body, created_hour)
         values ($1, $2, $3, date_trunc('hour', now()))`,
        [link.id, sender.id, `same hour ${i}`],
      )
    }
    const first = await getInboxForRecipient(db, { linkId: link.id, viewerAccountId: recipient.id })
    const second = await getInboxForRecipient(db, { linkId: link.id, viewerAccountId: recipient.id })
    assert.deepEqual(first.map((r) => r.id), second.map((r) => r.id))
    assert.deepEqual(
      first.map((r) => r.id),
      [...first.map((r) => r.id)].sort(),
      'within one hour the tiebreak is the random id, which says nothing about who sent first',
    )
  } finally {
    await client.close()
  }
})

// --- §4.2 counts -------------------------------------------------------------

test('4.2: countVisibleInboxForLink excludes hidden confessions and matches the filtered inbox length', async () => {
  const { db, client, recipient, link } = await seedThreeHours()
  try {
    const [oldest] = await db.select({ id: confessions.id }).from(confessions).where(eq(confessions.body, 'thirty hours ago'))
    await db.update(confessions).set({ status: 'hidden_by_recipient' }).where(eq(confessions.id, oldest.id))

    const rows = await getInboxForRecipient(db, { linkId: link.id, viewerAccountId: recipient.id })
    const visible = rows.filter((m) => m.status !== 'hidden_by_recipient').length
    const counted = await countVisibleInboxForLink(db, { linkId: link.id })
    assert.equal(counted, 2)
    assert.equal(counted, visible, 'the badge must say what the inbox page shows')
  } finally {
    await client.close()
  }
})

test('4.2: countSentForSender counts only the viewer\'s own sends and matches getSentForSender', async () => {
  const { db, client, sender, link } = await seedThreeHours()
  try {
    const someoneElse = await createAccount(db)
    await client.query(
      `insert into confessions (link_id, sender_account_id, body, created_hour)
       values ($1, $2, 'not mine', date_trunc('hour', now()))`,
      [link.id, someoneElse.id],
    )
    const counted = await countSentForSender(db, { senderAccountId: sender.id })
    const listed = (await getSentForSender(db, { senderAccountId: sender.id })).length
    assert.equal(counted, 3)
    assert.equal(counted, listed)
    assert.equal(await countSentForSender(db, { senderAccountId: someoneElse.id }), 1)
  } finally {
    await client.close()
  }
})

test('4.2: the count functions select a number and nothing else', () => {
  const src = read('src/views.ts')
  for (const name of ['countVisibleInboxForLink', 'countSentForSender']) {
    const start = src.indexOf(`export async function ${name}`)
    assert.notEqual(start, -1, `${name} must exist in src/views.ts`)
    const next = src.indexOf('export ', start + 10)
    const body = src.slice(start, next === -1 ? undefined : next)
    assert.match(body, /\.select\(\{\s*n:\s*count\(\)\s*\}\)/, `${name} must select only count()`)
    assert.doesNotMatch(body, /\bbody\b|displayName|providerUserId/, `${name} must not read a body, a name or a provider id`)
  }
})

// --- §4.3 the pool -------------------------------------------------------------

test('4.3: src/pool.ts sets timeouts and listens for idle-client errors (week 15 §0.3)', () => {
  const src = read('src/pool.ts')
  for (const key of ['connectionTimeoutMillis', 'idleTimeoutMillis', 'statement_timeout', 'idle_in_transaction_session_timeout']) {
    assert.match(src, new RegExp(`\\b${key}\\s*:\\s*[1-9]`), `pool config must set a non-zero ${key}`)
  }
  assert.match(
    src,
    /\.on\(\s*'error'/,
    'the pool must have an \'error\' listener: without one, Postgres restarting under an idle connection exits the web process',
  )
  assert.doesNotMatch(src, /\.on\(\s*'error'[\s\S]{0,200}\.message/, 'the error listener must not log err.message (week 3 §1 rule 3)')
})

// --- §4.4 headers --------------------------------------------------------------

test('4.4: next.config.mjs drops X-Powered-By and sets a Referrer-Policy that keeps Server Actions working', () => {
  const src = read('next.config.mjs')
  assert.match(src, /poweredByHeader:\s*false/)
  const policy = src.match(/'Referrer-Policy',\s*value:\s*'([^']+)'/)
  assert.ok(policy, 'next.config.mjs must set a Referrer-Policy header')
  assert.notEqual(
    policy[1],
    'no-referrer',
    'no-referrer makes a browser send Origin: null on POST, and Next rejects a Server Action whose Origin does not ' +
      'match the host, so every form in the app would fail. Use same-origin (week 15 §1 item 5).',
  )
  assert.match(src, /frame-ancestors 'none'/)
})

// --- §4.5 tabs -----------------------------------------------------------------

test('4.5: neither tab reads the other tab\'s full list just to draw a badge (week 15 §0.2)', () => {
  const inbox = read('app/inbox/page.tsx')
  const sent = read('app/sent/page.tsx')
  assert.doesNotMatch(inbox, /getSentForSender\(/, '/inbox must count sends with countSentForSender, not list them')
  assert.doesNotMatch(sent, /getInboxForRecipient\(/, '/sent must count the inbox with countVisibleInboxForLink, not list it')
  assert.match(inbox, /countSentForSender\(/)
  assert.match(sent, /countVisibleInboxForLink\(/)
})

// --- §4.6 not found -----------------------------------------------------------

test('4.6: app/not-found.tsx exists, renders on the server, and says nothing in English', () => {
  const file = path.join(APP_DIR, 'not-found.tsx')
  assert.ok(existsSync(file), 'app/not-found.tsx must exist, or a dead /c/ link renders Next\'s English 404')
  const src = readFileSync(file, 'utf8')
  assert.doesNotMatch(src, /['"]use client['"]/, 'the client island stays at five components (test/21 item 10b)')
  const jsx = src.slice(src.indexOf('return (') + 'return ('.length)
  const text = jsx.replace(/<[^>]*>/g, ' ').replace(/[{}()]/g, ' ')
  assert.doesNotMatch(text, /[A-Za-z]{3,}/, `rendered text must be Arabic; found Latin words in: ${text.trim()}`)
  assert.match(src, /href="\/"/, 'the not-found page must offer a way back to the start')
})

// --- §4.7 dead ends ---------------------------------------------------------------

test('4.7: every way /offer/[offerId] can have nothing to show still renders a link out', () => {
  const src = read('app/offer/[offerId]/page.tsx')
  const catchStart = src.indexOf('} catch (err) {')
  assert.notEqual(catchStart, -1)
  const catchBlock = src.slice(catchStart, src.indexOf('throw err', catchStart))
  const returns = catchBlock.match(/return\s*(\(|<)[\s\S]*?(?=\n\s{4}\}|\n\s{4}if)/g) ?? []
  assert.equal(returns.length, 2, 'expected the not-found and the not-pending early returns')
  for (const r of returns) {
    assert.match(r, /<OfferGone\b/, `each early return must render OfferGone, which carries the /sent link: ${r}`)
  }
  const gone = src.slice(src.indexOf('function OfferGone'), src.indexOf('export default'))
  assert.match(gone, /href="\/sent"/)
})

test('4.7: a switched-off /c/[slug] link renders a link to the visitor\'s own box', () => {
  const src = read('app/c/[slug]/page.tsx')
  const start = src.indexOf('if (!link.enabled) {')
  assert.notEqual(start, -1)
  const branch = src.slice(start, src.indexOf('\n  }\n', start))
  assert.match(branch, /<a [^>]*href="\/inbox"/)
})

// --- §4.8 confirmations -----------------------------------------------------------

function doneKeys(pageSrc: string): string[] {
  const block = pageSrc.match(/const DONE_COPY: Record<string, string> = \{([\s\S]*?)\n\}/)
  assert.ok(block, 'the page must declare DONE_COPY')
  return [...block[1].matchAll(/^\s*(\w+):\s*'[^']+'/gm)].map((m) => m[1]).sort()
}

test('4.8: every ?done= key an action emits has copy on the page it lands on, and vice versa', () => {
  const inboxActions = read('app/inbox/actions.ts')
  const offerActions = read('app/offer/[offerId]/actions.ts')
  const emittedToInbox = [...inboxActions.matchAll(/redirect\('\/inbox\?done=(\w+)'\)/g)].map((m) => m[1]).sort()
  const emittedToSent = [...offerActions.matchAll(/redirect\('\/sent\?done=(\w+)'\)/g)].map((m) => m[1]).sort()

  assert.deepEqual(emittedToInbox, ['blocked', 'hidden', 'offered', 'reported'])
  assert.deepEqual(emittedToSent, ['declined'])
  assert.deepEqual(doneKeys(read('app/inbox/page.tsx')), emittedToInbox)
  assert.deepEqual(doneKeys(read('app/sent/page.tsx')), emittedToSent)
})

test('4.8: a confirmation is pinned to the viewport, because a Server Action redirect keeps the scroll position', () => {
  const css = read('app/globals.css')
  const toasts = css.match(/\.toasts\{[^}]*\}/)
  assert.ok(toasts, '.toasts must be defined')
  assert.match(toasts[0], /position:fixed/, 'the box a confirmation renders into must be pinned to the viewport')
  const flash = css.match(/\.flash\{[^}]*\}/)
  assert.ok(flash, '.flash must be defined')
  assert.match(flash[0], /var\(--flash-life\)/, 'its lifetime is a token, not a --dur-* that reduced motion collapses to 1ms')
  for (const page of ['app/inbox/page.tsx', 'app/sent/page.tsx']) {
    assert.match(read(page), /className="toasts flash" key=\{/, `${page} must render DONE_COPY inside a keyed .toasts.flash`)
  }
})

// --- §4.9 next survives signup -------------------------------------------------------

test('4.9: acceptTermsAction sends a new account to where the login was headed, not always to /inbox', () => {
  const src = read('app/onboarding/actions.ts')
  const pendingStart = src.indexOf('.get(PENDING_IDENTITY_COOKIE)')
  const signupBranch = src.slice(pendingStart)
  assert.match(signupBranch, /redirect\(await takeRememberedDestination\(\)\)/)
  assert.doesNotMatch(signupBranch, /redirect\('\/inbox'\)/, 'the signup branch must not hard-code /inbox any more (§0.5)')
})

test('4.9: the login flow remembers the destination on both branches that detour through /onboarding', () => {
  const src = read('app/_lib/login-flow.ts')
  const detours = src.match(/rememberDestination\(store, destination\)\s*\n\s*redirect\('\/onboarding'\)/g) ?? []
  assert.equal(detours.length, 2)
  assert.match(src, /export async function takeRememberedDestination[\s\S]*?sanitizeNextDestination\(raw\)/,
    'the remembered value must be sanitised again on the way out')
})

test('4.9: /auth/facebook/start reads next, and the callback passes it on', () => {
  assert.match(read('app/auth/facebook/start/route.ts'), /searchParams\.get\('next'\)/)
  assert.match(read('app/auth/facebook/callback/route.ts'), /resolveLoginAndRedirect\([\s\S]*?remembered,?\s*\)/)
  assert.match(read('app/page.tsx'), /\/auth\/facebook\/start\?next=\$\{encodeURIComponent\(next\)\}/)
})

// --- §4.10 no guessed genders -----------------------------------------------------------

test('4.10: no screen guesses the gender of the other side of a reveal (week 15 §3.3)', () => {
  const offenders: string[] = []
  for (const file of listTsx(APP_DIR)) {
    const src = readFileSync(file, 'utf8')
    for (const phrase of ['جوابها', 'بدها تعرف', 'عن حالها']) {
      if (src.includes(phrase)) offenders.push(`${path.relative(REPO_ROOT, file)}: ${phrase}`)
    }
  }
  assert.deepEqual(offenders, [])
})

// --- the spotlight --------------------------------------------------------------------

test('spotlight: the form holding a focused field is lifted above the dim, not only a .card', () => {
  const css = read('app/globals.css')
  const dimZ = css.match(/body::before\s*\{[^}]*z-index:\s*(\d+)/)
  assert.ok(dimZ, 'the spotlight overlay must declare its z-index')
  const lift = css.match(/form:has\(\.input:focus-visible, \.textarea:focus-visible\),\s*\n\.enter > :has\([^)]*\)\{[^}]*z-index:\s*(\d+)/)
  assert.ok(lift, 'the form and the animated .enter child holding a focused field must be lifted')
  assert.ok(Number(lift[1]) > Number(dimZ[1]), 'the lifted block must sit above the overlay')
})
