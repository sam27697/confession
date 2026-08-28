import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { freshDb } from './harness.js'
import { createAccount, createLink, createConfession } from './fixtures.js'
import { revealAnswers, revealOffers } from '../src/schema.js'
import { getInboxForRecipient, getPendingOfferForSender } from '../src/views.js'
import { acceptRevealOffer, declineRevealOffer, openRevealOffer } from '../src/actions.js'
import { NotYourConfessionError } from '../src/errors.js'

async function setupOffer(db: Awaited<ReturnType<typeof freshDb>>['db']) {
  const sender = await createAccount(db, { displayName: 'The Real Sender' })
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)
  const confession = await createConfession(db, { linkId: link.id, senderAccountId: sender.id, body: 'mystery message' })
  return { sender, recipient, link, confession }
}

test('4.4.10 an offer cannot be committed without the recipient answer (deferred constraint trigger fires at COMMIT)', async () => {
  const { db, client } = await freshDb()
  const { confession } = await setupOffer(db)

  await assert.rejects(
    () =>
      db.transaction(async (tx) => {
        await tx.insert(revealOffers).values({
          confessionId: confession.id,
          questionForSender: 'مين إنت؟',
          stakePrompt: 'بحكيلك سر عني',
        })
        // deliberately no reveal_answers insert here
      }),
    /recipient answer|reveal_offers/,
  )

  const offers = await db.select().from(revealOffers)
  assert.equal(offers.length, 0, 'the offer must not exist after the transaction rolled back at commit')

  await client.close()
})

test('4.4.11 getPendingOfferForSender while pending: JSON.stringify contains neither answer body', async () => {
  const { db, client } = await freshDb()
  const { sender, recipient, confession } = await setupOffer(db)

  const recipientAnswerSecret = 'RECIPIENT-SECRET-ANSWER-XYZ'
  const { offerId } = await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: confession.id,
    questionForSender: 'مين إنت بالحقيقة؟',
    stakePrompt: 'أنا كمان رح احكيلك شي صريح عني',
    recipientAnswer: recipientAnswerSecret,
  })

  const pendingOffer = await getPendingOfferForSender(db, { offerId, senderAccountId: sender.id })
  const json = JSON.stringify(pendingOffer)
  assert.ok(!json.includes(recipientAnswerSecret), 'sender must not see the recipient answer while pending')
  assert.equal(pendingOffer.state, 'pending')

  await client.close()
})

test("4.4.12 recipient's view while pending does not contain the sender's answer body, uuid or display name", async () => {
  const { db, client } = await freshDb()
  const { sender, recipient, link, confession } = await setupOffer(db)

  await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: confession.id,
    questionForSender: 'مين إنت؟',
    stakePrompt: 'رح احكيلك سر',
    recipientAnswer: 'my staked answer',
  })

  const inbox = await getInboxForRecipient(db, { linkId: link.id, viewerAccountId: recipient.id })
  const json = JSON.stringify(inbox)
  assert.ok(!json.includes(sender.id))
  assert.ok(!json.includes(sender.displayName))
  assert.equal(inbox[0].reveal.kind, 'offered')
  if (inbox[0].reveal.kind === 'offered') {
    assert.equal(inbox[0].reveal.state, 'pending')
  }

  await client.close()
})

test('4.4.13 accept: both answers and the sender identity appear for that confession, in the recipient view, after resolution', async () => {
  const { db, client } = await freshDb()
  const { sender, recipient, link, confession } = await setupOffer(db)

  const recipientAnswer = 'recipient staked answer'
  const senderAnswer = 'sender honest answer'

  const { offerId } = await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: confession.id,
    questionForSender: 'مين إنت؟',
    stakePrompt: 'رح احكيلك سر',
    recipientAnswer,
  })

  await acceptRevealOffer(db, { senderAccountId: sender.id, offerId, senderAnswer })

  const inbox = await getInboxForRecipient(db, { linkId: link.id, viewerAccountId: recipient.id })
  assert.equal(inbox.length, 1)
  const reveal = inbox[0].reveal
  assert.equal(reveal.kind, 'resolved')
  if (reveal.kind === 'resolved') {
    assert.equal(reveal.senderDisplayName, sender.displayName)
    assert.equal(reveal.senderProviderUserId, sender.providerUserId)
    assert.equal(reveal.senderAnswer, senderAnswer)
    assert.equal(reveal.recipientAnswer, recipientAnswer)
  }

  await client.close()
})

test('4.4.14 a second confession from the same sender in the same inbox stays masked after the first is resolved', async () => {
  const { db, client } = await freshDb()
  const { sender, recipient, link, confession: firstConfession } = await setupOffer(db)
  const secondConfession = await createConfession(db, {
    linkId: link.id,
    senderAccountId: sender.id,
    body: 'a second, unrelated confession',
  })

  const { offerId } = await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: firstConfession.id,
    questionForSender: 'مين إنت؟',
    stakePrompt: 'رح احكيلك سر',
    recipientAnswer: 'staked answer',
  })
  await acceptRevealOffer(db, { senderAccountId: sender.id, offerId, senderAnswer: 'honest answer' })

  const inbox = await getInboxForRecipient(db, { linkId: link.id, viewerAccountId: recipient.id })
  const first = inbox.find((c) => c.id === firstConfession.id)!
  const second = inbox.find((c) => c.id === secondConfession.id)!

  assert.equal(first.reveal.kind, 'resolved')
  assert.equal(second.reveal.kind, 'none')

  const secondJson = JSON.stringify(second)
  assert.ok(!secondJson.includes(sender.id))
  assert.ok(!secondJson.includes(sender.displayName))

  await client.close()
})

test("4.4.15 decline: terminal, recipient's view reveals nothing, her staked answer is not shown to the sender", async () => {
  const { db, client } = await freshDb()
  const { sender, recipient, link, confession } = await setupOffer(db)

  const recipientAnswerSecret = 'never-shown-to-sender'
  const { offerId } = await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: confession.id,
    questionForSender: 'مين إنت؟',
    stakePrompt: 'رح احكيلك سر',
    recipientAnswer: recipientAnswerSecret,
  })

  await declineRevealOffer(db, { senderAccountId: sender.id, offerId })

  const inbox = await getInboxForRecipient(db, { linkId: link.id, viewerAccountId: recipient.id })
  const reveal = inbox[0].reveal
  assert.equal(reveal.kind, 'offered')
  if (reveal.kind === 'offered') assert.equal(reveal.state, 'declined')

  // The sender has no function surface that ever returns the recipient's
  // staked answer, pending or not. After decline, the offer is no longer
  // pending, so even the "no answer bodies" pending-offer read for the
  // sender must refuse to serve it at all.
  await assert.rejects(() => getPendingOfferForSender(db, { offerId, senderAccountId: sender.id }))

  const senderSideAnswers = await db.select().from(revealAnswers).where(eq(revealAnswers.offerId, offerId))
  assert.ok(
    senderSideAnswers.every((a) => a.side !== 'sender'),
    'declining must never write a sender answer row',
  )

  await client.close()
})

test('4.4.16 UPDATE on a reveal_answers row raises. DELETE raises.', async () => {
  const { db, client } = await freshDb()
  const { recipient, confession } = await setupOffer(db)

  const { offerId } = await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: confession.id,
    questionForSender: 'مين إنت؟',
    stakePrompt: 'رح احكيلك سر',
    recipientAnswer: 'original answer',
  })

  await assert.rejects(() =>
    db.update(revealAnswers).set({ body: 'rewritten' }).where(eq(revealAnswers.offerId, offerId)),
  )
  await assert.rejects(() => db.delete(revealAnswers).where(eq(revealAnswers.offerId, offerId)))

  await client.close()
})

test('4.4.17 illegal transitions raise: resolved -> anything, declined -> anything, cancelled -> resolved', async () => {
  const { db, client } = await freshDb()

  // resolved -> anything
  {
    const { sender, recipient, confession } = await setupOffer(db)
    const { offerId } = await openRevealOffer(db, {
      recipientAccountId: recipient.id,
      confessionId: confession.id,
      questionForSender: 'q',
      stakePrompt: 's',
      recipientAnswer: 'a',
    })
    await acceptRevealOffer(db, { senderAccountId: sender.id, offerId, senderAnswer: 'a2' })
    await assert.rejects(() => db.update(revealOffers).set({ state: 'pending' }).where(eq(revealOffers.id, offerId)))
    await assert.rejects(() => db.update(revealOffers).set({ state: 'declined' }).where(eq(revealOffers.id, offerId)))
  }

  // declined -> anything
  {
    const { sender, recipient, confession } = await setupOffer(db)
    const { offerId } = await openRevealOffer(db, {
      recipientAccountId: recipient.id,
      confessionId: confession.id,
      questionForSender: 'q',
      stakePrompt: 's',
      recipientAnswer: 'a',
    })
    await declineRevealOffer(db, { senderAccountId: sender.id, offerId })
    await assert.rejects(() => db.update(revealOffers).set({ state: 'resolved' }).where(eq(revealOffers.id, offerId)))
    await assert.rejects(() => db.update(revealOffers).set({ state: 'pending' }).where(eq(revealOffers.id, offerId)))
  }

  // cancelled -> resolved (cancel has no app-level function; exercised directly against the trigger)
  {
    const { recipient, confession } = await setupOffer(db)
    const { offerId } = await openRevealOffer(db, {
      recipientAccountId: recipient.id,
      confessionId: confession.id,
      questionForSender: 'q',
      stakePrompt: 's',
      recipientAnswer: 'a',
    })
    await db.update(revealOffers).set({ state: 'cancelled' }).where(eq(revealOffers.id, offerId))
    await assert.rejects(() => db.update(revealOffers).set({ state: 'resolved' }).where(eq(revealOffers.id, offerId)))
  }

  await client.close()
})

test("4.4.18 accepting an offer on someone else's confession raises", async () => {
  const { db, client } = await freshDb()
  const { recipient, confession } = await setupOffer(db)
  const impostor = await createAccount(db)

  const { offerId } = await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: confession.id,
    questionForSender: 'q',
    stakePrompt: 's',
    recipientAnswer: 'a',
  })

  await assert.rejects(
    () => acceptRevealOffer(db, { senderAccountId: impostor.id, offerId, senderAnswer: 'not mine to answer' }),
    NotYourConfessionError,
  )

  await client.close()
})
