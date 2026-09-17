import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

test('AC1: mutual reveal uses styled RevealCard component replacing details.reveal in inbox', () => {
  const revealCardPath = path.join(APP_DIR, '_components', 'RevealCard.tsx')
  assert.ok(existsSync(revealCardPath), 'app/_components/RevealCard.tsx must exist')

  const inboxPath = path.join(APP_DIR, 'inbox', 'page.tsx')
  assert.ok(existsSync(inboxPath), 'app/inbox/page.tsx must exist')
  const inboxSrc = readFileSync(inboxPath, 'utf8')

  assert.ok(
    inboxSrc.includes('<RevealCard') || inboxSrc.includes('RevealCard'),
    'InboxPage must render the RevealCard component',
  )
  assert.ok(
    !inboxSrc.includes('<details className="reveal">'),
    'InboxPage must replace the legacy details.reveal element with RevealCard',
  )
})

test('AC2: RevealCard contains structured prompt suggestions for question and stake', () => {
  const revealCardPath = path.join(APP_DIR, '_components', 'RevealCard.tsx')
  assert.ok(existsSync(revealCardPath), 'app/_components/RevealCard.tsx must exist')
  const src = readFileSync(revealCardPath, 'utf8')

  assert.ok(
    src.includes('QUESTION_SUGGESTIONS') || src.includes('datalist') || src.includes('chip') || src.includes('prompt'),
    'RevealCard must expose structured prompt suggestions or chips for question and stake',
  )
})

test('AC3: offer response screen displays side-by-side or elevated comparison preview card', () => {
  const offerPagePath = path.join(APP_DIR, 'offer', '[offerId]', 'page.tsx')
  assert.ok(existsSync(offerPagePath), 'app/offer/[offerId]/page.tsx must exist')
  const offerSrc = readFileSync(offerPagePath, 'utf8')

  const hasCardOrPreview =
    /card|preview|reveal-card|offer-compare/i.test(offerSrc)
  assert.ok(
    hasCardOrPreview,
    'Offer response screen must present an elevated preview or comparison structure',
  )
  assert.ok(
    offerSrc.includes('questionForSender') || offerSrc.includes('stakePrompt') || offerSrc.includes('offer.question') || offerSrc.includes('offer.stake'),
    'Offer screen must display both the question and stake prompt clearly to the recipient',
  )
})

test('AC4: moderation disclosure details.msg__more is preserved unchanged', () => {
  const inboxPath = path.join(APP_DIR, 'inbox', 'page.tsx')
  assert.ok(existsSync(inboxPath), 'app/inbox/page.tsx must exist')
  const inboxSrc = readFileSync(inboxPath, 'utf8')

  assert.ok(
    inboxSrc.includes('<details className="msg__more">'),
    'InboxPage must preserve details.msg__more for moderation options',
  )
  assert.ok(
    inboxSrc.includes('hideConfessionAction') &&
      inboxSrc.includes('blockSenderAction') &&
      inboxSrc.includes('reportConfessionAction'),
    'InboxPage must preserve all three moderation actions',
  )
})

test('AC5: domain actions openRevealOfferAction and acceptOfferAction form contracts remain untouched', () => {
  const inboxPath = path.join(APP_DIR, 'inbox', 'page.tsx')
  const offerPath = path.join(APP_DIR, 'offer', '[offerId]', 'page.tsx')
  const revealCardPath = path.join(APP_DIR, '_components', 'RevealCard.tsx')

  const combinedSrc = [
    readFileSync(inboxPath, 'utf8'),
    readFileSync(offerPath, 'utf8'),
    existsSync(revealCardPath) ? readFileSync(revealCardPath, 'utf8') : '',
  ].join('\n')

  assert.ok(combinedSrc.includes('name="confessionId"'), 'confessionId input must be preserved')
  assert.ok(combinedSrc.includes('name="questionForSender"'), 'questionForSender input must be preserved')
  assert.ok(combinedSrc.includes('name="stakePrompt"'), 'stakePrompt input must be preserved')
  assert.ok(combinedSrc.includes('name="recipientAnswer"'), 'recipientAnswer input must be preserved')
})
