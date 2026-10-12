import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { freshDb } from './harness.js'
import { createAccount, createLink } from './fixtures.js'
import {
  confessions,
  linkBlocks,
  reports,
  revealAnswers,
  revealOffers,
  sendCounters,
} from '../src/schema.js'
import {
  blockSenderOfConfession,
  hideConfession,
  openRevealOffer,
  reportConfession,
  sendConfession,
} from '../src/actions.js'
import {
  countSentForSender,
  countVisibleInboxForLink,
  getAdminInbox,
  getAdminInboxPage,
  getInboxForRecipient,
  getSentForSender,
} from '../src/views.js'
import { deleteAccount } from '../src/account-deletion.js'
import {
  ConfessionNotFoundError,
  LinkDisabledError,
  PerAccountRateLimitExceededError,
  PerLinkRateLimitExceededError,
  SenderAccountDisabledError,
} from '../src/errors.js'
import { PRIVACY_AR, PRIVACY_EN } from '../src/privacy.js'

test('item 1: migration creates withheld_messages with check and foreign key constraints', async () => {
  const { db, client } = await freshDb()
  const recipient = await createAccount(db)
  const sender = await createAccount(db)
  const link = await createLink(db, recipient.id)

  const columnsRes = await client.query<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'withheld_messages'",
  )
  const columnNames = new Set(columnsRes.rows.map((r) => r.column_name))
  for (const col of ['id', 'link_id', 'sender_account_id', 'body', 'created_hour']) {
    assert.ok(columnNames.has(col), `missing column ${col}`)
  }

  await assert.rejects(
    () =>
      client.query(
        'INSERT INTO withheld_messages (link_id, sender_account_id, body, created_hour) VALUES ($1, $2, $3, $4)',
        [link.id, sender.id, 'unaligned hour', '2026-10-12 12:34:56Z'],
      ),
    (err: Error) => /check/i.test(err.message) || /constraint/i.test(err.message) || /truncated/i.test(err.message),
  )

  await assert.rejects(
    () =>
      client.query(
        'INSERT INTO withheld_messages (link_id, sender_account_id, body, created_hour) VALUES ($1, $2, $3, $4)',
        [randomUUID(), sender.id, 'bad link', '2026-10-12 12:00:00Z'],
      ),
    (err: Error) => /foreign key/i.test(err.message) || /violates/i.test(err.message),
  )

  await assert.rejects(
    () =>
      client.query(
        'INSERT INTO withheld_messages (link_id, sender_account_id, body, created_hour) VALUES ($1, $2, $3, $4)',
        [link.id, randomUUID(), 'bad sender', '2026-10-12 12:00:00Z'],
      ),
    (err: Error) => /foreign key/i.test(err.message) || /violates/i.test(err.message),
  )

  const insertRes = await client.query<{ id: string }>(
    'INSERT INTO withheld_messages (link_id, sender_account_id, body, created_hour) VALUES ($1, $2, $3, $4) RETURNING id',
    [link.id, sender.id, 'valid row', '2026-10-12 12:00:00Z'],
  )
  assert.equal(insertRes.rows.length, 1)
  assert.ok(insertRes.rows[0]?.id)

  await client.close()
})

test('item 2: blocked send returns confessionId, writes no confessions row, and writes one withheld_messages row', async () => {
  const { db, client } = await freshDb()
  const recipient = await createAccount(db)
  const sender = await createAccount(db)
  const link = await createLink(db, recipient.id)

  await db.insert(linkBlocks).values({ linkId: link.id, blockedAccountId: sender.id })

  const beforeConfessions = await db.select().from(confessions)
  const beforeWithheld = await client.query<{ count: string }>('SELECT count(*) FROM withheld_messages')

  const body = 'blocked confession body'
  const result = await sendConfession(db, {
    senderAccountId: sender.id,
    linkSlug: link.slug,
    body,
  })

  assert.ok(result.confessionId)
  assert.match(
    result.confessionId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  )

  const afterConfessions = await db.select().from(confessions)
  assert.equal(afterConfessions.length, beforeConfessions.length)

  const afterWithheld = await client.query<{
    id: string
    link_id: string
    sender_account_id: string
    body: string
    created_hour: string
  }>('SELECT id, link_id, sender_account_id, body, created_hour FROM withheld_messages')
  assert.equal(afterWithheld.rows.length, Number(beforeWithheld.rows[0]?.count ?? 0) + 1)

  const row = afterWithheld.rows.find((r) => r.id === result.confessionId)
  assert.ok(row, 'withheld_messages row id must match returned confessionId')
  if (!row) return
  assert.equal(row.link_id, link.id)
  assert.equal(row.sender_account_id, sender.id)
  assert.equal(row.body, body)

  const date = new Date(row.created_hour)
  assert.equal(date.getUTCMinutes(), 0)
  assert.equal(date.getUTCSeconds(), 0)
  assert.equal(date.getUTCMilliseconds(), 0)

  const hourCheck = await client.query<{ is_truncated: boolean }>(
    'SELECT (created_hour = date_trunc(\'hour\', created_hour)) AS is_truncated FROM withheld_messages WHERE id = $1',
    [result.confessionId],
  )
  assert.equal(hourCheck.rows[0]?.is_truncated, true)

  await client.close()
})

test('item 3: sender view parity for blocked sender and control in getSentForSender and countSentForSender', async () => {
  const { db, client } = await freshDb()
  const recipient = await createAccount(db, { displayName: 'Link Owner' })
  const link = await createLink(db, recipient.id)
  const blockedSender = await createAccount(db)
  const controlSender = await createAccount(db)

  await db.insert(linkBlocks).values({ linkId: link.id, blockedAccountId: blockedSender.id })

  const blockedSentBefore = await getSentForSender(db, { senderAccountId: blockedSender.id })
  const controlSentBefore = await getSentForSender(db, { senderAccountId: controlSender.id })
  const blockedCountBefore = await countSentForSender(db, { senderAccountId: blockedSender.id })
  const controlCountBefore = await countSentForSender(db, { senderAccountId: controlSender.id })

  const blockedResult = await sendConfession(db, {
    senderAccountId: blockedSender.id,
    linkSlug: link.slug,
    body: 'message from blocked sender',
  })
  const controlResult = await sendConfession(db, {
    senderAccountId: controlSender.id,
    linkSlug: link.slug,
    body: 'message from control sender',
  })

  const blockedSentAfter = await getSentForSender(db, { senderAccountId: blockedSender.id })
  const controlSentAfter = await getSentForSender(db, { senderAccountId: controlSender.id })
  const blockedCountAfter = await countSentForSender(db, { senderAccountId: blockedSender.id })
  const controlCountAfter = await countSentForSender(db, { senderAccountId: controlSender.id })

  assert.equal(blockedSentAfter.length, blockedSentBefore.length + 1)
  assert.equal(controlSentAfter.length, controlSentBefore.length + 1)

  assert.equal(blockedCountAfter, blockedCountBefore + 1)
  assert.equal(controlCountAfter, controlCountBefore + 1)

  const blockedEntry = blockedSentAfter[0]
  const controlEntry = controlSentAfter[0]
  assert.ok(blockedEntry)
  assert.ok(controlEntry)
  if (!blockedEntry || !controlEntry) return

  assert.deepEqual(Object.keys(blockedEntry).sort(), Object.keys(controlEntry).sort())
  assert.deepEqual(blockedEntry.offer, { kind: 'none' })
  assert.deepEqual(controlEntry.offer, { kind: 'none' })
  assert.equal(blockedEntry.recipientDisplayName, recipient.displayName)
  assert.equal(controlEntry.recipientDisplayName, recipient.displayName)
  assert.equal(blockedEntry.confessionId, blockedResult.confessionId)
  assert.equal(controlEntry.confessionId, controlResult.confessionId)

  await client.close()
})

test('item 4: ordering interleaves delivered and withheld messages by createdHour desc, then confessionId asc', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db)
  const owner1 = await createAccount(db, { displayName: 'Owner Delivered' })
  const owner2 = await createAccount(db, { displayName: 'Owner Blocked' })
  const linkDelivered = await createLink(db, owner1.id)
  const linkBlocked = await createLink(db, owner2.id)

  await db.insert(linkBlocks).values({ linkId: linkBlocked.id, blockedAccountId: sender.id })

  const idDeliv12 = '00000000-0000-0000-0000-000000000012'
  const idWithheld11 = '00000000-0000-0000-0000-000000000011'
  const idDeliv10 = '00000000-0000-0000-0000-000000000010'
  const idWithheld10 = '00000000-0000-0000-0000-000000000020'
  const idWithheld09 = '00000000-0000-0000-0000-000000000009'
  const idDeliv09 = '00000000-0000-0000-0000-000000000019'
  const idDeliv08 = '00000000-0000-0000-0000-000000000008'

  await client.query(
    'INSERT INTO confessions (id, link_id, sender_account_id, body, created_hour) VALUES ($1, $2, $3, $4, $5)',
    [idDeliv12, linkDelivered.id, sender.id, 'deliv 12', '2026-10-12 12:00:00Z'],
  )
  await client.query(
    'INSERT INTO confessions (id, link_id, sender_account_id, body, created_hour) VALUES ($1, $2, $3, $4, $5)',
    [idDeliv10, linkDelivered.id, sender.id, 'deliv 10', '2026-10-12 10:00:00Z'],
  )
  await client.query(
    'INSERT INTO confessions (id, link_id, sender_account_id, body, created_hour) VALUES ($1, $2, $3, $4, $5)',
    [idDeliv09, linkDelivered.id, sender.id, 'deliv 09', '2026-10-12 09:00:00Z'],
  )
  await client.query(
    'INSERT INTO confessions (id, link_id, sender_account_id, body, created_hour) VALUES ($1, $2, $3, $4, $5)',
    [idDeliv08, linkDelivered.id, sender.id, 'deliv 08', '2026-10-12 08:00:00Z'],
  )

  await client.query(
    'INSERT INTO withheld_messages (id, link_id, sender_account_id, body, created_hour) VALUES ($1, $2, $3, $4, $5)',
    [idWithheld11, linkBlocked.id, sender.id, 'withheld 11', '2026-10-12 11:00:00Z'],
  )
  await client.query(
    'INSERT INTO withheld_messages (id, link_id, sender_account_id, body, created_hour) VALUES ($1, $2, $3, $4, $5)',
    [idWithheld10, linkBlocked.id, sender.id, 'withheld 10', '2026-10-12 10:00:00Z'],
  )
  await client.query(
    'INSERT INTO withheld_messages (id, link_id, sender_account_id, body, created_hour) VALUES ($1, $2, $3, $4, $5)',
    [idWithheld09, linkBlocked.id, sender.id, 'withheld 09', '2026-10-12 09:00:00Z'],
  )

  const list = await getSentForSender(db, { senderAccountId: sender.id })
  assert.equal(list.length, 7)

  const expectedOrder = [
    idDeliv12,
    idWithheld11,
    idDeliv10,
    idWithheld10,
    idWithheld09,
    idDeliv09,
    idDeliv08,
  ]
  assert.deepEqual(
    list.map((c) => c.confessionId),
    expectedOrder,
  )

  assert.equal(list[0]?.recipientDisplayName, owner1.displayName)
  assert.equal(list[1]?.recipientDisplayName, owner2.displayName)
  assert.equal(list[2]?.recipientDisplayName, owner1.displayName)
  assert.equal(list[3]?.recipientDisplayName, owner2.displayName)
  assert.equal(list[4]?.recipientDisplayName, owner2.displayName)
  assert.equal(list[5]?.recipientDisplayName, owner1.displayName)
  assert.equal(list[6]?.recipientDisplayName, owner1.displayName)

  await client.close()
})

test('item 5: per-link limit parity refuses blocked sender on 6th send in hour', async () => {
  const { db, client } = await freshDb()
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)
  const blockedSender = await createAccount(db)
  const controlSender = await createAccount(db)

  await sendConfession(db, { senderAccountId: blockedSender.id, linkSlug: link.slug, body: 'before block 1' })
  await sendConfession(db, { senderAccountId: blockedSender.id, linkSlug: link.slug, body: 'before block 2' })

  await db.insert(linkBlocks).values({ linkId: link.id, blockedAccountId: blockedSender.id })

  for (let i = 3; i <= 5; i++) {
    await sendConfession(db, { senderAccountId: blockedSender.id, linkSlug: link.slug, body: `after block ${i}` })
  }

  for (let i = 1; i <= 5; i++) {
    await sendConfession(db, { senderAccountId: controlSender.id, linkSlug: link.slug, body: `control ${i}` })
  }

  await assert.rejects(
    () => sendConfession(db, { senderAccountId: controlSender.id, linkSlug: link.slug, body: 'control 6' }),
    PerLinkRateLimitExceededError,
  )

  await assert.rejects(
    () => sendConfession(db, { senderAccountId: blockedSender.id, linkSlug: link.slug, body: 'blocked 6' }),
    PerLinkRateLimitExceededError,
  )

  await client.close()
})

test('item 6: daily limit parity refuses blocked sender when account is at 30 sends today', async () => {
  const { db, client } = await freshDb()
  const recipient = await createAccount(db)
  const targetLink = await createLink(db, recipient.id)
  const blockedSender = await createAccount(db)
  const controlSender = await createAccount(db)

  await db.insert(linkBlocks).values({ linkId: targetLink.id, blockedAccountId: blockedSender.id })

  const otherOwner = await createAccount(db)
  for (let i = 0; i < 6; i++) {
    const otherLink = await createLink(db, otherOwner.id)
    await db.insert(sendCounters).values({
      senderAccountId: blockedSender.id,
      linkId: otherLink.id,
      windowHour: sql`date_trunc('hour', now())`,
      count: 5,
    })
    await db.insert(sendCounters).values({
      senderAccountId: controlSender.id,
      linkId: otherLink.id,
      windowHour: sql`date_trunc('hour', now())`,
      count: 5,
    })
  }

  await assert.rejects(
    () => sendConfession(db, { senderAccountId: controlSender.id, linkSlug: targetLink.slug, body: 'control day limit' }),
    PerAccountRateLimitExceededError,
  )

  await assert.rejects(
    () => sendConfession(db, { senderAccountId: blockedSender.id, linkSlug: targetLink.slug, body: 'blocked day limit' }),
    PerAccountRateLimitExceededError,
  )

  await client.close()
})

test('item 7: blocked sender whose account is disabled or deleted gets SenderAccountDisabledError and writes nothing', async () => {
  const { db, client } = await freshDb()
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)

  const disabledSender = await createAccount(db, { disabledAt: new Date() })
  await db.insert(linkBlocks).values({ linkId: link.id, blockedAccountId: disabledSender.id })

  await assert.rejects(
    () => sendConfession(db, { senderAccountId: disabledSender.id, linkSlug: link.slug, body: 'from disabled' }),
    SenderAccountDisabledError,
  )

  const deletedSender = await createAccount(db)
  await db.insert(linkBlocks).values({ linkId: link.id, blockedAccountId: deletedSender.id })
  await deleteAccount(db, { accountId: deletedSender.id })

  await assert.rejects(
    () => sendConfession(db, { senderAccountId: deletedSender.id, linkSlug: link.slug, body: 'from deleted' }),
    SenderAccountDisabledError,
  )

  const confRows = await db.select().from(confessions)
  assert.equal(confRows.length, 0)

  const withheldRes = await client.query<{ count: string }>('SELECT count(*) FROM withheld_messages')
  assert.equal(Number(withheldRes.rows[0]?.count ?? 0), 0)

  await client.close()
})

test('item 8: blocked sender on disabled link gets LinkDisabledError', async () => {
  const { db, client } = await freshDb()
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id, { enabled: false })
  const sender = await createAccount(db)

  await db.insert(linkBlocks).values({ linkId: link.id, blockedAccountId: sender.id })

  await assert.rejects(
    () => sendConfession(db, { senderAccountId: sender.id, linkSlug: link.slug, body: 'blocked on disabled link' }),
    LinkDisabledError,
  )

  await client.close()
})

test('item 9: recipient never sees withheld message in inbox, inbox count, or admin views', async () => {
  const { db, client } = await freshDb()
  const owner = await createAccount(db)
  const sender = await createAccount(db)
  const link = await createLink(db, owner.id)

  await db.insert(linkBlocks).values({ linkId: link.id, blockedAccountId: sender.id })

  const initialCount = await countVisibleInboxForLink(db, { linkId: link.id })
  const initialInbox = await getInboxForRecipient(db, { linkId: link.id, viewerAccountId: owner.id })
  assert.equal(initialCount, 0)
  assert.equal(initialInbox.length, 0)

  const body = 'never to be seen by recipient'
  const result = await sendConfession(db, {
    senderAccountId: sender.id,
    linkSlug: link.slug,
    body,
  })

  const inbox = await getInboxForRecipient(db, { linkId: link.id, viewerAccountId: owner.id })
  assert.equal(inbox.some((c) => c.id === result.confessionId || c.body === body), false)

  const count = await countVisibleInboxForLink(db, { linkId: link.id })
  assert.equal(count, initialCount)

  const adminInbox = await getAdminInbox(db, { adminAccountId: owner.id })
  assert.equal(adminInbox.some((c) => c.id === result.confessionId || c.body === body), false)

  const adminPage = await getAdminInboxPage(db, { limit: 50, offset: 0 })
  assert.equal(adminPage.some((c) => c.id === result.confessionId || c.body === body), false)

  await client.close()
})

test('item 10: owner actions cannot address withheld id and leave database rows unchanged', async () => {
  const { db, client } = await freshDb()
  const owner = await createAccount(db)
  const blockedSender = await createAccount(db)
  const controlSender = await createAccount(db)
  const link = await createLink(db, owner.id)

  await sendConfession(db, {
    senderAccountId: controlSender.id,
    linkSlug: link.slug,
    body: 'control confession',
  })

  await db.insert(linkBlocks).values({ linkId: link.id, blockedAccountId: blockedSender.id })

  const sendResult = await sendConfession(db, {
    senderAccountId: blockedSender.id,
    linkSlug: link.slug,
    body: 'blocked attempt',
  })
  const withheldId = sendResult.confessionId

  const beforeConfessions = await db.select().from(confessions)
  const beforeReports = await db.select().from(reports)
  const beforeBlocks = await db.select().from(linkBlocks)
  const beforeOffers = await db.select().from(revealOffers)
  const beforeAnswers = await db.select().from(revealAnswers)

  await assert.rejects(
    () => hideConfession(db, { recipientAccountId: owner.id, confessionId: withheldId }),
    ConfessionNotFoundError,
  )

  await assert.rejects(
    () => reportConfession(db, { reporterAccountId: owner.id, confessionId: withheldId, reason: 'unwanted content' }),
    ConfessionNotFoundError,
  )

  await assert.rejects(
    () => blockSenderOfConfession(db, { recipientAccountId: owner.id, confessionId: withheldId }),
    ConfessionNotFoundError,
  )

  await assert.rejects(
    () =>
      openRevealOffer(db, {
        recipientAccountId: owner.id,
        confessionId: withheldId,
        questionForSender: 'question?',
        stakePrompt: 'prompt',
        recipientAnswer: 'answer',
      }),
  )

  const afterConfessions = await db.select().from(confessions)
  const afterReports = await db.select().from(reports)
  const afterBlocks = await db.select().from(linkBlocks)
  const afterOffers = await db.select().from(revealOffers)
  const afterAnswers = await db.select().from(revealAnswers)

  assert.equal(afterConfessions.length, beforeConfessions.length)
  assert.equal(afterReports.length, beforeReports.length)
  assert.equal(afterBlocks.length, beforeBlocks.length)
  assert.equal(afterOffers.length, beforeOffers.length)
  assert.equal(afterAnswers.length, beforeAnswers.length)

  await client.close()
})

test('item 11: privacy contract names withheld_messages alongside confessions with unchanged text', () => {
  const EXPECTED_TEXT_AR = 'نص كل رسالة، ومين بعتها ولمين، والساعة يلي انبعتت فيها (مش الدقيقة بالظبط).'
  const EXPECTED_TEXT_EN = 'The text of each message, who sent it and to whom, and the hour it was sent (not the exact minute).'

  const arItem = PRIVACY_AR.stored.find((item) => item.tables.includes('confessions'))
  assert.ok(arItem, 'PRIVACY_AR must contain an item naming confessions')
  if (!arItem) return
  assert.ok(
    arItem.tables.includes('withheld_messages'),
    'PRIVACY_AR item naming confessions must also name withheld_messages',
  )
  assert.equal(arItem.text, EXPECTED_TEXT_AR)

  const enItem = PRIVACY_EN.stored.find((item) => item.tables.includes('confessions'))
  assert.ok(enItem, 'PRIVACY_EN must contain an item naming confessions')
  if (!enItem) return
  assert.ok(
    enItem.tables.includes('withheld_messages'),
    'PRIVACY_EN item naming confessions must also name withheld_messages',
  )
  assert.equal(enItem.text, EXPECTED_TEXT_EN)
})
