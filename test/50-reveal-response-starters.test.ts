import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

test('AC1: offer response screen renders at least 3 contextual response starters with explicit type="button"', () => {
  const offerPath = path.join(APP_DIR, 'offer', '[offerId]', 'page.tsx')
  assert.ok(existsSync(offerPath), 'app/offer/[offerId]/page.tsx must exist')
  const src = readFileSync(offerPath, 'utf8')

  assert.ok(
    src.includes('offer-starters') || src.includes('response-starters'),
    'offer page must contain response starters container'
  )
  assert.ok(
    src.includes('data-response-prompt'),
    'response starter chips must include data-response-prompt attribute'
  )
  assert.ok(
    src.includes('type="button"'),
    'starter chips must explicitly use type="button" to prevent premature form submission'
  )
})

test('AC2: offer page script populates senderAnswer textarea on 1-tap chip actuation', () => {
  const offerPath = path.join(APP_DIR, 'offer', '[offerId]', 'page.tsx')
  const src = readFileSync(offerPath, 'utf8')

  assert.ok(
    src.includes('senderAnswer') && (src.includes('data-response-prompt') || src.includes('dispatchEvent')),
    'offer page script must populate senderAnswer field on chip tap'
  )
})

test('AC3: globals.css styles offer-starters container and chips with design tokens', () => {
  const cssPath = path.join(APP_DIR, 'globals.css')
  const css = readFileSync(cssPath, 'utf8')

  assert.ok(
    css.includes('.offer-starters') || css.includes('.compose-starters'),
    'globals.css must style offer starters container'
  )
})

test('AC4: accept and decline server actions, offerId fields, and safe-exit link strictly preserved (KEEP)', () => {
  const offerPath = path.join(APP_DIR, 'offer', '[offerId]', 'page.tsx')
  const src = readFileSync(offerPath, 'utf8')

  assert.ok(src.includes('acceptOfferAction'), 'acceptOfferAction must be preserved')
  assert.ok(src.includes('declineOfferAction'), 'declineOfferAction must be preserved')
  assert.ok(src.includes('name="offerId"'), 'offerId hidden inputs must be preserved')
  assert.ok(src.includes('href="/sent"'), 'safe-exit link to /sent must be preserved')
})
