// test/75-long-words.test.ts
//
// Week 25 acceptance, written from docs/SPEC-week25-long-words.md section 4.
// Proves that unbroken long words do not widen the page beyond the 360 px
// mobile viewport and that elements containing the long text remain visible
// on screen without being clipped.
// The mutants M1, M2, and M3 are run separately against modified stylesheets.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURES_DIR = path.join(REPO_ROOT, 'test', 'fixtures', 'w25')
const GLOBALS_CSS_PATH = path.join(REPO_ROOT, 'app', 'globals.css')

const FIXTURES = [
  'compose-long-name.html',
  'inbox-messages.html',
  'inbox-offer-pending.html',
  'inbox-resolved.html',
  'offer.html',
  'onboarding-long-name.html',
  'sent-offer-pending.html',
  'sent-resolved.html',
] as const

const LONG_RUN_PATTERN = /a{20}|ه{20}|o{20}|s{20}/

function loadFixtureWithCss(fixtureName: string): string {
  const fixturePath = path.join(FIXTURES_DIR, fixtureName)
  const html = readFileSync(fixturePath, 'utf8')
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8')
  const headClose = '</head>'
  const headIdx = html.indexOf(headClose)
  assert.ok(headIdx !== -1, `fixture ${fixtureName} must contain </head>`)
  return html.slice(0, headIdx) + '<style>' + css + '</style>' + html.slice(headIdx)
}

let browser: Browser
let page: Page

before(async () => {
  browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 360, height: 780 },
    isMobile: true,
    hasTouch: true,
  })
  page = await context.newPage()
})

after(async () => {
  if (browser) {
    await browser.close()
  }
})

// ---------------------------------------------------------------------------
// Item 1: Each fixture exists and carries the long text
// ---------------------------------------------------------------------------

test('item 1: all eight fixtures exist, contain no script tags, and carry long text', () => {
  for (const file of FIXTURES) {
    const fixturePath = path.join(FIXTURES_DIR, file)
    assert.ok(existsSync(fixturePath), `fixture ${file} must exist`)
    const html = readFileSync(fixturePath, 'utf8')
    assert.ok(!/<script/i.test(html), `fixture ${file} must not contain <script`)
    assert.ok(
      LONG_RUN_PATTERN.test(html),
      `fixture ${file} must contain at least one run of 20 a, 20 ه, 20 o, or 20 s`,
    )
  }
})

// ---------------------------------------------------------------------------
// Item 2: No page is wider than the screen (scrollWidth <= 360)
// ---------------------------------------------------------------------------

for (const file of FIXTURES) {
  test(`item 2: ${file}`, async () => {
    const html = loadFixtureWithCss(file)
    await page.setContent(html)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(
      scrollWidth <= 360,
      `fixture ${file}: document.documentElement.scrollWidth was ${scrollWidth}, expected <= 360`,
    )
  })
}

// ---------------------------------------------------------------------------
// Item 3: Long text is on screen, not cut off
// ---------------------------------------------------------------------------

for (const file of FIXTURES) {
  test(`item 3: ${file}`, async () => {
    const html = loadFixtureWithCss(file)
    await page.setContent(html)
    const elements = await page.evaluate(() => {
      const runRegex = /a{20}|ه{20}|o{20}|s{20}/
      const allElements = Array.from(document.querySelectorAll('body, body *'))
      const matches: Array<{
        selector: string
        left: number
        right: number
        scrollWidth: number
        clientWidth: number
      }> = []

      for (const el of allElements) {
        let ownText = ''
        for (let i = 0; i < el.childNodes.length; i++) {
          const child = el.childNodes[i]
          if (child && child.nodeType === Node.TEXT_NODE && child.nodeValue) {
            ownText += child.nodeValue
          }
        }
        if (runRegex.test(ownText)) {
          const rect = el.getBoundingClientRect()
          const classStr = el.classList && el.classList.length > 0
            ? '.' + Array.from(el.classList).join('.')
            : ''
          matches.push({
            selector: el.tagName.toLowerCase() + classStr,
            left: rect.left,
            right: rect.right,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          })
        }
      }
      return matches
    })

    assert.ok(elements.length > 0, `fixture ${file}: expected at least one element with long text`)

    for (const el of elements) {
      assert.ok(
        el.left >= -1 && el.right <= 361,
        `fixture ${file}: element <${el.selector}> bounding box [${el.left}, ${el.right}] outside [-1, 361]`,
      )
      assert.ok(
        el.scrollWidth <= el.clientWidth + 1,
        `fixture ${file}: element <${el.selector}> scrollWidth (${el.scrollWidth}) > clientWidth + 1 (${el.clientWidth + 1})`,
      )
    }
  })
}

// ---------------------------------------------------------------------------
// Item 4: The browser is real
// ---------------------------------------------------------------------------

test('item 4: the browser is real and launches', () => {
  assert.ok(browser, 'Chromium browser must be running')
  assert.ok(browser.isConnected(), 'Chromium must be connected')
})
