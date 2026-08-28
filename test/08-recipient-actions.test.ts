import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb } from './harness.js'
import { createAccount, createLink, createConfession } from './fixtures.js'
import { confessions } from '../src/schema.js'
import { blockSenderOfConfession, hideConfession, reportConfession, sendConfession } from '../src/actions.js'
import { ViewerNotLinkOwnerError } from '../src/errors.js'

async function setup(db: Awaited<ReturnType<typeof freshDb>>['db']) {
  const sender = await createAccount(db)
  const recipient = await createAccount(db)
  const impostor = await createAccount(db)
  const link = await createLink(db, recipient.id)
  const confession = await createConfession(db, { linkId: link.id, senderAccountId: sender.id })
  return { sender, recipient, impostor, link, confession }
}

test('§4.2 blockSenderOfConfession rejects a caller who does not own the confession\'s link', async () => {
  const { db, client } = await freshDb()
  const { impostor, confession } = await setup(db)

  await assert.rejects(
    () => blockSenderOfConfession(db, { recipientAccountId: impostor.id, confessionId: confession.id }),
    ViewerNotLinkOwnerError,
  )

  await client.close()
})

test('§4.2 reportConfession rejects a caller who does not own the confession\'s link', async () => {
  const { db, client } = await freshDb()
  const { impostor, confession } = await setup(db)

  await assert.rejects(
    () => reportConfession(db, { reporterAccountId: impostor.id, confessionId: confession.id, reason: 'not my call to make' }),
    ViewerNotLinkOwnerError,
  )

  await client.close()
})

test('§4.2 hideConfession rejects a caller who does not own the confession\'s link', async () => {
  const { db, client } = await freshDb()
  const { impostor, confession } = await setup(db)

  await assert.rejects(
    () => hideConfession(db, { recipientAccountId: impostor.id, confessionId: confession.id }),
    ViewerNotLinkOwnerError,
  )

  await client.close()
})

test('§4.2 blockSenderOfConfession returns undefined — the sender\'s id must never be in the return value', async () => {
  const { db, client } = await freshDb()
  const { recipient, confession } = await setup(db)

  const result = await blockSenderOfConfession(db, { recipientAccountId: recipient.id, confessionId: confession.id })
  assert.equal(result, undefined)

  await client.close()
})

test('§4.2 blocking twice is not an error (ON CONFLICT DO NOTHING) and still returns undefined', async () => {
  const { db, client } = await freshDb()
  const { recipient, confession } = await setup(db)

  await blockSenderOfConfession(db, { recipientAccountId: recipient.id, confessionId: confession.id })
  const second = await blockSenderOfConfession(db, { recipientAccountId: recipient.id, confessionId: confession.id })
  assert.equal(second, undefined)

  await client.close()
})

test('§4.2/§2 a blocked sender\'s subsequent send writes no confessions row, while sendConfession still returns a success-shaped result', async () => {
  const { db, client } = await freshDb()
  const { sender, recipient, link, confession } = await setup(db)

  await blockSenderOfConfession(db, { recipientAccountId: recipient.id, confessionId: confession.id })

  const before = await db.select().from(confessions)
  const result = await sendConfession(db, { senderAccountId: sender.id, linkSlug: link.slug, body: 'let me back in' })
  const after = await db.select().from(confessions)

  assert.ok(result.confessionId, 'a blocked sender must still see a success-shaped result')
  assert.equal(after.length, before.length, 'row count is unchanged — nothing written for a blocked sender')

  await client.close()
})
