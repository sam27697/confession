import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INBOX_PAGE = path.join(REPO_ROOT, 'app', 'inbox', 'page.tsx')
const SENT_PAGE = path.join(REPO_ROOT, 'app', 'sent', 'page.tsx')
const GLOBALS_CSS = path.join(REPO_ROOT, 'app', 'globals.css')

test('AC1: resolved mutual reveal display features ceremonial unmasked identity seal across both recipient (/inbox) and sender (/sent) views', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')
  const inboxSrc = readFileSync(INBOX_PAGE, 'utf8')
  const sentSrc = readFileSync(SENT_PAGE, 'utf8')

  // Recipient view (/inbox)
  assert.match(
    inboxSrc,
    /reveal--resolved[\s\S]*?(?:reveal-seal|reveal-unmask|ceremony)/,
    'Inbox resolved mutual reveal must render ceremonial unmasked seal container',
  )
  assert.match(
    inboxSrc,
    /reveal\.senderDisplayName/,
    'Inbox resolved mutual reveal must display unmasked sender display name',
  )

  // Sender view (/sent)
  assert.match(
    sentSrc,
    /sent-resolved[\s\S]*?(?:sent-resolved__seal|sent-unmask|ceremony)/,
    'Sent resolved mutual reveal must render ceremonial unmasked seal container',
  )
})

test('AC2: symmetrical dual-card presentation renders both question/stake and answers with balanced visual dignity in both views', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')
  const inboxSrc = readFileSync(INBOX_PAGE, 'utf8')
  const sentSrc = readFileSync(SENT_PAGE, 'utf8')

  // Inbox structured answers
  assert.match(
    inboxSrc,
    /(?:reveal-dialogue|reveal-answers)[\s\S]*?reveal\.senderAnswer[\s\S]*?reveal\.recipientAnswer/,
    'Inbox resolved view must present symmetrical dialogue layout displaying both answers',
  )

  // Sent structured answers
  assert.match(
    sentSrc,
    /(?:sent-resolved__dialogue|sent-resolved__item)[\s\S]*?offer\.senderAnswer[\s\S]*?offer\.recipientAnswer/,
    'Sent resolved view must present symmetrical dialogue layout displaying both answers',
  )
})

test('AC3: reduced motion preferences (@media prefers-reduced-motion) are strictly respected with immediate opacity reveal and zero forced animation', () => {
  assert.ok(existsSync(GLOBALS_CSS), 'app/globals.css must exist')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.match(
    css,
    /@keyframes\s+(?:revealUnmask|unmaskReveal)/,
    'globals.css must define unmasking keyframe animation for ceremonial reveal',
  )

  assert.match(
    css,
    /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)[\s\S]*?(?:\.reveal--resolved|\.sent-resolved)/,
    'globals.css must disable unmasking animation under prefers-reduced-motion: reduce',
  )
})

test('AC4: exact names, form actions, database view bindings, and error notices strictly preserved (KEEP)', () => {
  assert.ok(existsSync(INBOX_PAGE), 'app/inbox/page.tsx must exist')
  assert.ok(existsSync(SENT_PAGE), 'app/sent/page.tsx must exist')
  const inboxSrc = readFileSync(INBOX_PAGE, 'utf8')
  const sentSrc = readFileSync(SENT_PAGE, 'utf8')

  assert.ok(inboxSrc.includes('openRevealOfferAction'), 'openRevealOfferAction must be preserved')
  assert.ok(inboxSrc.includes('name="confessionId"'), 'confessionId form field must be preserved')
  assert.ok(inboxSrc.includes('name="questionForSender"'), 'questionForSender form field must be preserved')
  assert.ok(inboxSrc.includes('name="stakePrompt"'), 'stakePrompt form field must be preserved')
  assert.ok(inboxSrc.includes('name="recipientAnswer"'), 'recipientAnswer form field must be preserved')

  assert.ok(sentSrc.includes('offer.kind === \'pending\''), 'pending offer status check must be preserved')
  assert.ok(sentSrc.includes('offer.questionForSender'), 'questionForSender display must be preserved')
  assert.ok(sentSrc.includes('/offer/'), 'offer review link must be preserved')
})
