// test/78-heading-rows.test.ts
//
// Week 28 acceptance, written from docs/SPEC-week28-heading-rows.md section 4.
// Proves that the inbox heading row (the page heading and its chip) and the
// link toggle row (its label, caption and button) keep their own words
// whole, stay inside their own row without overlapping, read on one line
// (the caption on at most two) down to 280px, and do not move at widths
// where they already fit. Written against the current app/globals.css,
// before the section 1 change exists in this tree.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GLOBALS_CSS_PATH = path.join(REPO_ROOT, 'app', 'globals.css')

interface FixtureRef {
  dir: 'w27' | 'w28'
  file: string
}

const FIXTURES: ReadonlyArray<FixtureRef> = [
  { dir: 'w27', file: 'inbox-empty.html' },
  { dir: 'w27', file: 'inbox-message.html' },
  { dir: 'w28', file: 'inbox-link-off.html' },
]

const VIEWPORTS = [280, 300, 320, 340, 360, 375, 412] as const
type ViewportWidth = (typeof VIEWPORTS)[number]

const FIT_VIEWPORTS = [360, 375, 412] as const

const HEADER = '.inbox-header'
const HEADER_H1 = '.inbox-header > h1'
const HEADER_BADGE = '.inbox-header > .inbox-badge'
const TOGGLE = '.toggle'
const TOGGLE_TEXT_SPAN = '.toggle > span'
const TOGGLE_LABEL = '.toggle > span > strong'
const TOGGLE_CAPTION = '.toggle > span > span'
const TOGGLE_BUTTON = '.toggle > button'

function label(fx: FixtureRef): string {
  return fx.file
}

function fixturePath(fx: FixtureRef): string {
  return path.join(REPO_ROOT, 'test', 'fixtures', fx.dir, fx.file)
}

function loadFixtureWithCss(fx: FixtureRef): string {
  const html = readFileSync(fixturePath(fx), 'utf8')
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8')
  const headClose = '</head>'
  const headIdx = html.indexOf(headClose)
  assert.ok(headIdx !== -1, `fixture ${fx.file} must contain </head>`)
  return html.slice(0, headIdx) + '<style>' + css + '</style>' + html.slice(headIdx)
}

let browser: Browser
const contexts = new Map<ViewportWidth, BrowserContext>()
const pages = new Map<ViewportWidth, Page>()

async function renderFixture(width: ViewportWidth, fx: FixtureRef): Promise<Page> {
  const page = pages.get(width)
  assert.ok(page, `page for viewport ${width} must be initialized`)
  const html = loadFixtureWithCss(fx)
  await page.setContent(html)
  await page.evaluate(() => {
    for (const anim of document.getAnimations()) {
      try {
        anim.finish()
      } catch {
        anim.pause()
        anim.currentTime = 0
      }
    }
  })
  return page
}

// A word is a maximal run of non-whitespace characters in one text node. It
// is whole when every client rect of a Range over exactly that word, after
// dropping rects narrower than 0.5px, shares one top within 3px. "On one
// line" is the same test run over a Range spanning the element's whole text.
interface WordRectInfo {
  word: string
  tops: number[]
}

function isWhole(tops: number[]): boolean {
  if (tops.length === 0) return true
  return Math.max(...tops) - Math.min(...tops) <= 3
}

function assertWordsWhole(words: WordRectInfo[], context: string): void {
  for (const w of words) {
    assert.ok(isWhole(w.tops), `${context}: word "${w.word}" is split across tops ${w.tops.join(', ')}`)
  }
}

// Counts distinct line tops within 3px of each other, greedily, for the
// "at most two lines" test on the toggle caption.
function clusterCount(tops: number[], tol: number): number {
  const clusters: number[] = []
  for (const t of tops) {
    if (!clusters.some((c) => Math.abs(c - t) <= tol)) clusters.push(t)
  }
  return clusters.length
}

async function collectWords(page: Page, selector: string): Promise<{ count: number; words: WordRectInfo[] }> {
  return page.evaluate((sel) => {
    const words: { word: string; tops: number[] }[] = []
    const elements = Array.from(document.querySelectorAll<HTMLElement>(sel))
    for (const el of elements) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()
      while (node) {
        const text = node.nodeValue ?? ''
        const re = /\S+/g
        let m = re.exec(text)
        while (m) {
          const range = document.createRange()
          range.setStart(node, m.index)
          range.setEnd(node, m.index + m[0].length)
          const rects = Array.from(range.getClientRects()).filter((r) => r.width >= 0.5)
          words.push({ word: m[0], tops: rects.map((r) => r.top) })
          m = re.exec(text)
        }
        node = walker.nextNode()
      }
    }
    return { count: elements.length, words }
  }, selector)
}

async function getElementLineTops(page: Page, selector: string): Promise<number[] | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel)
    if (!el) return null
    const range = document.createRange()
    range.selectNodeContents(el)
    const rects = Array.from(range.getClientRects()).filter((r) => r.width >= 0.5)
    return rects.map((r) => r.top)
  }, selector)
}

interface PlainRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

interface RowLayout {
  header: PlainRect | null
  h1: PlainRect | null
  badge: PlainRect | null
  toggle: PlainRect | null
  textSpan: PlainRect | null
  button: PlainRect | null
}

async function getRowLayout(page: Page): Promise<RowLayout> {
  return page.evaluate(
    (sel) => {
      const header = document.querySelector<HTMLElement>(sel.header)
      const h1 = document.querySelector<HTMLElement>(sel.headerH1)
      const badge = document.querySelector<HTMLElement>(sel.headerBadge)
      const toggle = document.querySelector<HTMLElement>(sel.toggle)
      const textSpan = document.querySelector<HTMLElement>(sel.toggleTextSpan)
      const button = document.querySelector<HTMLElement>(sel.toggleButton)

      const headerRect = header ? header.getBoundingClientRect() : null
      const h1Rect = h1 ? h1.getBoundingClientRect() : null
      const badgeRect = badge ? badge.getBoundingClientRect() : null
      const toggleRect = toggle ? toggle.getBoundingClientRect() : null
      const textSpanRect = textSpan ? textSpan.getBoundingClientRect() : null
      const buttonRect = button ? button.getBoundingClientRect() : null

      return {
        header: headerRect
          ? {
              left: headerRect.left,
              top: headerRect.top,
              right: headerRect.right,
              bottom: headerRect.bottom,
              width: headerRect.width,
              height: headerRect.height,
            }
          : null,
        h1: h1Rect
          ? { left: h1Rect.left, top: h1Rect.top, right: h1Rect.right, bottom: h1Rect.bottom, width: h1Rect.width, height: h1Rect.height }
          : null,
        badge: badgeRect
          ? {
              left: badgeRect.left,
              top: badgeRect.top,
              right: badgeRect.right,
              bottom: badgeRect.bottom,
              width: badgeRect.width,
              height: badgeRect.height,
            }
          : null,
        toggle: toggleRect
          ? {
              left: toggleRect.left,
              top: toggleRect.top,
              right: toggleRect.right,
              bottom: toggleRect.bottom,
              width: toggleRect.width,
              height: toggleRect.height,
            }
          : null,
        textSpan: textSpanRect
          ? {
              left: textSpanRect.left,
              top: textSpanRect.top,
              right: textSpanRect.right,
              bottom: textSpanRect.bottom,
              width: textSpanRect.width,
              height: textSpanRect.height,
            }
          : null,
        button: buttonRect
          ? {
              left: buttonRect.left,
              top: buttonRect.top,
              right: buttonRect.right,
              bottom: buttonRect.bottom,
              width: buttonRect.width,
              height: buttonRect.height,
            }
          : null,
      }
    },
    {
      header: HEADER,
      headerH1: HEADER_H1,
      headerBadge: HEADER_BADGE,
      toggle: TOGGLE,
      toggleTextSpan: TOGGLE_TEXT_SPAN,
      toggleButton: TOGGLE_BUTTON,
    },
  )
}

function assertRectWithin(r: PlainRect, outer: PlainRect, what: string, context: string): void {
  assert.ok(r.left >= outer.left - 1, `${context}: ${what} left (${r.left}) < row left - 1 (${outer.left - 1})`)
  assert.ok(r.top >= outer.top - 1, `${context}: ${what} top (${r.top}) < row top - 1 (${outer.top - 1})`)
  assert.ok(r.right <= outer.right + 1, `${context}: ${what} right (${r.right}) > row right + 1 (${outer.right + 1})`)
  assert.ok(r.bottom <= outer.bottom + 1, `${context}: ${what} bottom (${r.bottom}) > row bottom + 1 (${outer.bottom + 1})`)
}

function overlapArea(a: PlainRect, b: PlainRect): number {
  const overlapW = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const overlapH = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  return overlapW * overlapH
}

interface Item7Data {
  h1Center: number | null
  badgeCenter: number | null
  textSpanTop: number | null
  textSpanBottom: number | null
  buttonTop: number | null
  buttonBottom: number | null
}

async function getItem7Data(page: Page): Promise<Item7Data> {
  return page.evaluate(
    (sel) => {
      const h1 = document.querySelector<HTMLElement>(sel.headerH1)
      const badge = document.querySelector<HTMLElement>(sel.headerBadge)
      const textSpan = document.querySelector<HTMLElement>(sel.toggleTextSpan)
      const button = document.querySelector<HTMLElement>(sel.toggleButton)
      const h1Rect = h1 ? h1.getBoundingClientRect() : null
      const badgeRect = badge ? badge.getBoundingClientRect() : null
      const textSpanRect = textSpan ? textSpan.getBoundingClientRect() : null
      const buttonRect = button ? button.getBoundingClientRect() : null
      return {
        h1Center: h1Rect ? h1Rect.top + h1Rect.height / 2 : null,
        badgeCenter: badgeRect ? badgeRect.top + badgeRect.height / 2 : null,
        textSpanTop: textSpanRect ? textSpanRect.top : null,
        textSpanBottom: textSpanRect ? textSpanRect.bottom : null,
        buttonTop: buttonRect ? buttonRect.top : null,
        buttonBottom: buttonRect ? buttonRect.bottom : null,
      }
    },
    {
      headerH1: HEADER_H1,
      headerBadge: HEADER_BADGE,
      toggleTextSpan: TOGGLE_TEXT_SPAN,
      toggleButton: TOGGLE_BUTTON,
    },
  )
}

before(async () => {
  browser = await chromium.launch()
  for (const width of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width, height: 780 },
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    contexts.set(width, context)
    pages.set(width, page)
  }
})

after(async () => {
  for (const context of contexts.values()) {
    await context.close()
  }
  if (browser) {
    await browser.close()
  }
})

// ---------------------------------------------------------------------------
// Item 1: The fixtures are real
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  test(`item 1: ${label(fx)} exists and has no script tag`, () => {
    const p = fixturePath(fx)
    assert.ok(existsSync(p), `fixture ${label(fx)} must exist`)
    const html = readFileSync(p, 'utf8')
    assert.ok(!/<script/i.test(html), `fixture ${label(fx)} must not contain <script`)
  })
}

for (const fx of FIXTURES) {
  test(`item 1: ${label(fx)} inbox-header and toggle structure`, async () => {
    const page = await renderFixture(280, fx)
    const data = await page.evaluate(
      (sel) => {
        const headers = document.querySelectorAll(sel.header)
        const h1 = document.querySelector<HTMLElement>(sel.headerH1)
        const badges = document.querySelectorAll(sel.headerBadge)
        const toggles = document.querySelectorAll(sel.toggle)
        const textSpans = document.querySelectorAll(sel.toggleTextSpan)
        const labelEl = document.querySelector<HTMLElement>(sel.toggleLabel)
        const captionEl = document.querySelector<HTMLElement>(sel.toggleCaption)
        const buttons = document.querySelectorAll(sel.toggleButton)
        return {
          headerCount: headers.length,
          h1Text: h1 ? (h1.textContent ?? '').trim() : null,
          badgeCount: badges.length,
          toggleCount: toggles.length,
          textSpanCount: textSpans.length,
          labelText: labelEl ? (labelEl.textContent ?? '').trim() : null,
          hasCaption: !!captionEl,
          buttonCount: buttons.length,
          buttonText: buttons.length > 0 ? (buttons[0].textContent ?? '').trim() : null,
        }
      },
      {
        header: HEADER,
        headerH1: HEADER_H1,
        headerBadge: HEADER_BADGE,
        toggle: TOGGLE,
        toggleTextSpan: TOGGLE_TEXT_SPAN,
        toggleLabel: TOGGLE_LABEL,
        toggleCaption: TOGGLE_CAPTION,
        toggleButton: TOGGLE_BUTTON,
      },
    )
    assert.equal(data.headerCount, 1, `${label(fx)}: expected exactly one .inbox-header, found ${data.headerCount}`)
    assert.equal(data.h1Text, 'صندوقك', `${label(fx)}: .inbox-header h1 expected "صندوقك", got "${data.h1Text}"`)
    assert.equal(data.badgeCount, 1, `${label(fx)}: expected exactly one .inbox-badge, found ${data.badgeCount}`)
    assert.equal(data.toggleCount, 1, `${label(fx)}: expected exactly one .toggle, found ${data.toggleCount}`)
    assert.equal(
      data.textSpanCount,
      1,
      `${label(fx)}: expected .toggle's first child to be one span, found ${data.textSpanCount}`,
    )
    assert.equal(
      data.labelText,
      'الرابط شغال',
      `${label(fx)}: toggle label expected "الرابط شغال", got "${data.labelText}"`,
    )
    assert.ok(data.hasCaption, `${label(fx)}: toggle text span must hold a caption span`)
    assert.equal(data.buttonCount, 1, `${label(fx)}: expected exactly one button in .toggle, found ${data.buttonCount}`)
    const expectedButtonText = fx.dir === 'w28' ? 'شغل الرابط' : 'طفي الرابط'
    assert.equal(
      data.buttonText,
      expectedButtonText,
      `${label(fx)}: toggle button expected "${expectedButtonText}", got "${data.buttonText}"`,
    )
  })
}

// ---------------------------------------------------------------------------
// Item 2: No page is wider than the screen
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 2: ${label(fx)} at ${width}px`, async () => {
      const page = await renderFixture(width, fx)
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      assert.ok(
        scrollWidth <= width,
        `${label(fx)} at ${width}px: scrollWidth was ${scrollWidth}, expected <= ${width}`,
      )
    })
  }
}

// ---------------------------------------------------------------------------
// Item 3: No word in either row is split
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 3: ${label(fx)} at ${width}px`, async () => {
      const page = await renderFixture(width, fx)
      const { count, words } = await collectWords(page, `${HEADER}, ${TOGGLE}`)
      assert.ok(count > 0, `${label(fx)} at ${width}px: expected .inbox-header and .toggle to exist`)
      assertWordsWhole(words, `${label(fx)} at ${width}px`)
    })
  }
}

// ---------------------------------------------------------------------------
// Item 4: Each row holds what is in it
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 4: ${label(fx)} at ${width}px`, async () => {
      const page = await renderFixture(width, fx)
      const layout = await getRowLayout(page)
      assert.ok(layout.header, `${label(fx)} at ${width}px: .inbox-header must exist`)
      assert.ok(layout.h1, `${label(fx)} at ${width}px: .inbox-header h1 must exist`)
      assert.ok(layout.badge, `${label(fx)} at ${width}px: .inbox-badge must exist`)
      assert.ok(layout.toggle, `${label(fx)} at ${width}px: .toggle must exist`)
      assert.ok(layout.textSpan, `${label(fx)} at ${width}px: .toggle text span must exist`)
      assert.ok(layout.button, `${label(fx)} at ${width}px: .toggle button must exist`)

      const header = layout.header as PlainRect
      const h1 = layout.h1 as PlainRect
      const badge = layout.badge as PlainRect
      const toggle = layout.toggle as PlainRect
      const textSpan = layout.textSpan as PlainRect
      const button = layout.button as PlainRect

      const context = `${label(fx)} at ${width}px`
      assertRectWithin(h1, header, 'h1', context)
      assertRectWithin(badge, header, '.inbox-badge', context)
      const headerOverlap = overlapArea(h1, badge)
      assert.ok(headerOverlap <= 1, `${context}: h1 and .inbox-badge overlap by ${headerOverlap}px squared`)

      assertRectWithin(textSpan, toggle, 'toggle text span', context)
      assertRectWithin(button, toggle, 'toggle button', context)
      const toggleOverlap = overlapArea(textSpan, button)
      assert.ok(toggleOverlap <= 1, `${context}: toggle text span and button overlap by ${toggleOverlap}px squared`)
    })
  }
}

// ---------------------------------------------------------------------------
// Item 5: Short texts stay on one line
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 5: ${label(fx)} at ${width}px`, async () => {
      const page = await renderFixture(width, fx)
      const checks: ReadonlyArray<{ name: string; selector: string }> = [
        { name: 'heading', selector: HEADER_H1 },
        { name: 'chip text', selector: HEADER_BADGE },
        { name: 'toggle label', selector: TOGGLE_LABEL },
        { name: 'toggle button text', selector: TOGGLE_BUTTON },
      ]
      for (const c of checks) {
        const tops = await getElementLineTops(page, c.selector)
        assert.ok(tops !== null, `${label(fx)} at ${width}px: ${c.name} (${c.selector}) must exist`)
        const t = tops as number[]
        assert.ok(isWhole(t), `${label(fx)} at ${width}px: ${c.name} expected one line, tops ${t.join(', ')}`)
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Item 6: The caption is read, not stacked
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 6: ${label(fx)} at ${width}px`, async () => {
      const page = await renderFixture(width, fx)
      const tops = await getElementLineTops(page, TOGGLE_CAPTION)
      assert.ok(tops !== null, `${label(fx)} at ${width}px: toggle caption span must exist`)
      const t = tops as number[]
      const lineCount = clusterCount(t, 3)
      assert.ok(
        lineCount <= 2,
        `${label(fx)} at ${width}px: toggle caption expected at most two lines, got ${lineCount} (tops: ${t.join(', ')})`,
      )
    })
  }
}

// ---------------------------------------------------------------------------
// Item 7: Where they fit, they do not move
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  for (const width of FIT_VIEWPORTS) {
    test(`item 7: ${label(fx)} at ${width}px`, async () => {
      const page = await renderFixture(width, fx)
      const data = await getItem7Data(page)
      assert.ok(data.h1Center !== null, `${label(fx)} at ${width}px: heading must exist`)
      assert.ok(data.badgeCenter !== null, `${label(fx)} at ${width}px: chip must exist`)
      assert.ok(
        data.textSpanTop !== null && data.textSpanBottom !== null,
        `${label(fx)} at ${width}px: toggle text span must exist`,
      )
      assert.ok(
        data.buttonTop !== null && data.buttonBottom !== null,
        `${label(fx)} at ${width}px: toggle button must exist`,
      )
      const h1Center = data.h1Center as number
      const badgeCenter = data.badgeCenter as number
      const centerDiff = Math.abs(h1Center - badgeCenter)
      assert.ok(
        centerDiff <= 2,
        `${label(fx)} at ${width}px: heading/chip vertical centres differ by ${centerDiff}, expected <= 2`,
      )
      const textTop = data.textSpanTop as number
      const textBottom = data.textSpanBottom as number
      const btnTop = data.buttonTop as number
      const btnBottom = data.buttonBottom as number
      const overlap = Math.min(textBottom, btnBottom) - Math.max(textTop, btnTop)
      assert.ok(
        overlap > 0,
        `${label(fx)} at ${width}px: button vertical extent [${btnTop}, ${btnBottom}] does not overlap toggle text span [${textTop}, ${textBottom}]`,
      )
    })
  }
}

// ---------------------------------------------------------------------------
// Item 8: The browser is real
// ---------------------------------------------------------------------------

test('item 8: the browser is real and launches', () => {
  assert.ok(browser, 'Chromium browser must be running')
  assert.ok(browser.isConnected(), 'Chromium must be connected')
  for (const width of VIEWPORTS) {
    assert.ok(contexts.get(width), `browser context for ${width}px must exist`)
    assert.ok(pages.get(width), `page for ${width}px must exist`)
  }
})
