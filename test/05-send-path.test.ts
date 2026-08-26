import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb } from './harness.js'
import { createAccount, createLink } from './fixtures.js'
import { confessions, linkBlocks } from '../src/schema.js'
import { sendConfession } from '../src/actions.js'
import { LinkDisabledError, PerLinkRateLimitExceededError, SenderAccountDisabledError } from '../src/errors.js'

test('4.5.19 disabled link: send rejected with the typed error', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db)
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id, { enabled: false })

  await assert.rejects(
    () => sendConfession(db, { senderAccountId: sender.id, linkSlug: link.slug, body: 'hello' }),
    LinkDisabledError,
  )

  await client.close()
})

test('4.5.20 blocked sender: sendConfession returns success and writes no row', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db)
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)

  await db.insert(linkBlocks).values({ linkId: link.id, blockedAccountId: sender.id })

  const before = await db.select().from(confessions)
  const result = await sendConfession(db, { senderAccountId: sender.id, linkSlug: link.slug, body: 'let me in' })
  const after = await db.select().from(confessions)

  assert.ok(result.confessionId, 'a blocked sender must still see a success-shaped result')
  assert.equal(before.length, after.length, 'row count must be unchanged — nothing written for a blocked sender')
  assert.equal(after.length, 0)

  await client.close()
})

test('4.5.21 rate limit: the 6th send to one link within an hour is rejected; a send to a different link in the same hour is allowed', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db)
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)
  const otherLink = await createLink(db, recipient.id)

  for (let i = 0; i < 5; i++) {
    await sendConfession(db, { senderAccountId: sender.id, linkSlug: link.slug, body: `msg ${i}` })
  }

  await assert.rejects(
    () => sendConfession(db, { senderAccountId: sender.id, linkSlug: link.slug, body: 'sixth' }),
    PerLinkRateLimitExceededError,
  )

  const otherResult = await sendConfession(db, {
    senderAccountId: sender.id,
    linkSlug: otherLink.slug,
    body: 'a different link, same hour',
  })
  assert.ok(otherResult.confessionId)

  await client.close()
})

test('4.5.22 disabled account: rejected', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db, { disabledAt: new Date() })
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)

  await assert.rejects(
    () => sendConfession(db, { senderAccountId: sender.id, linkSlug: link.slug, body: 'hello' }),
    SenderAccountDisabledError,
  )

  await client.close()
})
