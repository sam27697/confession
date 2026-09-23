import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OFFER_PAGE = path.join(REPO_ROOT, 'app', 'offer', '[offerId]', 'page.tsx')
const DELETE_PAGE = path.join(REPO_ROOT, 'app', 'account', 'delete', 'page.tsx')
const GLOBALS_CSS = path.join(REPO_ROOT, 'app', 'globals.css')
const HUMAN_CHECKLIST = path.join(REPO_ROOT, 'docs', 'human_checklist.md')

test('AC1 (NEW): Deep action routes render a semantic breadcrumb / return bar (.view-breadcrumb)', () => {
  assert.ok(existsSync(OFFER_PAGE), 'app/offer/[offerId]/page.tsx must exist')
  assert.ok(existsSync(DELETE_PAGE), 'app/account/delete/page.tsx must exist')

  const offerSrc = readFileSync(OFFER_PAGE, 'utf8')
  const deleteSrc = readFileSync(DELETE_PAGE, 'utf8')

  assert.match(
    offerSrc,
    /view-breadcrumb/,
    'Offer page must render view-breadcrumb container',
  )
  assert.match(
    offerSrc,
    /<a[^>]*href=["']\/sent["'][^>]*>[\s\S]*?(?:الرسائل المرسلة|المرسلة)[\s\S]*?<\/a>/,
    'Offer page breadcrumb must link back to sent messages (/sent)',
  )

  assert.match(
    deleteSrc,
    /view-breadcrumb/,
    'Delete account page must render view-breadcrumb container',
  )
  assert.match(
    deleteSrc,
    /<a[^>]*href=["']\/inbox["'][^>]*>[\s\S]*?(?:صندوقي|الصندوق)[\s\S]*?<\/a>/,
    'Delete account page breadcrumb must link back to inbox (/inbox)',
  )
})

test('AC2 (NEW): Breadcrumb return link provides accessible aria-label and touch target >= 44px', () => {
  const offerSrc = readFileSync(OFFER_PAGE, 'utf8')
  const deleteSrc = readFileSync(DELETE_PAGE, 'utf8')
  const css = readFileSync(GLOBALS_CSS, 'utf8')

  assert.match(
    offerSrc,
    /view-breadcrumb__link[^>]*aria-label=/,
    'Offer page breadcrumb link must have an aria-label',
  )
  assert.match(
    deleteSrc,
    /view-breadcrumb__link[^>]*aria-label=/,
    'Delete page breadcrumb link must have an aria-label',
  )

  assert.match(
    css,
    /\.view-breadcrumb__link\s*\{[^}]*min-height:\s*(?:44px|var\(--tap-min\)|var\(--tap-compact\))/,
    'globals.css must specify min-height >= 44px for .view-breadcrumb__link',
  )
})

test('AC3 (KEEP): Offer response forms, decline actions, safe exit link, and deletion mechanics strictly preserved', () => {
  const offerSrc = readFileSync(OFFER_PAGE, 'utf8')
  const deleteSrc = readFileSync(DELETE_PAGE, 'utf8')

  assert.ok(offerSrc.includes('acceptOfferAction'), 'Offer page must preserve acceptOfferAction')
  assert.ok(offerSrc.includes('declineOfferAction'), 'Offer page must preserve declineOfferAction')
  assert.ok(offerSrc.includes('senderAnswer'), 'Offer page must preserve senderAnswer textarea')

  assert.ok(deleteSrc.includes('deleteAccountAction'), 'Delete page must preserve deleteAccountAction')
  assert.ok(deleteSrc.includes('sovereignty-card'), 'Delete page must preserve sovereignty-card')
  assert.ok(deleteSrc.includes('name="confirm"'), 'Delete page must preserve confirm checkbox')
})

test('AC4 (KEEP): human_checklist.md defines HC-32 for contextual breadcrumb header evaluation', () => {
  assert.ok(existsSync(HUMAN_CHECKLIST), 'docs/human_checklist.md must exist')
  const content = readFileSync(HUMAN_CHECKLIST, 'utf8')
  assert.match(
    content,
    /## HC-32\b/,
    'human_checklist.md must contain ## HC-32 entry',
  )
})
