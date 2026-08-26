import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sql } from 'drizzle-orm'
import { freshDb } from './harness.js'
import { createAccount, createLink, createConfession } from './fixtures.js'
import { adminRevealLog, confessions } from '../src/schema.js'
import { getInboxForRecipient, getAdminInbox } from '../src/views.js'
import { adminReveal } from '../src/actions.js'
import { ViewerNotLinkOwnerError } from '../src/errors.js'

test('4.3.3 created_hour CHECK rejects a non-truncated timestamp', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db)
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)

  await assert.rejects(
    () =>
      db.insert(confessions).values({
        linkId: link.id,
        senderAccountId: sender.id,
        body: 'not truncated',
        createdHour: sql`now()`, // e.g. 14:32:07.123 — not on the hour
      }),
    (err: unknown) => {
      const cause = err instanceof Error ? err.cause : undefined
      const constraintName = cause && typeof cause === 'object' ? (cause as { constraint?: string }).constraint : undefined
      assert.equal(constraintName, 'confessions_created_hour_truncated_check')
      return true
    },
  )

  await client.close()
})

test('4.3.4 sender_account_id NOT NULL is enforced', async () => {
  const { db, client } = await freshDb()
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)

  await assert.rejects(() =>
    db.execute(sql`
      insert into ${confessions} (link_id, body, created_hour)
      values (${link.id}, 'no sender', date_trunc('hour', now()))
    `),
  )

  await client.close()
})

test("4.3.5 getInboxForRecipient output contains neither the sender's account uuid nor display name, for an unresolved confession", async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db, { displayName: 'Secret Sender Name' })
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)
  await createConfession(db, { linkId: link.id, senderAccountId: sender.id, body: 'hi there' })

  const inbox = await getInboxForRecipient(db, { linkId: link.id, viewerAccountId: recipient.id })
  assert.equal(inbox.length, 1)

  const json = JSON.stringify(inbox)
  assert.ok(!json.includes(sender.id), 'recipient payload must not contain the sender account uuid')
  assert.ok(!json.includes(sender.displayName), 'recipient payload must not contain the sender display name')
  assert.equal(inbox[0].reveal.kind, 'none')

  await client.close()
})

test('4.3.6 getAdminInbox output: same absence assertions. Masked by default.', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db, { displayName: 'Secret Sender Name' })
  const recipient = await createAccount(db)
  const admin = await createAccount(db)
  const link = await createLink(db, recipient.id)
  await createConfession(db, { linkId: link.id, senderAccountId: sender.id, body: 'admin-view test' })

  const inbox = await getAdminInbox(db, { adminAccountId: admin.id })
  assert.equal(inbox.length, 1)
  assert.equal(inbox[0].senderMasked, true)

  const json = JSON.stringify(inbox)
  assert.ok(!json.includes(sender.id), 'admin default listing must not contain the sender account uuid')
  assert.ok(!json.includes(sender.displayName), 'admin default listing must not contain the sender display name')

  await client.close()
})

test('4.3.7 adminReveal returns the identity and writes exactly one log row with the reason; a blank/whitespace/7-char reason raises and writes nothing', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db, { displayName: 'Revealed Name' })
  const recipient = await createAccount(db)
  const admin = await createAccount(db)
  const link = await createLink(db, recipient.id)
  const confession = await createConfession(db, { linkId: link.id, senderAccountId: sender.id })

  const revealed = await adminReveal(db, {
    adminAccountId: admin.id,
    confessionId: confession.id,
    reason: 'reported for harassment',
  })

  assert.equal(revealed.senderAccountId, sender.id)
  assert.equal(revealed.senderDisplayName, sender.displayName)
  assert.equal(revealed.confessionId, confession.id)

  const logRows = await db.select().from(adminRevealLog)
  assert.equal(logRows.length, 1)
  assert.equal(logRows[0].reason, 'reported for harassment')

  for (const badReason of ['', '   ', '1234567']) {
    await assert.rejects(() =>
      adminReveal(db, { adminAccountId: admin.id, confessionId: confession.id, reason: badReason }),
    )
  }

  const logRowsAfter = await db.select().from(adminRevealLog)
  assert.equal(logRowsAfter.length, 1, 'a rejected reveal must write no log row')

  await client.close()
})

test('4.3.8 UPDATE on admin_reveal_log raises. DELETE raises.', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db)
  const recipient = await createAccount(db)
  const admin = await createAccount(db)
  const link = await createLink(db, recipient.id)
  const confession = await createConfession(db, { linkId: link.id, senderAccountId: sender.id })

  await adminReveal(db, { adminAccountId: admin.id, confessionId: confession.id, reason: 'valid reason here' })

  await assert.rejects(() => db.update(adminRevealLog).set({ reason: 'edited' }))
  await assert.rejects(() => db.delete(adminRevealLog))

  await client.close()
})

test('4.3.9 getInboxForRecipient throws when the viewer does not own the link', async () => {
  const { db, client } = await freshDb()
  const recipient = await createAccount(db)
  const impostor = await createAccount(db)
  const link = await createLink(db, recipient.id)

  await assert.rejects(
    () => getInboxForRecipient(db, { linkId: link.id, viewerAccountId: impostor.id }),
    ViewerNotLinkOwnerError,
  )

  await client.close()
})
