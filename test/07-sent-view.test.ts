import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb } from './harness.js'
import { createAccount, createLink, createConfession } from './fixtures.js'
import { getSentForSender } from '../src/views.js'
import { acceptRevealOffer, declineRevealOffer, openRevealOffer } from '../src/actions.js'

test('§4.2 getSentForSender: a confession with no offer reports kind "none"', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db)
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)
  await createConfession(db, { linkId: link.id, senderAccountId: sender.id, body: 'plain confession' })

  const sent = await getSentForSender(db, { senderAccountId: sender.id })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].offer.kind, 'none')
  assert.equal(sent[0].recipientDisplayName, recipient.displayName)

  await client.close()
})

test('§4.2 getSentForSender: a pending offer\'s recipient answer is absent from JSON.stringify — she stakes sight unseen', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db)
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)
  const confession = await createConfession(db, { linkId: link.id, senderAccountId: sender.id })

  const recipientAnswerSecret = 'PENDING-STAKE-SECRET-DO-NOT-LEAK'
  await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: confession.id,
    questionForSender: 'مين إنت؟',
    stakePrompt: 'رح احكيلك سر',
    recipientAnswer: recipientAnswerSecret,
  })

  const sent = await getSentForSender(db, { senderAccountId: sender.id })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].offer.kind, 'pending')

  const json = JSON.stringify(sent)
  assert.ok(
    !json.includes(recipientAnswerSecret),
    "a pending offer must not carry the recipient's staked answer anywhere in the serialised sender view",
  )

  await client.close()
})

test('§4.2 getSentForSender: once resolved, both answers are present, including the recipient\'s', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db)
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)
  const confession = await createConfession(db, { linkId: link.id, senderAccountId: sender.id })

  const recipientAnswer = 'her staked answer, now unlocked'
  const senderAnswer = 'his honest answer'

  const { offerId } = await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: confession.id,
    questionForSender: 'مين إنت؟',
    stakePrompt: 'رح احكيلك سر',
    recipientAnswer,
  })
  await acceptRevealOffer(db, { senderAccountId: sender.id, offerId, senderAnswer })

  const sent = await getSentForSender(db, { senderAccountId: sender.id })
  const offer = sent[0].offer
  assert.equal(offer.kind, 'resolved')
  if (offer.kind === 'resolved') {
    assert.equal(offer.recipientAnswer, recipientAnswer)
    assert.equal(offer.senderAnswer, senderAnswer)
  }

  const json = JSON.stringify(sent)
  assert.ok(json.includes(recipientAnswer), 'once resolved, the recipient answer is exactly what is meant to unlock')

  await client.close()
})

test('§4.2 getSentForSender: a declined offer reports kind "declined" with no answer bodies anywhere', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db)
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)
  const confession = await createConfession(db, { linkId: link.id, senderAccountId: sender.id })

  const recipientAnswerSecret = 'DECLINED-STAKE-NEVER-SHOWN'
  const { offerId } = await openRevealOffer(db, {
    recipientAccountId: recipient.id,
    confessionId: confession.id,
    questionForSender: 'مين إنت؟',
    stakePrompt: 'رح احكيلك سر',
    recipientAnswer: recipientAnswerSecret,
  })
  await declineRevealOffer(db, { senderAccountId: sender.id, offerId })

  const sent = await getSentForSender(db, { senderAccountId: sender.id })
  assert.equal(sent[0].offer.kind, 'declined')

  const json = JSON.stringify(sent)
  assert.ok(!json.includes(recipientAnswerSecret))

  await client.close()
})
