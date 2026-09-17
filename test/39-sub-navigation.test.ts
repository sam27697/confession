import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

test('AC1: persistent app-nav tab bar renders on both /inbox and /sent linking to both views', () => {
  const inboxPath = path.join(APP_DIR, 'inbox', 'page.tsx')
  const sentPath = path.join(APP_DIR, 'sent', 'page.tsx')

  assert.ok(existsSync(inboxPath), 'app/inbox/page.tsx must exist')
  assert.ok(existsSync(sentPath), 'app/sent/page.tsx must exist')

  const inboxSrc = readFileSync(inboxPath, 'utf8')
  const sentSrc = readFileSync(sentPath, 'utf8')

  // Both pages must render a nav with class app-nav or role tablist/navigation containing both links
  assert.ok(
    inboxSrc.includes('app-nav') && inboxSrc.includes('href="/inbox"') && inboxSrc.includes('href="/sent"'),
    'inbox page must render persistent app-nav navigation bar with links to /inbox and /sent'
  )
  assert.ok(
    sentSrc.includes('app-nav') && sentSrc.includes('href="/inbox"') && sentSrc.includes('href="/sent"'),
    'sent page must render persistent app-nav navigation bar with links to /inbox and /sent'
  )
})

test('AC2: active tab displays aria-current="page" and active styling token', () => {
  const inboxPath = path.join(APP_DIR, 'inbox', 'page.tsx')
  const sentPath = path.join(APP_DIR, 'sent', 'page.tsx')
  const cssPath = path.join(APP_DIR, 'globals.css')

  const inboxSrc = readFileSync(inboxPath, 'utf8')
  const sentSrc = readFileSync(sentPath, 'utf8')
  const cssSrc = readFileSync(cssPath, 'utf8')

  // On inbox, the inbox tab has aria-current="page" and active class
  assert.ok(
    /href=["']\/inbox["'][^>]*aria-current=["']page["']/.test(inboxSrc) ||
    /aria-current=["']page["'][^>]*href=["']\/inbox["']/.test(inboxSrc),
    'inbox page must mark the /inbox tab with aria-current="page"'
  )
  assert.ok(
    inboxSrc.includes('app-nav__tab--active') || inboxSrc.includes('app-nav__link--active'),
    'inbox page must apply active class token to current tab'
  )

  // On sent, the sent tab has aria-current="page" and active class
  assert.ok(
    /href=["']\/sent["'][^>]*aria-current=["']page["']/.test(sentSrc) ||
    /aria-current=["']page["'][^>]*href=["']\/sent["']/.test(sentSrc),
    'sent page must mark the /sent tab with aria-current="page"'
  )

  // CSS must define app-nav and active state styles
  assert.ok(
    cssSrc.includes('.app-nav') && (cssSrc.includes('.app-nav__tab--active') || cssSrc.includes('.app-nav__link--active')),
    'globals.css must define styling rules for .app-nav and active tab states'
  )
})

test('AC3: tab items display contextual Arabic labels and responsive 44px min-height geometry', () => {
  const inboxPath = path.join(APP_DIR, 'inbox', 'page.tsx')
  const sentPath = path.join(APP_DIR, 'sent', 'page.tsx')
  const cssPath = path.join(APP_DIR, 'globals.css')

  const inboxSrc = readFileSync(inboxPath, 'utf8')
  const sentSrc = readFileSync(sentPath, 'utf8')
  const cssSrc = readFileSync(cssPath, 'utf8')

  assert.ok(
    inboxSrc.includes('صندوقي') || inboxSrc.includes('الصندوق'),
    'inbox nav must contain Arabic label for inbox (صندوقي)'
  )
  assert.ok(
    sentSrc.includes('المرسلة') || sentSrc.includes('الرسائل المرسلة'),
    'sent nav must contain Arabic label for sent messages (المرسلة)'
  )

  // Check CSS rule for min-height 44px touch target and flex-wrap / flex behavior preventing overflow
  assert.ok(
    /\.app-nav__tab[^{]*\{[^}]*min-height:\s*(?:44px|2\.75rem)/.test(cssSrc) ||
    /\.app-nav__link[^{]*\{[^}]*min-height:\s*(?:44px|2\.75rem)/.test(cssSrc) ||
    /\.app-nav[^{]*\{[^}]*min-height:\s*(?:44px|2\.75rem)/.test(cssSrc),
    'globals.css must ensure app-nav items have minimum 44px touch target height'
  )
})

test('AC4: existing inbox actions and outbox status filters are strictly preserved (KEEP)', () => {
  const inboxPath = path.join(APP_DIR, 'inbox', 'page.tsx')
  const sentPath = path.join(APP_DIR, 'sent', 'page.tsx')

  const inboxSrc = readFileSync(inboxPath, 'utf8')
  const sentSrc = readFileSync(sentPath, 'utf8')

  // Keep checks: StoryCard, CopyLink, and filter tabs
  assert.ok(inboxSrc.includes('<StoryCard'), 'inbox page must preserve StoryCard component')
  assert.ok(inboxSrc.includes('<CopyLink'), 'inbox page must preserve CopyLink component')
  assert.ok(sentSrc.includes('sent-filters'), 'sent page must preserve sent-filters class')
  assert.ok(sentSrc.includes('filter='), 'sent page must preserve filter query params')
})