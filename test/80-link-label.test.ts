// test/80-link-label.test.ts
//
// Written from docs/SPEC-week30-link-label.md section 3, items 1 to 10.
// "Word", "whole" and "on one line" mean what
// docs/SPEC-week28-heading-rows.md section 4 says they mean. The caption's
// "at most two lines" uses that section's distinct line tops within 3px.
//
// Expected strings are the section 3 copy. They are not read from the
// fixtures. Fixture files come from W30_FIXTURE_DIR when that variable is
// set, otherwise from test/fixtures/w30. The only
// stylesheet read is app/globals.css, injected before </head>.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GLOBALS_CSS_PATH = path.join(REPO_ROOT, 'app', 'globals.css')

// Section 2 names the three fixtures and which ones have the link on.
// Section 3 gives the copy each state must show.
interface FixtureRef {
  file: string
  linkOn: boolean
}

const FIXTURES: ReadonlyArray<FixtureRef> = [
  { file: 'inbox-empty.html', linkOn: true },
  { file: 'inbox-message.html', linkOn: true },
  { file: 'inbox-link-off.html', linkOn: false },
]

const BARE_LABEL = 'الرابط'
const OLD_LABEL = 'الرابط شغال'

const LINK_ON = {
  caption: 'الناس تقدر تبعتلك هلق.',
  button: 'طفي الرابط',
  head: 'شغال',
} as const

const LINK_OFF = {
  caption: 'ما حدا يقدر يبعتلك لحد ما تشغلو.',
  button: 'شغل الرابط',
  head: 'مطفي',
} as const

const VIEWPORTS = [280, 300, 320, 340, 360, 375, 412] as const
type ViewportWidth = (typeof VIEWPORTS)[number]

const FIT_VIEWPORTS = [360, 375, 412] as const

const VIEWPORT_HEIGHT = 780

const TOGGLE = '.toggle'
const TOGGLE_TEXT_SPAN = '.toggle > span'
const TOGGLE_LABEL = '.toggle > span > strong'
const TOGGLE_CAPTION = '.toggle > span > span'
const TOGGLE_BUTTON = '.toggle > button'

function fixtureDir(): string {
  const fromEnv = process.env.W30_FIXTURE_DIR
  if (fromEnv && fromEnv.trim() !== '') return path.resolve(fromEnv)
  return path.join(REPO_ROOT, 'test', 'fixtures', 'w30')
}

function fixturePath(file: string): string {
  return path.join(fixtureDir(), file)
}

function expectedState(fx: FixtureRef): { caption: string; button: string; head: string } {
  return fx.linkOn ? LINK_ON : LINK_OFF
}

function loadFixtureWithCss(file: string): string {
  const html = readFileSync(fixturePath(file), 'utf8')
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8')
  const headClose = '</head>'
  const headIdx = html.indexOf(headClose)
  assert.ok(headIdx !== -1, `fixture ${file} must contain </head>`)
  return html.slice(0, headIdx) + '<style>' + css + '</style>' + html.slice(headIdx)
}

let browser: Browser | undefined
const contexts = new Map<ViewportWidth, BrowserContext>()
const pages = new Map<ViewportWidth, Page>()

async function renderFixture(width: ViewportWidth, file: string): Promise<Page> {
  const page = pages.get(width)
  assert.ok(page, `page for viewport ${width} must be initialized`)
  const html = loadFixtureWithCss(file)
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
}

interface ToggleLayout {
  toggle: PlainRect | null
  textSpan: PlainRect | null
  button: PlainRect | null
}

async function getToggleLayout(page: Page): Promise<ToggleLayout> {
  return page.evaluate((sel) => {
    const toggle = document.querySelector<HTMLElement>(sel.toggle)
    const textSpan = document.querySelector<HTMLElement>(sel.toggleTextSpan)
    const button = document.querySelector<HTMLElement>(sel.toggleButton)
    const toggleRect = toggle ? toggle.getBoundingClientRect() : null
    const textSpanRect = textSpan ? textSpan.getBoundingClientRect() : null
    const buttonRect = button ? button.getBoundingClientRect() : null
    return {
      toggle: toggleRect
        ? { left: toggleRect.left, top: toggleRect.top, right: toggleRect.right, bottom: toggleRect.bottom }
        : null,
      textSpan: textSpanRect
        ? {
            left: textSpanRect.left,
            top: textSpanRect.top,
            right: textSpanRect.right,
            bottom: textSpanRect.bottom,
          }
        : null,
      button: buttonRect
        ? { left: buttonRect.left, top: buttonRect.top, right: buttonRect.right, bottom: buttonRect.bottom }
        : null,
    }
  }, { toggle: TOGGLE, toggleTextSpan: TOGGLE_TEXT_SPAN, toggleButton: TOGGLE_BUTTON })
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

interface VerticalExtents {
  textTop: number | null
  textBottom: number | null
  buttonTop: number | null
  buttonBottom: number | null
}

async function getVerticalExtents(page: Page): Promise<VerticalExtents> {
  return page.evaluate((sel) => {
    const textSpan = document.querySelector<HTMLElement>(sel.toggleTextSpan)
    const button = document.querySelector<HTMLElement>(sel.toggleButton)
    const textSpanRect = textSpan ? textSpan.getBoundingClientRect() : null
    const buttonRect = button ? button.getBoundingClientRect() : null
    return {
      textTop: textSpanRect ? textSpanRect.top : null,
      textBottom: textSpanRect ? textSpanRect.bottom : null,
      buttonTop: buttonRect ? buttonRect.top : null,
      buttonBottom: buttonRect ? buttonRect.bottom : null,
    }
  }, { toggleTextSpan: TOGGLE_TEXT_SPAN, toggleButton: TOGGLE_BUTTON })
}

// chromium.launch() is not caught. If it throws, node:test fails every test
// in this file with that error and does not skip any of them.
before(async () => {
  browser = await chromium.launch()
  for (const width of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width, height: VIEWPORT_HEIGHT },
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
  test(`item 1: ${fx.file} exists and contains no script tag`, () => {
    const p = fixturePath(fx.file)
    assert.ok(existsSync(p), `fixture ${fx.file} must exist`)
    const html = readFileSync(p, 'utf8')
    assert.ok(!/<script/i.test(html), `fixture ${fx.file} must not contain <script`)
  })
}

for (const fx of FIXTURES) {
  test(`item 1: ${fx.file} toggle structure`, async () => {
    const page = await renderFixture(280, fx.file)
    const data = await page.evaluate(() => {
      const toggles = Array.from(document.querySelectorAll('.toggle'))
      const toggle = toggles[0] ?? null
      let firstChildTag: string | null = null
      let strongCount = 0
      let captionCount = 0
      if (toggle && toggle.firstChild && toggle.firstChild.nodeType === Node.ELEMENT_NODE) {
        const first = toggle.firstChild instanceof Element ? toggle.firstChild : null
        firstChildTag = first ? first.tagName : null
        if (first) {
          for (const child of Array.from(first.children)) {
            if (child.tagName === 'STRONG') strongCount += 1
            if (child.tagName === 'SPAN') captionCount += 1
          }
        }
      }
      const buttonCount = toggle ? toggle.querySelectorAll('button').length : 0
      return {
        toggleCount: toggles.length,
        firstChildTag,
        strongCount,
        captionCount,
        buttonCount,
      }
    })
    assert.equal(data.toggleCount, 1, `${fx.file}: expected exactly one .toggle, found ${data.toggleCount}`)
    assert.equal(
      data.firstChildTag,
      'SPAN',
      `${fx.file}: .toggle's first child must be a span, found ${data.firstChildTag}`,
    )
    assert.ok(data.strongCount >= 1, `${fx.file}: the text span must hold a strong, found ${data.strongCount}`)
    assert.ok(
      data.captionCount >= 1,
      `${fx.file}: the text span must hold a caption span, found ${data.captionCount}`,
    )
    assert.equal(data.buttonCount, 1, `${fx.file}: expected exactly one button in .toggle, found ${data.buttonCount}`)
  })
}

// ---------------------------------------------------------------------------
// Item 2: The label is the bare word, in both states
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  test(`item 2: ${fx.file} the label is the bare word`, async () => {
    const page = await renderFixture(280, fx.file)
    const data = await page.evaluate(() => {
      const toggle = document.querySelector('.toggle')
      const textSpan = toggle ? toggle.firstElementChild : null
      const strongs = textSpan ? Array.from(textSpan.children).filter((el) => el.tagName === 'STRONG') : []
      const strong = strongs[0]
      return {
        count: strongs.length,
        text: strong ? (strong.textContent ?? '').trim() : null,
      }
    })
    assert.equal(data.count, 1, `${fx.file}: expected one strong in the toggle text span, found ${data.count}`)
    assert.equal(data.text, BARE_LABEL, `${fx.file}: strong text expected "${BARE_LABEL}", got "${data.text}"`)
  })
}

// ---------------------------------------------------------------------------
// Item 3: The state is still said
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  test(`item 3: ${fx.file} the state is still said`, async () => {
    const page = await renderFixture(280, fx.file)
    const expected = expectedState(fx)
    const data = await page.evaluate(() => {
      const toggle = document.querySelector('.toggle')
      const textSpan = toggle ? toggle.firstElementChild : null
      const captions = textSpan ? Array.from(textSpan.children).filter((el) => el.tagName === 'SPAN') : []
      const caption = captions[0]
      const buttons = toggle ? Array.from(toggle.querySelectorAll('button')) : []
      const button = buttons[0]
      const heads = Array.from(document.querySelectorAll('.linkblock__head'))
      const head = heads[0]
      const headSpans = head ? Array.from(head.children).filter((el) => el.tagName === 'SPAN') : []
      const second = headSpans[1]
      return {
        captionCount: captions.length,
        caption: caption ? (caption.textContent ?? '').trim() : null,
        buttonCount: buttons.length,
        button: button ? (button.textContent ?? '').trim() : null,
        headCount: heads.length,
        headSpanCount: headSpans.length,
        headSecond: second ? (second.textContent ?? '').trim() : null,
      }
    })
    assert.ok(data.captionCount >= 1, `${fx.file}: toggle text span must hold a caption span`)
    assert.equal(
      data.caption,
      expected.caption,
      `${fx.file}: caption expected "${expected.caption}", got "${data.caption}"`,
    )
    assert.equal(data.buttonCount, 1, `${fx.file}: expected exactly one button, found ${data.buttonCount}`)
    assert.equal(
      data.button,
      expected.button,
      `${fx.file}: button expected "${expected.button}", got "${data.button}"`,
    )
    assert.equal(data.headCount, 1, `${fx.file}: expected one .linkblock__head, found ${data.headCount}`)
    assert.ok(
      data.headSpanCount >= 2,
      `${fx.file}: .linkblock__head must have a second span, found ${data.headSpanCount}`,
    )
    assert.equal(
      data.headSecond,
      expected.head,
      `${fx.file}: .linkblock__head second span expected "${expected.head}", got "${data.headSecond}"`,
    )
  })
}

// ---------------------------------------------------------------------------
// Item 4: The old label is gone
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  test(`item 4: ${fx.file} the old label is gone`, () => {
    const p = fixturePath(fx.file)
    assert.ok(existsSync(p), `fixture ${fx.file} must exist`)
    const html = readFileSync(p, 'utf8')
    assert.ok(!html.includes(OLD_LABEL), `${fx.file} must not contain "${OLD_LABEL}"`)
  })
}

// ---------------------------------------------------------------------------
// Item 5: No page is wider than the screen
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 5: ${fx.file} at ${width}px no page is wider than the screen`, async () => {
      const page = await renderFixture(width, fx.file)
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      assert.ok(
        scrollWidth <= width,
        `${fx.file} at ${width}px: scrollWidth was ${scrollWidth}, expected <= ${width}`,
      )
    })
  }
}

// ---------------------------------------------------------------------------
// Item 6: No word in the row is split
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 6: ${fx.file} at ${width}px no word in the row is split`, async () => {
      const page = await renderFixture(width, fx.file)
      const { count, words } = await collectWords(page, TOGGLE)
      assert.equal(count, 1, `${fx.file} at ${width}px: expected one .toggle, found ${count}`)
      assertWordsWhole(words, `${fx.file} at ${width}px`)
    })
  }
}

// ---------------------------------------------------------------------------
// Item 7: The row holds what is in it
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 7: ${fx.file} at ${width}px the row holds what is in it`, async () => {
      const page = await renderFixture(width, fx.file)
      const layout = await getToggleLayout(page)
      assert.ok(layout.toggle, `${fx.file} at ${width}px: .toggle must exist`)
      assert.ok(layout.textSpan, `${fx.file} at ${width}px: .toggle text span must exist`)
      assert.ok(layout.button, `${fx.file} at ${width}px: .toggle button must exist`)
      const toggle = layout.toggle
      const textSpan = layout.textSpan
      const button = layout.button
      const context = `${fx.file} at ${width}px`
      assertRectWithin(textSpan, toggle, 'toggle text span', context)
      assertRectWithin(button, toggle, 'toggle button', context)
      const area = overlapArea(textSpan, button)
      assert.ok(area <= 1, `${context}: toggle text span and button overlap by ${area}px squared`)
    })
  }
}

// ---------------------------------------------------------------------------
// Item 8: Short texts stay on one line; the caption at most two
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 8: ${fx.file} at ${width}px short texts stay on one line`, async () => {
      const page = await renderFixture(width, fx.file)
      const checks: ReadonlyArray<{ name: string; selector: string }> = [
        { name: 'toggle label', selector: TOGGLE_LABEL },
        { name: 'toggle button text', selector: TOGGLE_BUTTON },
      ]
      for (const c of checks) {
        const tops = await getElementLineTops(page, c.selector)
        assert.ok(tops !== null, `${fx.file} at ${width}px: ${c.name} (${c.selector}) must exist`)
        assert.ok(isWhole(tops), `${fx.file} at ${width}px: ${c.name} expected one line, tops ${tops.join(', ')}`)
      }
      const captionTops = await getElementLineTops(page, TOGGLE_CAPTION)
      assert.ok(captionTops !== null, `${fx.file} at ${width}px: toggle caption span must exist`)
      const lineCount = clusterCount(captionTops, 3)
      assert.ok(
        lineCount <= 2,
        `${fx.file} at ${width}px: toggle caption expected at most two lines, got ${lineCount} (tops: ${captionTops.join(', ')})`,
      )
    })
  }
}

// ---------------------------------------------------------------------------
// Item 9: Where it fits, the button sits beside the text
// ---------------------------------------------------------------------------

for (const fx of FIXTURES) {
  for (const width of FIT_VIEWPORTS) {
    test(`item 9: ${fx.file} at ${width}px the button sits beside the text`, async () => {
      const page = await renderFixture(width, fx.file)
      const data = await getVerticalExtents(page)
      assert.ok(
        data.textTop !== null && data.textBottom !== null,
        `${fx.file} at ${width}px: toggle text span must exist`,
      )
      assert.ok(
        data.buttonTop !== null && data.buttonBottom !== null,
        `${fx.file} at ${width}px: toggle button must exist`,
      )
      const textTop = data.textTop
      const textBottom = data.textBottom
      const buttonTop = data.buttonTop
      const buttonBottom = data.buttonBottom
      const overlap = Math.min(textBottom, buttonBottom) - Math.max(textTop, buttonTop)
      assert.ok(
        overlap > 0,
        `${fx.file} at ${width}px: button vertical extent [${buttonTop}, ${buttonBottom}] does not overlap toggle text span [${textTop}, ${textBottom}]`,
      )
    })
  }
}

// ---------------------------------------------------------------------------
// Item 10: The browser is real
// ---------------------------------------------------------------------------

test('item 10: the browser is real', () => {
  assert.ok(browser, 'Chromium browser must be running')
  assert.ok(browser.isConnected(), 'Chromium must be connected')
  for (const width of VIEWPORTS) {
    assert.ok(contexts.get(width), `browser context for ${width}px must exist`)
    assert.ok(pages.get(width), `page for ${width}px must exist`)
  }
})
