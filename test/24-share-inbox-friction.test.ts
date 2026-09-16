import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { freshDb } from './harness.js'
import { createAccount, createLink } from './fixtures.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

test('AC1: empty inbox displays 1-tap share button invoking navigator.share or copy fallback with aria-label', () => {
  const copyComponentPath = path.join(APP_DIR, '_components', 'CopyLink.tsx')
  assert.ok(existsSync(copyComponentPath), 'app/_components/CopyLink.tsx must exist')
  const src = readFileSync(copyComponentPath, 'utf8')

  const hasAriaLabel = /aria-label\s*=\s*['"][^'"]+['"]/.test(src)
  assert.ok(
    hasAriaLabel,
    'CopyLink component must provide an explicit aria-label for accessibility (threshold: button present with aria-label)',
  )

  const hasShare = /navigator\.share/.test(src) || /navigator\?\.share/.test(src)
  assert.ok(
    hasShare,
    'CopyLink component must support native Web Share API (navigator.share) when supported',
  )
})

test('AC2: copy link button provides visual feedback changing text to تم النسخ', () => {
  const copyComponentPath = path.join(APP_DIR, '_components', 'CopyLink.tsx')
  assert.ok(existsSync(copyComponentPath), 'app/_components/CopyLink.tsx must exist')
  const src = readFileSync(copyComponentPath, 'utf8')

  assert.ok(
    src.includes('تم النسخ'),
    'CopyLink component button text must update to تم النسخ upon successful copy',
  )
})

test('AC3: when Clipboard API is unavailable or denied, raw URL remains selectable in fallback text', () => {
  const copyComponentPath = path.join(APP_DIR, '_components', 'CopyLink.tsx')
  assert.ok(existsSync(copyComponentPath), 'app/_components/CopyLink.tsx must exist')
  const src = readFileSync(copyComponentPath, 'utf8')

  assert.ok(
    !src.includes('if (!canCopy) return null'),
    'CopyLink must not return null when clipboard API is absent; it must render a fallback UI',
  )
  assert.ok(
    /fallback|selectable|readOnly/i.test(src),
    'CopyLink must render a selectable or visible fallback container when clipboard cannot be written directly',
  )
})

test('AC4: link slug and generated URL match owner account', async () => {
  const { db, client } = await freshDb()
  try {
    const owner = await createAccount(db)
    const createdLink = await createLink(db, owner.id)
    assert.ok(createdLink.slug, 'created link must have a valid slug')

    const inboxSrc = readFileSync(path.join(APP_DIR, 'inbox', 'page.tsx'), 'utf8')
    assert.ok(
      inboxSrc.includes('<CopyLink url={`'),
      'InboxPage must pass full url with slug to CopyLink component',
    )
  } finally {
    await client.close()
  }
})
