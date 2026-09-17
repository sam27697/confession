import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(REPO_ROOT, 'app')

test('AC1: unauthenticated home renders 3-step feature discovery walk explaining core mechanics', () => {
  const homePath = path.join(APP_DIR, 'page.tsx')
  assert.ok(existsSync(homePath), 'app/page.tsx must exist')
  const src = readFileSync(homePath, 'utf8')

  // Check for 3-step container and presence of core concepts: share, receive, and mutual unmask
  assert.ok(
    src.includes('home-steps'),
    'home page must render a container with class home-steps'
  )
  assert.ok(
    src.includes('شارك رابطك') || src.includes('انشر رابطك'),
    'discovery walk must explain sharing the link'
  )
  assert.ok(
    src.includes('استقبل') || src.includes('توصلك رسايل'),
    'discovery walk must explain receiving messages anonymously'
  )
  assert.ok(
    src.includes('صارحني بدورك') || src.includes('اكشفوا سوا'),
    'discovery walk must explain reciprocal mutual reveal mechanic'
  )
})

test('AC2: discovery steps use structured card containers with distinct step badges', () => {
  const homePath = path.join(APP_DIR, 'page.tsx')
  const cssPath = path.join(APP_DIR, 'globals.css')

  const src = readFileSync(homePath, 'utf8')
  const css = readFileSync(cssPath, 'utf8')

  assert.ok(
    src.includes('home-step') && (src.includes('home-step__num') || src.includes('home-step__badge')),
    'home page must render individual home-step items with step numbers/badges'
  )

  assert.ok(
    css.includes('.home-steps') && css.includes('.home-step'),
    'globals.css must define styles for .home-steps and .home-step'
  )
})

test('AC3: authentication forms are framed within primary action container below discovery steps', () => {
  const homePath = path.join(APP_DIR, 'page.tsx')
  const src = readFileSync(homePath, 'utf8')

  const stepsIndex = src.indexOf('home-steps')
  const authFormIndex = src.indexOf('/auth/dev')

  assert.ok(stepsIndex !== -1, 'home-steps must exist')
  assert.ok(authFormIndex !== -1, 'auth form must exist')
  assert.ok(
    stepsIndex < authFormIndex,
    '3-step discovery walk must appear before/above the authentication actions'
  )
})

test('AC4: auth handlers, searchParams next redirection, dev bypass, and legal links strictly preserved (KEEP)', () => {
  const homePath = path.join(APP_DIR, 'page.tsx')
  const src = readFileSync(homePath, 'utf8')

  assert.ok(src.includes('/auth/dev'), 'app/auth/dev handler must be preserved')
  assert.ok(src.includes('/auth/facebook/start'), 'facebook auth start must be preserved')
  assert.ok(src.includes('name="next"') || src.includes("name={'next'}"), 'next query param input binding must be preserved')
  assert.ok(src.includes('href="/terms"'), 'terms link must be preserved')
  assert.ok(src.includes('href="/privacy"'), 'privacy link must be preserved')
  assert.ok(src.includes('resolveActiveViewerAccountId'), 'auth check against db must be preserved')
})