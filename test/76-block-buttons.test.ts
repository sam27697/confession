// test/76-block-buttons.test.ts
//
// Week 26 acceptance, written from docs/SPEC-week26-block-buttons.md section 4.
// Proves that full-width block buttons (.btn--block) wrap long labels instead
// of overflowing the button and widening the mobile viewport at 360 px and
// 320 px, while one-line block button labels stay 52 px tall on a single line
// and inline buttons (.btn without .btn--block) keep white-space: nowrap.
// The mutants M1 through M5 are run separately against modified stylesheets.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURES_DIR = path.join(REPO_ROOT, 'test', 'fixtures', 'w26')
const GLOBALS_CSS_PATH = path.join(REPO_ROOT, 'app', 'globals.css')

const FIXTURES = [
  'landing.html',
  'onboarding.html',
  'compose.html',
  'post-send-arabic-name.html',
  'post-send-unbroken-name.html',
  'post-send-short-name.html',
  'offer.html',
  'account-delete.html',
] as const

const NON_POST_SEND_FIXTURES = [
  'landing.html',
  'onboarding.html',
  'compose.html',
  'offer.html',
  'account-delete.html',
] as const

const POST_SEND_RECIPIENTS: ReadonlyArray<{
  file: (typeof FIXTURES)[number]
  recipient: string
}> = [
  { file: 'post-send-arabic-name.html', recipient: 'خالد عبد الكريم الحسيني' },
  { file: 'post-send-unbroken-name.html', recipient: 'o'.repeat(52) },
  { file: 'post-send-short-name.html', recipient: 'هادي' },
]

const VIEWPORTS = [360, 320] as const
type ViewportWidth = (typeof VIEWPORTS)[number]

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
const contexts = new Map<ViewportWidth, BrowserContext>()
const pages = new Map<ViewportWidth, Page>()

async function renderFixture(width: ViewportWidth, fixtureName: string): Promise<Page> {
  const page = pages.get(width)
  assert.ok(page, `page for viewport ${width} must be initialized`)
  const html = loadFixtureWithCss(fixtureName)
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

test('item 1: all eight fixtures exist, contain no script tags, and post-send fixtures carry recipient copy button', async () => {
  for (const file of FIXTURES) {
    const fixturePath = path.join(FIXTURES_DIR, file)
    assert.ok(existsSync(fixturePath), `fixture ${file} must exist`)
    const html = readFileSync(fixturePath, 'utf8')
    assert.ok(!/<script/i.test(html), `fixture ${file} must not contain <script`)
  }

  const page = pages.get(360)
  assert.ok(page, '360px page must exist')

  for (const { file, recipient } of POST_SEND_RECIPIENTS) {
    const fixturePath = path.join(FIXTURES_DIR, file)
    const html = readFileSync(fixturePath, 'utf8')
    await page.setContent(html)

    const matchingTexts: string[] = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'))
      const matches: string[] = []
      for (const el of all) {
        const text = (el.textContent ?? '').trim()
        if (text.startsWith('انسخ رابط') && text.endsWith('لتبعتوه بالغروب')) {
          matches.push(text)
        }
      }
      return matches
    })

    assert.equal(
      matchingTexts.length,
      1,
      `fixture ${file} must contain exactly one element whose text starts with "انسخ رابط" and ends with "لتبعتوه بالغروب", found ${matchingTexts.length}`,
    )
    assert.ok(
      matchingTexts[0].includes(recipient),
      `fixture ${file} copy button text "${matchingTexts[0]}" must contain recipient "${recipient}"`,
    )
  }
})

// ---------------------------------------------------------------------------
// Item 2: No page is wider than the screen
// ---------------------------------------------------------------------------

for (const file of FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 2: ${file} at ${width}px`, async () => {
      const page = await renderFixture(width, file)
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      assert.ok(
        scrollWidth <= width,
        `fixture ${file} at ${width}px: document.documentElement.scrollWidth was ${scrollWidth}, expected <= ${width}`,
      )
    })
  }
}

// ---------------------------------------------------------------------------
// Item 3: Every full-width label is inside its button
// ---------------------------------------------------------------------------

for (const file of FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 3: ${file} at ${width}px`, async () => {
      const page = await renderFixture(width, file)
      const buttons = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll<HTMLElement>('.btn--block'))
        return els.map((btn, index) => {
          const btnRect = btn.getBoundingClientRect()
          const range = document.createRange()
          range.selectNodeContents(btn)
          const rangeRect = range.getBoundingClientRect()
          return {
            index,
            label: (btn.textContent ?? '').trim(),
            btnLeft: btnRect.left,
            btnTop: btnRect.top,
            btnRight: btnRect.right,
            btnBottom: btnRect.bottom,
            rangeLeft: rangeRect.left,
            rangeTop: rangeRect.top,
            rangeRight: rangeRect.right,
            rangeBottom: rangeRect.bottom,
            scrollWidth: btn.scrollWidth,
            clientWidth: btn.clientWidth,
          }
        })
      })

      assert.ok(
        buttons.length > 0,
        `fixture ${file} at ${width}px: expected at least one .btn--block element`,
      )

      for (const b of buttons) {
        assert.ok(
          b.rangeLeft >= b.btnLeft - 1,
          `fixture ${file} at ${width}px: .btn--block[${b.index}] "${b.label}" range left (${b.rangeLeft}) < button left - 1 (${b.btnLeft - 1})`,
        )
        assert.ok(
          b.rangeTop >= b.btnTop - 1,
          `fixture ${file} at ${width}px: .btn--block[${b.index}] "${b.label}" range top (${b.rangeTop}) < button top - 1 (${b.btnTop - 1})`,
        )
        assert.ok(
          b.rangeRight <= b.btnRight + 1,
          `fixture ${file} at ${width}px: .btn--block[${b.index}] "${b.label}" range right (${b.rangeRight}) > button right + 1 (${b.btnRight + 1})`,
        )
        assert.ok(
          b.rangeBottom <= b.btnBottom + 1,
          `fixture ${file} at ${width}px: .btn--block[${b.index}] "${b.label}" range bottom (${b.rangeBottom}) > button bottom + 1 (${b.btnBottom + 1})`,
        )
        assert.ok(
          b.scrollWidth <= b.clientWidth + 1,
          `fixture ${file} at ${width}px: .btn--block[${b.index}] "${b.label}" scrollWidth (${b.scrollWidth}) > clientWidth + 1 (${b.clientWidth + 1})`,
        )
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Item 4: Labels that fit stay as they are
// ---------------------------------------------------------------------------

for (const file of NON_POST_SEND_FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 4: ${file} at ${width}px`, async () => {
      const page = await renderFixture(width, file)
      const buttons = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll<HTMLElement>('.btn--block'))
        return els.map((btn, index) => {
          const btnRect = btn.getBoundingClientRect()
          const range = document.createRange()
          range.selectNodeContents(btn)
          const clientRects = Array.from(range.getClientRects())
          const lineTops: number[] = []
          for (const r of clientRects) {
            if (!lineTops.some((t) => Math.abs(t - r.top) <= 2)) {
              lineTops.push(r.top)
            }
          }
          return {
            index,
            label: (btn.textContent ?? '').trim(),
            height: btnRect.height,
            rectTops: clientRects.map((r) => r.top),
            lineCount: lineTops.length,
          }
        })
      })

      assert.ok(
        buttons.length > 0,
        `fixture ${file} at ${width}px: expected at least one .btn--block element`,
      )

      for (const b of buttons) {
        assert.ok(
          Math.abs(b.height - 52) <= 0.5,
          `fixture ${file} at ${width}px: .btn--block[${b.index}] "${b.label}" height was ${b.height}, expected 52 (+/-0.5)`,
        )
        assert.equal(
          b.lineCount,
          1,
          `fixture ${file} at ${width}px: .btn--block[${b.index}] "${b.label}" expected 1 line, got ${b.lineCount} (tops: ${b.rectTops.join(', ')})`,
        )
      }
    })
  }
}

for (const { file } of POST_SEND_RECIPIENTS) {
  for (const width of VIEWPORTS) {
    test(`item 4: ${file} first two .btn--block at ${width}px`, async () => {
      const page = await renderFixture(width, file)
      const buttons = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll<HTMLElement>('.btn--block'))
        return els.slice(0, 2).map((btn, index) => {
          const btnRect = btn.getBoundingClientRect()
          const range = document.createRange()
          range.selectNodeContents(btn)
          const clientRects = Array.from(range.getClientRects())
          const lineTops: number[] = []
          for (const r of clientRects) {
            if (!lineTops.some((t) => Math.abs(t - r.top) <= 2)) {
              lineTops.push(r.top)
            }
          }
          return {
            index,
            label: (btn.textContent ?? '').trim(),
            height: btnRect.height,
            rectTops: clientRects.map((r) => r.top),
            lineCount: lineTops.length,
          }
        })
      })

      assert.equal(
        buttons.length,
        2,
        `fixture ${file} at ${width}px: expected at least two .btn--block elements`,
      )
      assert.ok(
        buttons[0].label.includes('افتح صندوقك السري'),
        `fixture ${file} at ${width}px: first .btn--block expected "افتح صندوقك السري", got "${buttons[0].label}"`,
      )
      assert.ok(
        buttons[1].label.includes('عرض الرسائل المرسلة'),
        `fixture ${file} at ${width}px: second .btn--block expected "عرض الرسائل المرسلة", got "${buttons[1].label}"`,
      )

      for (const b of buttons) {
        assert.ok(
          Math.abs(b.height - 52) <= 0.5,
          `fixture ${file} at ${width}px: .btn--block[${b.index}] "${b.label}" height was ${b.height}, expected 52 (+/-0.5)`,
        )
        assert.equal(
          b.lineCount,
          1,
          `fixture ${file} at ${width}px: .btn--block[${b.index}] "${b.label}" expected 1 line, got ${b.lineCount} (tops: ${b.rectTops.join(', ')})`,
        )
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Item 5: The long label wraps, and the button holds it
// ---------------------------------------------------------------------------

test('item 5: post-send-arabic-name.html at 360px wraps copy button label onto 2+ lines and grows taller than 52px', async () => {
  const page = await renderFixture(360, 'post-send-arabic-name.html')
  const copyBtn = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.btn--block'))
    const btn = els.find((el) => {
      const t = (el.textContent ?? '').trim()
      return t.startsWith('انسخ رابط') && t.endsWith('لتبعتوه بالغروب')
    })
    if (!btn) return null
    const btnRect = btn.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(btn)
    const clientRects = Array.from(range.getClientRects())
    const lineTops: number[] = []
    for (const r of clientRects) {
      if (!lineTops.some((t) => Math.abs(t - r.top) <= 2)) {
        lineTops.push(r.top)
      }
    }
    return {
      label: (btn.textContent ?? '').trim(),
      height: btnRect.height,
      lineCount: lineTops.length,
    }
  })

  assert.ok(copyBtn, 'post-send-arabic-name.html at 360px: copy button must exist')
  assert.ok(
    copyBtn.lineCount >= 2,
    `post-send-arabic-name.html at 360px: copy button expected >= 2 lines, got ${copyBtn.lineCount}`,
  )
  assert.ok(
    copyBtn.height > 52,
    `post-send-arabic-name.html at 360px: copy button height was ${copyBtn.height}, expected > 52`,
  )
})

for (const width of VIEWPORTS) {
  test(`item 5: post-send-unbroken-name.html at ${width}px wraps copy button label, grows taller than 52px, and holds label inside button`, async () => {
    const page = await renderFixture(width, 'post-send-unbroken-name.html')
    const copyBtn = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('.btn--block'))
      const btn = els.find((el) => {
        const t = (el.textContent ?? '').trim()
        return t.startsWith('انسخ رابط') && t.endsWith('لتبعتوه بالغروب')
      })
      if (!btn) return null
      const btnRect = btn.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(btn)
      const rangeRect = range.getBoundingClientRect()
      const clientRects = Array.from(range.getClientRects())
      const lineTops: number[] = []
      for (const r of clientRects) {
        if (!lineTops.some((t) => Math.abs(t - r.top) <= 2)) {
          lineTops.push(r.top)
        }
      }
      return {
        label: (btn.textContent ?? '').trim(),
        height: btnRect.height,
        lineCount: lineTops.length,
        btnLeft: btnRect.left,
        btnTop: btnRect.top,
        btnRight: btnRect.right,
        btnBottom: btnRect.bottom,
        rangeLeft: rangeRect.left,
        rangeTop: rangeRect.top,
        rangeRight: rangeRect.right,
        rangeBottom: rangeRect.bottom,
        scrollWidth: btn.scrollWidth,
        clientWidth: btn.clientWidth,
      }
    })

    assert.ok(copyBtn, `post-send-unbroken-name.html at ${width}px: copy button must exist`)
    assert.ok(
      copyBtn.lineCount >= 2,
      `post-send-unbroken-name.html at ${width}px: copy button expected >= 2 lines, got ${copyBtn.lineCount}`,
    )
    assert.ok(
      copyBtn.height > 52,
      `post-send-unbroken-name.html at ${width}px: copy button height was ${copyBtn.height}, expected > 52`,
    )
    assert.ok(
      copyBtn.rangeLeft >= copyBtn.btnLeft - 1,
      `post-send-unbroken-name.html at ${width}px: copy button range left (${copyBtn.rangeLeft}) < button left - 1 (${copyBtn.btnLeft - 1})`,
    )
    assert.ok(
      copyBtn.rangeTop >= copyBtn.btnTop - 1,
      `post-send-unbroken-name.html at ${width}px: copy button range top (${copyBtn.rangeTop}) < button top - 1 (${copyBtn.btnTop - 1})`,
    )
    assert.ok(
      copyBtn.rangeRight <= copyBtn.btnRight + 1,
      `post-send-unbroken-name.html at ${width}px: copy button range right (${copyBtn.rangeRight}) > button right + 1 (${copyBtn.btnRight + 1})`,
    )
    assert.ok(
      copyBtn.rangeBottom <= copyBtn.btnBottom + 1,
      `post-send-unbroken-name.html at ${width}px: copy button range bottom (${copyBtn.rangeBottom}) > button bottom + 1 (${copyBtn.btnBottom + 1})`,
    )
    assert.ok(
      copyBtn.scrollWidth <= copyBtn.clientWidth + 1,
      `post-send-unbroken-name.html at ${width}px: copy button scrollWidth (${copyBtn.scrollWidth}) > clientWidth + 1 (${copyBtn.clientWidth + 1})`,
    )
  })
}

// ---------------------------------------------------------------------------
// Item 6: Inline buttons are untouched
// ---------------------------------------------------------------------------

test('item 6: inline .btn elements without .btn--block in post-send-arabic-name.html keep white-space: nowrap', async () => {
  for (const width of VIEWPORTS) {
    const page = await renderFixture(width, 'post-send-arabic-name.html')
    const inlineButtons = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('.btn:not(.btn--block)'))
      return els.map((btn, index) => ({
        index,
        label: (btn.textContent ?? '').trim(),
        whiteSpace: window.getComputedStyle(btn).whiteSpace,
      }))
    })

    assert.ok(
      inlineButtons.length >= 1,
      `post-send-arabic-name.html at ${width}px: expected at least one .btn:not(.btn--block) element`,
    )

    for (const b of inlineButtons) {
      assert.equal(
        b.whiteSpace,
        'nowrap',
        `post-send-arabic-name.html at ${width}px: inline .btn[${b.index}] "${b.label}" computed white-space was "${b.whiteSpace}", expected "nowrap"`,
      )
    }
  }
})

// ---------------------------------------------------------------------------
// Item 7: The browser is real
// ---------------------------------------------------------------------------

test('item 7: the browser is real and launches', () => {
  assert.ok(browser, 'Chromium browser must be running')
  assert.ok(browser.isConnected(), 'Chromium must be connected')
  for (const width of VIEWPORTS) {
    assert.ok(contexts.get(width), `browser context for ${width}px must exist`)
    assert.ok(pages.get(width), `page for ${width}px must exist`)
  }
})
