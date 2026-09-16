import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')
const GLOBALS_CSS = path.join(APP_DIR, 'globals.css')

test('AC1: inbox confession cards utilize cohesive surface elevation and hairline styling', () => {
  const inboxPath = path.join(APP_DIR, 'inbox', 'page.tsx')
  assert.ok(existsSync(inboxPath), 'app/inbox/page.tsx must exist')
  const inboxSrc = readFileSync(inboxPath, 'utf8')

  assert.ok(
    inboxSrc.includes("className={isHidden ? 'msg msg--hidden' : isResolved ? 'msg msg--resolved' : 'msg'}"),
    'inbox cards must adhere to standard .msg surface hierarchy with state modifiers',
  )

  const cssSrc = readFileSync(GLOBALS_CSS, 'utf8')
  assert.match(
    cssSrc,
    /\.msg\s*\{[^}]*background:\s*var\(--bg-card\)[^}]*border:[^}]*var\(--border-card\)[^}]*box-shadow:\s*var\(--shadow-card\)/,
    '.msg class in globals.css must specify background, border, and elevation shadow tokens',
  )
  assert.match(
    cssSrc,
    /\.msg--resolved\s*\{[^}]*box-shadow:[^}]*var\(--rose-glow\)/,
    '.msg--resolved must declare luminous elevation glow',
  )
})

test('AC2: outbox sent messages display structured card status hierarchy with elevated offer surface', () => {
  const sentPath = path.join(APP_DIR, 'sent', 'page.tsx')
  assert.ok(existsSync(sentPath), 'app/sent/page.tsx must exist')
  const sentSrc = readFileSync(sentPath, 'utf8')

  assert.ok(
    sentSrc.includes('msg msg--out'),
    'sent messages must use .msg.msg--out surface card',
  )
  assert.ok(
    sentSrc.includes('chip--pending') &&
      sentSrc.includes('chip--declined') &&
      sentSrc.includes('chip--resolved') &&
      sentSrc.includes('chip--delivered'),
    'sent messages must render structured status chips matching design system states',
  )

  const cssSrc = readFileSync(GLOBALS_CSS, 'utf8')
  assert.match(
    cssSrc,
    /\.sent-offer\s*\{[^}]*box-shadow:\s*var\(--shadow-card\)/,
    '.sent-offer in globals.css must declare box-shadow:var(--shadow-card) for layered elevation depth',
  )
})

test('AC3: offer response screen utilizes elevated preview card styling', () => {
  const offerPath = path.join(APP_DIR, 'offer', '[offerId]', 'page.tsx')
  assert.ok(existsSync(offerPath), 'app/offer/[offerId]/page.tsx must exist')
  const offerSrc = readFileSync(offerPath, 'utf8')

  assert.ok(
    offerSrc.includes('card card--raised card--bubble reveal'),
    'offer preview card must use card--raised for surface elevation above veil background',
  )
  assert.ok(
    offerSrc.includes('questionForSender') && offerSrc.includes('stakePrompt'),
    'offer preview card must display both question and stake prompt',
  )
})

test('AC4: preserves message actions, form fields, and data-carrying elements (KEEP)', () => {
  const inboxSrc = readFileSync(path.join(APP_DIR, 'inbox', 'page.tsx'), 'utf8')
  assert.ok(inboxSrc.includes('name="confessionId"'), 'inbox must preserve confessionId hidden input')
  assert.ok(inboxSrc.includes('name="questionForSender"'), 'inbox must preserve questionForSender input')
  assert.ok(inboxSrc.includes('openRevealOfferAction'), 'inbox must preserve openRevealOfferAction')
  assert.ok(inboxSrc.includes('blockSenderAction'), 'inbox must preserve blockSenderAction')
  assert.ok(inboxSrc.includes('reportConfessionAction'), 'inbox must preserve reportConfessionAction')
  assert.ok(inboxSrc.includes('hideConfessionAction'), 'inbox must preserve hideConfessionAction')
  assert.ok(inboxSrc.includes('setLinkEnabledAction'), 'inbox must preserve setLinkEnabledAction')

  const offerSrc = readFileSync(path.join(APP_DIR, 'offer', '[offerId]', 'page.tsx'), 'utf8')
  assert.ok(offerSrc.includes('acceptOfferAction'), 'offer screen must preserve acceptOfferAction')
  assert.ok(offerSrc.includes('declineOfferAction'), 'offer screen must preserve declineOfferAction')
  assert.ok(offerSrc.includes('name="offerId"'), 'offer screen must preserve offerId input')
  assert.ok(offerSrc.includes('name="senderAnswer"'), 'offer screen must preserve senderAnswer textarea')

  const sentSrc = readFileSync(path.join(APP_DIR, 'sent', 'page.tsx'), 'utf8')
  assert.ok(sentSrc.includes('href={`/offer/${offer.offerId}`}'), 'sent screen must preserve offer link')
})
