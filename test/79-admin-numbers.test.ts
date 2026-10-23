// test/79-admin-numbers.test.ts
//
// Written from docs/SPEC-week29-admin-numbers.md section 1.1 (the
// getAdminStats contract) as amended by section 6, section 1.2 (what the
// result must never contain), and section 3 items 1 to 15 as amended by
// section 6. Not written from src/stats.ts: that module is not in this
// tree. Every expected number and day string below is taken from the spec
// text and the fixture rows in that test.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { freshDb } from './harness.js'
import { createLink } from './fixtures.js'
import { accounts, confessions, revealAnswers, revealOffers } from '../src/schema.js'
import {
  acceptRevealOffer,
  blockSenderOfConfession,
  declineRevealOffer,
  hideConfession,
  openRevealOffer,
  reportConfession,
  sendConfession,
} from '../src/actions.js'
import { deleteAccount } from '../src/account-deletion.js'
import type { Db } from '../src/db.js'
import { getAdminStats, STATS_DAYS, STATS_TIME_ZONE } from '../src/stats.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Spec section 3 item 2, copied as instants, not read from the clock.
// 20:30Z is 00:30 the next morning in Asia/Dubai, so that Dubai date is
// 2026-10-24. 19:59Z is 23:59 the same evening, so it is still 2026-10-23.
const NOW_DUBAI_2026_10_24 = new Date('2026-10-23T20:30:00Z')
const NOW_DUBAI_2026_10_23 = new Date('2026-10-23T19:59:00Z')

// Hand-listed from item 2. Fourteen calendar dates, oldest first. The
// second list is the same rule applied to the instant whose Dubai date
// item 2 names as 2026-10-23, so its first day is 2026-10-10.
const WINDOW_ENDING_2026_10_24 = [
  '2026-10-11',
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
  '2026-10-15',
  '2026-10-16',
  '2026-10-17',
  '2026-10-18',
  '2026-10-19',
  '2026-10-20',
  '2026-10-21',
  '2026-10-22',
  '2026-10-23',
  '2026-10-24',
] as const

const WINDOW_ENDING_2026_10_23 = [
  '2026-10-10',
  '2026-10-11',
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
  '2026-10-15',
  '2026-10-16',
  '2026-10-17',
  '2026-10-18',
  '2026-10-19',
  '2026-10-20',
  '2026-10-21',
  '2026-10-22',
  '2026-10-23',
] as const

// Amended section 1.1 day entry, restated here because this file may import
// only the three names section 3 fixes. Section 6 point 3 lists these keys
// and no others.
type DayRow = {
  day: string
  signups: number
  messages: number
  offers: number
}

// Section 6 point 3. Compared as a set: same names, nothing else. The spec
// lists them in type order and does not say the enumeration order is part
// of the contract.
const TOP_LEVEL_KEYS = [
  'timeZone',
  'accounts',
  'links',
  'messages',
  'reports',
  'blocks',
  'offers',
  'days',
  'lastSignupDay',
  'lastMessageDay',
] as const

const DAY_KEYS = ['day', 'signups', 'messages', 'offers'] as const

const REMOVED_COUNT_KEYS: ReadonlySet<string> = new Set(['everSent', 'everReceived', 'senders', 'recipients'])

// Item 13: strings are allowed only on the time zone and the day fields
// section 1.1 types as text. lastSignupDay and lastMessageDay are
// string | null; a null on any other field is not a count.
const STRING_FIELDS = new Set(['timeZone', 'day', 'lastSignupDay', 'lastMessageDay'])
const NULL_FIELDS = new Set(['lastSignupDay', 'lastMessageDay'])

// Numeric leaves of the amended section 1.1 shape, with 14 day rows.
// accounts 5, links 2, messages 5, reports and blocks 2, offers 5,
// each day signups, messages, offers: 5 + 2 + 5 + 2 + 5 + 14 * 3.
const SPEC_NUMBER_COUNT = 5 + 2 + 5 + 2 + 5 + 14 * 3

type DbClient = Awaited<ReturnType<typeof freshDb>>['client']

async function insertAccount(
  db: Db,
  {
    provider,
    providerUserId,
    displayName,
    createdAt,
    disabledAt = null,
  }: {
    provider: 'facebook' | 'google'
    providerUserId: string
    displayName: string
    createdAt: Date
    disabledAt?: Date | null
  },
): Promise<{ id: string }> {
  const [row] = await db
    .insert(accounts)
    .values({
      provider,
      providerUserId,
      displayName,
      termsVersion: '2026-08-25',
      termsAcceptedAt: createdAt,
      ageAttested18: true,
      disabledAt,
      createdAt,
    })
    .returning({ id: accounts.id })
  assert.ok(row, 'account insert returned no row')
  return { id: row.id }
}

async function insertConfession(
  db: Db,
  {
    linkId,
    senderAccountId,
    body,
    createdHour,
  }: {
    linkId: string
    senderAccountId: string
    body: string
    createdHour: Date
  },
): Promise<{ id: string }> {
  const [row] = await db
    .insert(confessions)
    .values({ linkId, senderAccountId, body, createdHour })
    .returning({ id: confessions.id })
  assert.ok(row, 'confession insert returned no row')
  return { id: row.id }
}

// openRevealOffer stamps createdAt with new Date(), and the reveal_offers
// transition trigger rejects any later UPDATE that does not leave pending
// (and rejects every UPDATE once the row has left pending). A fixture that
// needs an exact created_at inserts the offer and its recipient answer in
// one transaction, which is also what the deferred answer constraint
// requires.
async function insertOfferAt(
  db: Db,
  {
    confessionId,
    createdAt,
    questionForSender,
    stakePrompt,
    recipientAnswer,
  }: {
    confessionId: string
    createdAt: Date
    questionForSender: string
    stakePrompt: string
    recipientAnswer: string
  },
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [offer] = await tx
      .insert(revealOffers)
      .values({ confessionId, questionForSender, stakePrompt, createdAt })
      .returning({ id: revealOffers.id })
    assert.ok(offer, 'offer insert returned no row')
    await tx.insert(revealAnswers).values({ offerId: offer.id, side: 'recipient', body: recipientAnswer })
    return { id: offer.id }
  })
}

function assertDayNames(days: DayRow[], expected: readonly string[]): void {
  assert.deepEqual(
    days.map((day) => day.day),
    [...expected],
  )
}

function findDay(days: DayRow[], day: string): DayRow {
  const found = days.find((entry) => entry.day === day)
  assert.ok(found, `window is missing ${day}`)
  return found
}

function assertDayCounts(row: DayRow, expected: Omit<DayRow, 'day'>): void {
  assert.equal(row.signups, expected.signups, `${row.day} signups`)
  assert.equal(row.messages, expected.messages, `${row.day} messages`)
  assert.equal(row.offers, expected.offers, `${row.day} offers`)
}

function assertKeySet(value: object, expected: readonly string[], label: string): void {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label)
}

// Section 6 point 3: none of the four removed names, on this object or on
// anything nested inside it. Own enumerable keys, which is what a caller
// reads off the result.
function assertNoRemovedCountKeys(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoRemovedCountKeys(entry, `${path}[${index}]`))
    return
  }
  if (value === null || typeof value !== 'object') return
  for (const key of Object.keys(value)) {
    assert.equal(REMOVED_COUNT_KEYS.has(key), false, `${path} has removed key ${key}`)
    assertNoRemovedCountKeys((value as Record<string, unknown>)[key], `${path}.${key}`)
  }
}

type WalkSeen = { numbers: number; strings: number; nulls: number }

function visit(value: unknown, key: string | null, path: string, seen: WalkSeen): void {
  if (typeof value === 'number') {
    assert.equal(Number.isInteger(value), true, `${path} must be an integer`)
    seen.numbers += 1
    return
  }
  if (typeof value === 'string') {
    assert.ok(key !== null && STRING_FIELDS.has(key), `${path} is a string on ${String(key)}, which is not a day field`)
    seen.strings += 1
    return
  }
  if (value === null) {
    assert.ok(key !== null && NULL_FIELDS.has(key), `${path} is null`)
    seen.nulls += 1
    return
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visit(entry, null, `${path}[${index}]`, seen))
    return
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    assert.ok(prototype === Object.prototype || prototype === null, `${path} is not a plain object`)
    for (const [childKey, child] of Object.entries(value)) {
      visit(child, childKey, `${path}.${childKey}`, seen)
    }
    return
  }
  assert.fail(`${path} has type ${typeof value}`)
}

async function collectUuids(client: DbClient): Promise<string[]> {
  const columns = await client.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name
     from information_schema.columns
     where table_schema = 'public' and data_type = 'uuid'`,
  )
  const ids: string[] = []
  for (const column of columns.rows) {
    assert.match(column.table_name, /^[a-z_]+$/)
    assert.match(column.column_name, /^[a-z_]+$/)
    const values = await client.query<{ id: string | null }>(
      `select "${column.column_name}"::text as id from "${column.table_name}"`,
    )
    for (const value of values.rows) {
      if (typeof value.id === 'string' && value.id.length > 0) ids.push(value.id)
    }
  }
  return ids
}

// ---------------------------------------------------------------------------
// item 1: empty database (spec section 3 item 1, section 1.1)
// ---------------------------------------------------------------------------

test('item 1: empty database totals are zero', async () => {
  const { db, client } = await freshDb()

  assert.equal(STATS_DAYS, 14)
  assert.equal(STATS_TIME_ZONE, 'Asia/Dubai')

  const stats = await getAdminStats(db, { now: NOW_DUBAI_2026_10_24, days: STATS_DAYS })

  assert.equal(stats.timeZone, 'Asia/Dubai')
  assert.equal(stats.timeZone, STATS_TIME_ZONE)
  assert.equal(stats.accounts.live, 0)
  assert.equal(stats.accounts.disabled, 0)
  assert.equal(stats.accounts.deleted, 0)
  assert.equal(stats.accounts.google, 0)
  assert.equal(stats.accounts.facebook, 0)
  assert.equal(stats.links.on, 0)
  assert.equal(stats.links.off, 0)
  assert.equal(stats.messages.total, 0)
  assert.equal(stats.messages.delivered, 0)
  assert.equal(stats.messages.hidden, 0)
  assert.equal(stats.messages.reported, 0)
  assert.equal(stats.messages.withheld, 0)
  assert.equal(stats.reports, 0)
  assert.equal(stats.blocks, 0)
  assert.equal(stats.offers.total, 0)
  assert.equal(stats.offers.pending, 0)
  assert.equal(stats.offers.resolved, 0)
  assert.equal(stats.offers.declined, 0)
  assert.equal(stats.offers.cancelled, 0)
  assert.equal(stats.lastSignupDay, null)
  assert.equal(stats.lastMessageDay, null)
  assert.equal(stats.days.length, 14)
  for (const day of stats.days) {
    assert.equal(day.signups, 0)
    assert.equal(day.messages, 0)
    assert.equal(day.offers, 0)
  }

  await client.close()
})

// ---------------------------------------------------------------------------
// item 2: the window (spec section 3 item 2, section 1.1)
// ---------------------------------------------------------------------------

test('item 2: days is 14 consecutive Dubai dates ending today', async () => {
  const later = await freshDb()
  const laterStats = await getAdminStats(later.db, { now: NOW_DUBAI_2026_10_24, days: STATS_DAYS })
  assert.equal(laterStats.days.length, 14)
  assert.equal(laterStats.days[0]?.day, '2026-10-11')
  assert.equal(laterStats.days[13]?.day, '2026-10-24')
  assertDayNames(laterStats.days, WINDOW_ENDING_2026_10_24)
  await later.client.close()

  const earlier = await freshDb()
  const earlierStats = await getAdminStats(earlier.db, { now: NOW_DUBAI_2026_10_23, days: STATS_DAYS })
  assert.equal(earlierStats.days.length, 14)
  assert.equal(earlierStats.days[0]?.day, '2026-10-10')
  assert.equal(earlierStats.days[13]?.day, '2026-10-23')
  assertDayNames(earlierStats.days, WINDOW_ENDING_2026_10_23)
  await earlier.client.close()
})

// ---------------------------------------------------------------------------
// item 3: days parameter (spec section 3 item 3, section 1.1)
// ---------------------------------------------------------------------------

test('item 3: days parameter returns that many entries', async () => {
  const { db, client } = await freshDb()

  // Section 1.1: the window is `days` calendar dates ending on today.
  // For the item 2 instant whose Dubai date is 2026-10-24, three dates
  // are the 22nd, the 23rd and the 24th, oldest first.
  const stats = await getAdminStats(db, { now: NOW_DUBAI_2026_10_24, days: 3 })
  assert.equal(stats.days.length, 3)
  assertDayNames(stats.days, ['2026-10-22', '2026-10-23', '2026-10-24'])

  await client.close()
})

// ---------------------------------------------------------------------------
// item 4: account totals (spec section 3 item 4, section 1.1)
// ---------------------------------------------------------------------------

test('item 4: live, disabled, deleted and provider totals, with the deleted signup day', async () => {
  const { db, client } = await freshDb()

  // 20:00Z is 00:00 in Dubai, so this signup is 2026-10-24.
  await insertAccount(db, {
    provider: 'google',
    providerUserId: 'w29-puid-live-google',
    displayName: 'w29-display-live-google',
    createdAt: new Date('2026-10-23T20:00:00Z'),
  })
  // 12:00Z is 16:00 in Dubai on the 23rd.
  await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-live-facebook',
    displayName: 'w29-display-live-facebook',
    createdAt: new Date('2026-10-23T12:00:00Z'),
  })
  // No product-account disable function exists. Section 1.1 defines this
  // row as deleted_at null and disabled_at set, and it stays in live.
  await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-disabled-facebook',
    displayName: 'w29-display-disabled-facebook',
    createdAt: new Date('2026-10-23T08:00:00Z'),
    disabledAt: new Date('2026-10-23T09:00:00Z'),
  })
  // 12:00Z on the 22nd is 16:00 in Dubai on the 22nd. Deleted through
  // deleteAccount, which also stamps disabled_at. Section 1.1 still
  // counts the row only under deleted, and still counts its signup day.
  const deleted = await insertAccount(db, {
    provider: 'google',
    providerUserId: 'w29-puid-deleted-google',
    displayName: 'w29-display-deleted-google',
    createdAt: new Date('2026-10-22T12:00:00Z'),
  })
  await deleteAccount(db, { accountId: deleted.id })

  const stats = await getAdminStats(db, { now: NOW_DUBAI_2026_10_24, days: STATS_DAYS })

  assert.equal(stats.accounts.live, 3)
  assert.equal(stats.accounts.disabled, 1)
  assert.equal(stats.accounts.deleted, 1)
  assert.equal(stats.accounts.google, 1)
  assert.equal(stats.accounts.facebook, 2)
  assert.equal(findDay(stats.days, '2026-10-24').signups, 1)
  assert.equal(findDay(stats.days, '2026-10-23').signups, 2)
  assert.equal(findDay(stats.days, '2026-10-22').signups, 1)
  const signupSum = stats.days.reduce((sum: number, day: DayRow) => sum + day.signups, 0)
  assert.equal(signupSum, 4)

  await client.close()
})

// ---------------------------------------------------------------------------
// item 5: removed people-count keys and the exact key sets
// (spec section 6 point 3, replacing section 3 item 5). messages.total is
// still every row in confessions (section 1.1), including one whose sender
// was deleted through deleteAccount.
// ---------------------------------------------------------------------------

test('item 5: no everSent, everReceived, senders or recipients, and a deleted sender stays in the total', async () => {
  const { db, client } = await freshDb()
  const createdAt = new Date('2026-10-20T10:00:00Z')
  const hour = new Date('2026-10-20T10:00:00Z')

  const recipient = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-recipient-ever',
    displayName: 'w29-display-recipient-ever',
    createdAt,
  })
  const sender = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-sender-ever',
    displayName: 'w29-display-sender-ever',
    createdAt,
  })
  const deletedSender = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-deleted-sender-ever',
    displayName: 'w29-display-deleted-sender-ever',
    createdAt,
  })
  const link = await createLink(db, recipient.id)

  await insertConfession(db, { linkId: link.id, senderAccountId: sender.id, body: 'one', createdHour: hour })
  await insertConfession(db, { linkId: link.id, senderAccountId: sender.id, body: 'two', createdHour: hour })
  await insertConfession(db, { linkId: link.id, senderAccountId: sender.id, body: 'three', createdHour: hour })
  await insertConfession(db, {
    linkId: link.id,
    senderAccountId: deletedSender.id,
    body: 'from the deleted sender',
    createdHour: hour,
  })
  await deleteAccount(db, { accountId: deletedSender.id })

  const stats = await getAdminStats(db, { now: NOW_DUBAI_2026_10_24, days: STATS_DAYS })

  // Three messages from one live sender, plus the deleted sender's
  // confession. Section 1.1 still counts every confessions row.
  assert.equal(stats.messages.total, 4)
  assertKeySet(stats, TOP_LEVEL_KEYS, 'top-level keys')
  for (const day of stats.days) {
    assertKeySet(day, DAY_KEYS, `${day.day} keys`)
  }
  assertNoRemovedCountKeys(stats, 'result')

  await client.close()
})

// ---------------------------------------------------------------------------
// item 6: links (spec section 3 item 6, section 1.1)
// ---------------------------------------------------------------------------

test('item 6: on, off, and a deleted account retired link', async () => {
  const { db, client } = await freshDb()
  const createdAt = new Date('2026-10-20T10:00:00Z')

  const owner = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-link-owner',
    displayName: 'w29-display-link-owner',
    createdAt,
  })
  const deletedOwner = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-deleted-link-owner',
    displayName: 'w29-display-deleted-link-owner',
    createdAt,
  })
  await createLink(db, owner.id, { enabled: true })
  await createLink(db, owner.id, { enabled: false })
  await createLink(db, deletedOwner.id)
  await deleteAccount(db, { accountId: deletedOwner.id })

  const retired = await client.query<{ c: number }>(
    `select count(*)::int as c from links
     where owner_account_id = $1 and deleted_at is not null and enabled = false`,
    [deletedOwner.id],
  )
  assert.equal(retired.rows[0]!.c, 1, 'deleteAccount must retire the owned link')

  const stats = await getAdminStats(db, { now: NOW_DUBAI_2026_10_24, days: STATS_DAYS })
  assert.equal(stats.links.on, 1)
  assert.equal(stats.links.off, 1)

  await client.close()
})

// ---------------------------------------------------------------------------
// item 7: message statuses, withheld, reports, blocks
// (spec section 3 item 7, section 1.1)
// ---------------------------------------------------------------------------

test('item 7: each message status, withheld outside total, reports and blocks', async () => {
  const { db, client } = await freshDb()
  const createdAt = new Date('2026-10-20T10:00:00Z')

  const recipient = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-status-recipient',
    displayName: 'w29-display-status-recipient',
    createdAt,
  })
  const sender = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-status-sender',
    displayName: 'w29-display-status-sender',
    createdAt,
  })
  const link = await createLink(db, recipient.id)

  const delivered = await sendConfession(db, {
    senderAccountId: sender.id,
    linkSlug: link.slug,
    body: 'stays delivered',
  })
  const hidden = await sendConfession(db, {
    senderAccountId: sender.id,
    linkSlug: link.slug,
    body: 'will be hidden',
  })
  const reported = await sendConfession(db, {
    senderAccountId: sender.id,
    linkSlug: link.slug,
    body: 'will be reported',
  })
  await hideConfession(db, { recipientAccountId: recipient.id, confessionId: hidden.confessionId })
  await reportConfession(db, {
    reporterAccountId: recipient.id,
    confessionId: reported.confessionId,
    reason: 'reported through the real path',
  })
  await blockSenderOfConfession(db, {
    recipientAccountId: recipient.id,
    confessionId: delivered.confessionId,
  })
  await sendConfession(db, {
    senderAccountId: sender.id,
    linkSlug: link.slug,
    body: 'withheld because the link blocked the sender',
  })

  const stats = await getAdminStats(db, { now: NOW_DUBAI_2026_10_24, days: STATS_DAYS })

  assert.equal(stats.messages.delivered, 1)
  assert.equal(stats.messages.hidden, 1)
  assert.equal(stats.messages.reported, 1)
  assert.equal(stats.messages.total, 3)
  assert.equal(
    stats.messages.total,
    stats.messages.delivered + stats.messages.hidden + stats.messages.reported,
  )
  assert.equal(stats.messages.withheld, 1)
  assert.equal(stats.reports, 1)
  assert.equal(stats.blocks, 1)

  await client.close()
})

// ---------------------------------------------------------------------------
// item 8: offer states (spec section 3 item 8, section 1.1)
// ---------------------------------------------------------------------------

test('item 8: each offer state and their sum', async () => {
  const { db, client } = await freshDb()
  const createdAt = new Date('2026-10-20T10:00:00Z')
  const hour = new Date('2026-10-20T10:00:00Z')

  const recipient = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-offer-recipient',
    displayName: 'w29-display-offer-recipient',
    createdAt,
  })
  const sender = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-offer-sender',
    displayName: 'w29-display-offer-sender',
    createdAt,
  })
  const link = await createLink(db, recipient.id)

  const pendingConfession = await insertConfession(db, {
    linkId: link.id,
    senderAccountId: sender.id,
    body: 'pending offer confession',
    createdHour: hour,
  })
  await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: pendingConfession.id,
    questionForSender: 'pending question',
    stakePrompt: 'pending stake',
    recipientAnswer: 'pending answer',
  })

  const resolvedConfession = await insertConfession(db, {
    linkId: link.id,
    senderAccountId: sender.id,
    body: 'resolved offer confession',
    createdHour: hour,
  })
  const resolved = await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: resolvedConfession.id,
    questionForSender: 'resolved question',
    stakePrompt: 'resolved stake',
    recipientAnswer: 'resolved recipient answer',
  })
  await acceptRevealOffer(db, {
    senderAccountId: sender.id,
    offerId: resolved.offerId,
    senderAnswer: 'resolved sender answer',
  })

  const declinedConfession = await insertConfession(db, {
    linkId: link.id,
    senderAccountId: sender.id,
    body: 'declined offer confession',
    createdHour: hour,
  })
  const declined = await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: declinedConfession.id,
    questionForSender: 'declined question',
    stakePrompt: 'declined stake',
    recipientAnswer: 'declined answer',
  })
  await declineRevealOffer(db, { senderAccountId: sender.id, offerId: declined.offerId })

  // No function in src/actions.ts moves an offer to cancelled. The only
  // legal write is the pending to cancelled transition, same as test 04.
  const cancelledConfession = await insertConfession(db, {
    linkId: link.id,
    senderAccountId: sender.id,
    body: 'cancelled offer confession',
    createdHour: hour,
  })
  const cancelled = await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: cancelledConfession.id,
    questionForSender: 'cancelled question',
    stakePrompt: 'cancelled stake',
    recipientAnswer: 'cancelled answer',
  })
  await db.update(revealOffers).set({ state: 'cancelled' }).where(eq(revealOffers.id, cancelled.offerId))

  const stats = await getAdminStats(db, { now: NOW_DUBAI_2026_10_24, days: STATS_DAYS })

  assert.equal(stats.offers.pending, 1)
  assert.equal(stats.offers.resolved, 1)
  assert.equal(stats.offers.declined, 1)
  assert.equal(stats.offers.cancelled, 1)
  assert.equal(stats.offers.total, 4)
  assert.equal(
    stats.offers.total,
    stats.offers.pending + stats.offers.resolved + stats.offers.declined + stats.offers.cancelled,
  )

  await client.close()
})

// ---------------------------------------------------------------------------
// item 9: Dubai midnight (spec section 3 item 9, section 1.1)
// ---------------------------------------------------------------------------

test('item 9: day buckets follow Dubai midnight', async () => {
  const { db, client } = await freshDb()

  // 08:00Z on the 11th is 12:00 in Dubai, the first day of this window,
  // so the recipient's signup does not sit on either boundary day.
  const recipient = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-boundary-recipient',
    displayName: 'w29-display-boundary-recipient',
    createdAt: new Date('2026-10-11T08:00:00Z'),
  })
  const earlySender = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-boundary-early',
    displayName: 'w29-display-boundary-early',
    createdAt: new Date('2026-10-23T19:00:00Z'),
  })
  const lateSender = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-boundary-late',
    displayName: 'w29-display-boundary-late',
    createdAt: new Date('2026-10-23T20:00:00Z'),
  })
  const link = await createLink(db, recipient.id)

  const earlyConfession = await insertConfession(db, {
    linkId: link.id,
    senderAccountId: earlySender.id,
    body: 'confession before Dubai midnight',
    createdHour: new Date('2026-10-23T19:00:00Z'),
  })
  const lateConfession = await insertConfession(db, {
    linkId: link.id,
    senderAccountId: lateSender.id,
    body: 'confession after Dubai midnight',
    createdHour: new Date('2026-10-23T20:00:00Z'),
  })
  await insertOfferAt(db, {
    confessionId: earlyConfession.id,
    createdAt: new Date('2026-10-23T19:00:00Z'),
    questionForSender: 'early boundary question',
    stakePrompt: 'early boundary stake',
    recipientAnswer: 'early boundary answer',
  })
  await insertOfferAt(db, {
    confessionId: lateConfession.id,
    createdAt: new Date('2026-10-23T20:00:00Z'),
    questionForSender: 'late boundary question',
    stakePrompt: 'late boundary stake',
    recipientAnswer: 'late boundary answer',
  })

  const stats = await getAdminStats(db, { now: NOW_DUBAI_2026_10_24, days: STATS_DAYS })

  // 19:00Z is 23:00 on the 23rd in Dubai. 20:00Z is 00:00 on the 24th.
  assertDayCounts(findDay(stats.days, '2026-10-23'), {
    signups: 1,
    messages: 1,
    offers: 1,
  })
  assertDayCounts(findDay(stats.days, '2026-10-24'), {
    signups: 1,
    messages: 1,
    offers: 1,
  })
  assertDayCounts(findDay(stats.days, '2026-10-11'), {
    signups: 1,
    messages: 0,
    offers: 0,
  })
  for (const day of stats.days) {
    if (day.day === '2026-10-11' || day.day === '2026-10-23' || day.day === '2026-10-24') continue
    assertDayCounts(day, { signups: 0, messages: 0, offers: 0 })
  }

  await client.close()
})

// ---------------------------------------------------------------------------
// item 10: one day, three messages, no other count of them
// (spec section 6 point 4, replacing section 3 item 10)
// ---------------------------------------------------------------------------

test('item 10: three messages from two senders to two recipients are messages 3', async () => {
  const { db, client } = await freshDb()
  const createdAt = new Date('2026-10-12T08:00:00Z')

  const sender1 = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-distinct-sender-1',
    displayName: 'w29-display-distinct-sender-1',
    createdAt,
  })
  const sender2 = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-distinct-sender-2',
    displayName: 'w29-display-distinct-sender-2',
    createdAt,
  })
  const recipient1 = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-distinct-recipient-1',
    displayName: 'w29-display-distinct-recipient-1',
    createdAt,
  })
  const recipient2 = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-distinct-recipient-2',
    displayName: 'w29-display-distinct-recipient-2',
    createdAt,
  })
  const link1 = await createLink(db, recipient1.id)
  const link2 = await createLink(db, recipient2.id)

  // 10:00Z, 11:00Z and 15:00Z are all 14:00, 15:00 and 19:00 on 2026-10-20
  // in Dubai, so all three messages are the same Dubai day.
  await insertConfession(db, {
    linkId: link1.id,
    senderAccountId: sender1.id,
    body: 'distinct one',
    createdHour: new Date('2026-10-20T10:00:00Z'),
  })
  await insertConfession(db, {
    linkId: link2.id,
    senderAccountId: sender1.id,
    body: 'distinct two',
    createdHour: new Date('2026-10-20T11:00:00Z'),
  })
  await insertConfession(db, {
    linkId: link1.id,
    senderAccountId: sender2.id,
    body: 'distinct three',
    createdHour: new Date('2026-10-20T15:00:00Z'),
  })

  const stats = await getAdminStats(db, { now: NOW_DUBAI_2026_10_24, days: STATS_DAYS })
  const day = findDay(stats.days, '2026-10-20')
  assert.equal(day.messages, 3)
  // Section 6 point 4: that day carries no other count of these messages.
  // Point 3's day key set is day, signups, messages, offers.
  assertKeySet(day, DAY_KEYS, '2026-10-20 keys')
  const messagesInWindow = stats.days.reduce((sum: number, entry: DayRow) => sum + entry.messages, 0)
  assert.equal(messagesInWindow, 3)

  await client.close()
})

// ---------------------------------------------------------------------------
// item 11: outside the window (spec section 3 item 11, section 1.1)
// ---------------------------------------------------------------------------

test('item 11: a confession 20 days before now is a total and a last day, not a bucket', async () => {
  const { db, client } = await freshDb()

  const recipient = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-outside-recipient',
    displayName: 'w29-display-outside-recipient',
    createdAt: new Date('2026-10-01T08:00:00Z'),
  })
  const sender = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-outside-sender',
    displayName: 'w29-display-outside-sender',
    createdAt: new Date('2026-10-01T08:00:00Z'),
  })
  const link = await createLink(db, recipient.id)

  // now is 2026-10-23T20:30:00Z. Twenty days before that hour is
  // 2026-10-03T20:00:00Z, which is 2026-10-04 00:00 in Dubai. The window
  // for this now starts on 2026-10-11, so that day is in no bucket, and
  // it is the only confession, so it is lastMessageDay.
  await insertConfession(db, {
    linkId: link.id,
    senderAccountId: sender.id,
    body: 'twenty days before now',
    createdHour: new Date('2026-10-03T20:00:00Z'),
  })

  const stats = await getAdminStats(db, { now: NOW_DUBAI_2026_10_24, days: STATS_DAYS })

  assert.equal(stats.messages.total, 1)
  assert.equal(stats.lastMessageDay, '2026-10-04')
  assert.equal(
    stats.days.some((day: DayRow) => day.day === '2026-10-04'),
    false,
  )
  for (const day of stats.days) {
    assert.equal(day.messages, 0)
  }

  await client.close()
})

// ---------------------------------------------------------------------------
// item 12: newest Dubai day (spec section 3 item 12, section 1.1)
// ---------------------------------------------------------------------------

test('item 12: lastSignupDay and lastMessageDay are the newest Dubai day', async () => {
  const { db, client } = await freshDb()

  // Older signup: 19:00Z is 23:00 on the 22nd in Dubai.
  // Newer signup: 20:00Z on the 23rd is 00:00 on the 24th in Dubai.
  // Its UTC date is still the 23rd, so a UTC day would be wrong.
  const recipient = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-newest-recipient',
    displayName: 'w29-display-newest-recipient',
    createdAt: new Date('2026-10-22T19:00:00Z'),
  })
  const sender = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-newest-sender',
    displayName: 'w29-display-newest-sender',
    createdAt: new Date('2026-10-23T20:00:00Z'),
  })
  const link = await createLink(db, recipient.id)

  await insertConfession(db, {
    linkId: link.id,
    senderAccountId: sender.id,
    body: 'older message',
    createdHour: new Date('2026-10-22T10:00:00Z'),
  })
  // 20:00Z on the 22nd is 00:00 on the 23rd in Dubai, and it is the
  // newer confession. The newer signup is the 24th, so the two last
  // days are not the same value.
  await insertConfession(db, {
    linkId: link.id,
    senderAccountId: sender.id,
    body: 'newer message',
    createdHour: new Date('2026-10-22T20:00:00Z'),
  })

  const stats = await getAdminStats(db, { now: NOW_DUBAI_2026_10_24, days: STATS_DAYS })

  assert.equal(stats.lastSignupDay, '2026-10-24')
  assert.equal(stats.lastMessageDay, '2026-10-23')

  await client.close()
})

// ---------------------------------------------------------------------------
// item 13: numbers are integers (spec section 3 item 13, section 1.1)
// ---------------------------------------------------------------------------

test('item 13: every number in the result is an integer', async () => {
  const { db, client } = await freshDb()

  const recipient = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-integer-recipient',
    displayName: 'w29-display-integer-recipient',
    createdAt: new Date('2026-10-22T19:00:00Z'),
  })
  const sender = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: 'w29-puid-integer-sender',
    displayName: 'w29-display-integer-sender',
    createdAt: new Date('2026-10-23T20:00:00Z'),
  })
  const link = await createLink(db, recipient.id)
  await insertConfession(db, {
    linkId: link.id,
    senderAccountId: sender.id,
    body: 'integer fixture',
    createdHour: new Date('2026-10-23T19:00:00Z'),
  })

  const stats = await getAdminStats(db, { now: NOW_DUBAI_2026_10_24, days: STATS_DAYS })

  // Non-zero leaves, so a bigint or a numeric string cannot hide behind
  // an all-zero object. The walk below covers the rest of the tree.
  assert.equal(stats.accounts.live, 2)
  assert.equal(stats.messages.total, 1)
  assert.equal(stats.messages.delivered, 1)
  assert.equal(stats.days.length, 14)
  assert.equal(stats.lastSignupDay, '2026-10-24')
  assert.equal(stats.lastMessageDay, '2026-10-23')
  assert.equal(stats.timeZone, 'Asia/Dubai')

  const seen: WalkSeen = { numbers: 0, strings: 0, nulls: 0 }
  visit(stats, null, 'result', seen)
  assert.equal(seen.numbers, SPEC_NUMBER_COUNT)
  // timeZone, 14 day strings, lastSignupDay, lastMessageDay.
  assert.equal(seen.strings, 17)
  assert.equal(seen.nulls, 0)

  await client.close()
})

// ---------------------------------------------------------------------------
// item 14: privacy (spec section 3 item 14, section 1.2)
// ---------------------------------------------------------------------------

test('item 14: the result contains no fixture uuid and no distinctive string', async () => {
  const { db, client } = await freshDb()
  const createdAt = new Date('2026-10-20T10:00:00Z')

  const displayRecipient = 'w29-display-recipient-plover'
  const displaySender = 'w29-display-sender-kestrel'
  const displayGoogle = 'w29-display-google-avocet'
  const displayDeleted = 'w29-display-deleted-curlew'
  const puidRecipient = 'w29-puid-recipient-plover'
  const puidSender = 'w29-puid-sender-kestrel'
  const puidGoogle = 'w29-puid-google-avocet'
  const puidDeleted = 'w29-puid-deleted-curlew'
  const slugLive = 'w29-slug-recipient-plover'
  const slugDeleted = 'w29-slug-deleted-curlew'
  const bodyReported = 'w29-body-reported-kestrel'
  const bodyOffered = 'w29-body-offered-kestrel'
  const bodyWithheld = 'w29-body-withheld-kestrel'
  const reason = 'w29-reason-report-kestrel'
  const question = 'w29-question-offer-kestrel'
  const stake = 'w29-stake-offer-kestrel'
  const recipientAnswer = 'w29-answer-recipient-kestrel'
  const senderAnswer = 'w29-answer-sender-kestrel'

  const recipient = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: puidRecipient,
    displayName: displayRecipient,
    createdAt,
  })
  const sender = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: puidSender,
    displayName: displaySender,
    createdAt,
  })
  const google = await insertAccount(db, {
    provider: 'google',
    providerUserId: puidGoogle,
    displayName: displayGoogle,
    createdAt,
  })
  const deleted = await insertAccount(db, {
    provider: 'facebook',
    providerUserId: puidDeleted,
    displayName: displayDeleted,
    createdAt,
  })
  const link = await createLink(db, recipient.id, { slug: slugLive })
  const deletedLink = await createLink(db, deleted.id, { slug: slugDeleted })

  const reported = await sendConfession(db, {
    senderAccountId: sender.id,
    linkSlug: link.slug,
    body: bodyReported,
  })
  const offered = await sendConfession(db, {
    senderAccountId: sender.id,
    linkSlug: link.slug,
    body: bodyOffered,
  })
  const offer = await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: offered.confessionId,
    questionForSender: question,
    stakePrompt: stake,
    recipientAnswer,
  })
  await acceptRevealOffer(db, {
    senderAccountId: sender.id,
    offerId: offer.offerId,
    senderAnswer,
  })
  await reportConfession(db, {
    reporterAccountId: recipient.id,
    confessionId: reported.confessionId,
    reason,
  })
  await blockSenderOfConfession(db, {
    recipientAccountId: recipient.id,
    confessionId: reported.confessionId,
  })
  const withheld = await sendConfession(db, {
    senderAccountId: sender.id,
    linkSlug: link.slug,
    body: bodyWithheld,
  })
  await deleteAccount(db, { accountId: deleted.id })

  const secrets = [
    displayRecipient,
    displaySender,
    displayGoogle,
    displayDeleted,
    '[deleted]',
    puidRecipient,
    puidSender,
    puidGoogle,
    puidDeleted,
    `deleted:${deleted.id}`,
    slugLive,
    slugDeleted,
    bodyReported,
    bodyOffered,
    bodyWithheld,
    reason,
    question,
    stake,
    recipientAnswer,
    senderAnswer,
    recipient.id,
    sender.id,
    google.id,
    deleted.id,
    link.id,
    deletedLink.id,
    reported.confessionId,
    offered.confessionId,
    offer.offerId,
    withheld.confessionId,
    ...(await collectUuids(client)),
  ]
  for (const secret of secrets) {
    assert.ok(secret.length >= 8, `secret too short to check: ${secret}`)
  }

  const stats = await getAdminStats(db, { now: NOW_DUBAI_2026_10_24, days: STATS_DAYS })
  const json = JSON.stringify(stats)
  for (const secret of secrets) {
    assert.equal(json.includes(secret), false, `result contains ${secret}`)
  }

  await client.close()
})

// ---------------------------------------------------------------------------
// item 15: page and nav (spec section 3 item 15, section 1.4)
// ---------------------------------------------------------------------------

test('item 15: the stats page exists and the admin layout links to it', () => {
  const pagePath = path.join(REPO_ROOT, 'app', 'admin', 'stats', 'page.tsx')
  assert.ok(existsSync(pagePath), 'app/admin/stats/page.tsx must exist')

  const layout = readFileSync(path.join(REPO_ROOT, 'app', 'admin', 'layout.tsx'), 'utf8')
  assert.match(layout, /href=["']\/admin\/stats["']/)
})
