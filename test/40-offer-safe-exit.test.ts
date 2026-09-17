import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

test('AC1: offer response page renders non-destructive anchor link to /sent outside form blocks', () => {
  const offerPath = path.join(APP_DIR, 'offer', '[offerId]', 'page.tsx')
  assert.ok(existsSync(offerPath), 'app/offer/[offerId]/page.tsx must exist')
  const src = readFileSync(offerPath, 'utf8')

  // Must have an explicit anchor linking to /sent with label الرجوع للمرسلة
  assert.ok(
    src.includes('href="/sent"') && src.includes('الرجوع للمرسلة'),
    'offer page must render a non-destructive back anchor to /sent'
  )

  // Anchor must be outside <form> blocks
  const formBlocks = src.match(/<form[\s\S]*?<\/form>/g) || []
  for (const form of formBlocks) {
    assert.ok(
      !form.includes('href="/sent"'),
      'return link to /sent must be positioned outside form elements'
    )
  }
})

test('AC2: permanent decline button clearly displays danger styling and irreversible wording', () => {
  const offerPath = path.join(APP_DIR, 'offer', '[offerId]', 'page.tsx')
  const src = readFileSync(offerPath, 'utf8')

  // Check button text in decline form
  const declineForm = src.match(/<form[^>]*action=\{declineOfferAction\}[\s\S]*?<\/form>/)?.[0]
  assert.ok(declineForm, 'offer page must contain decline form with action={declineOfferAction}')

  assert.ok(
    declineForm.includes('رفض العرض نهائياً') || declineForm.includes('رفض العرض'),
    'decline button must explicitly say "رفض العرض" or "رفض العرض نهائياً" instead of ambiguous "مو هلق"'
  )
  assert.ok(
    declineForm.includes('btn--danger') || declineForm.includes('btn--outline-danger'),
    'decline button must use distinct danger styling'
  )
})

test('AC3: recipient stake and question displayed in balanced visual containers', () => {
  const offerPath = path.join(APP_DIR, 'offer', '[offerId]', 'page.tsx')
  const src = readFileSync(offerPath, 'utf8')

  assert.ok(
    src.includes('offer.questionForSender') && src.includes('offer.stakePrompt'),
    'offer page must display both questionForSender and stakePrompt'
  )
  assert.ok(
    src.includes('offer-dialogue') || src.includes('offer-stake') || src.includes('card--bubble'),
    'offer page must structure question and stake in clear visual dialogue containers'
  )
})

test('AC4: form actions, domain error mappings, and server validations strictly preserved (KEEP)', () => {
  const offerPath = path.join(APP_DIR, 'offer', '[offerId]', 'page.tsx')
  const src = readFileSync(offerPath, 'utf8')

  assert.ok(src.includes('acceptOfferAction'), 'acceptOfferAction must be preserved')
  assert.ok(src.includes('declineOfferAction'), 'declineOfferAction must be preserved')
  assert.ok(src.includes('ERROR_COPY'), 'ERROR_COPY mappings must be preserved')
  assert.ok(src.includes('minLength={2}'), 'minLength={2} on textarea must be preserved')
  assert.ok(src.includes('maxLength={4000}'), 'maxLength={4000} on textarea must be preserved')
})