// test/77-nav-words.test.ts
//
// Week 27 acceptance, written from docs/SPEC-week27-nav-words.md section 4.
// Proves that the header nav labels and the logout button do not split their
// own words below 375px, that the header holds its three controls without
// overlap, that wide screens keep one row, and that the inbox link block's
// two buttons keep their labels inside their own borders at every width
// while staying untouched where they already fit. Written against the
// current app/globals.css, before the section 1 change exists in this tree.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GLOBALS_CSS_PATH = path.join(REPO_ROOT, 'app', 'globals.css')

interface FixtureRef {
  dir: 'w26' | 'w27'
  file: string
}

const W27_FIXTURES: ReadonlyArray<FixtureRef> = [
  { dir: 'w27', file: 'inbox-empty.html' },
  { dir: 'w27', file: 'inbox-message.html' },
  { dir: 'w27', file: 'sent.html' },
]

const W26_FIXTURES: ReadonlyArray<FixtureRef> = [
  { dir: 'w26', file: 'landing.html' },
  { dir: 'w26', file: 'onboarding.html' },
  { dir: 'w26', file: 'compose.html' },
  { dir: 'w26', file: 'post-send-arabic-name.html' },
  { dir: 'w26', file: 'offer.html' },
  { dir: 'w26', file: 'account-delete.html' },
]

const ALL_FIXTURES: ReadonlyArray<FixtureRef> = [...W27_FIXTURES, ...W26_FIXTURES]

const LANDING: FixtureRef = { dir: 'w26', file: 'landing.html' }
const ONBOARDING: FixtureRef = { dir: 'w26', file: 'onboarding.html' }

// Per spec section 6 (amendment, 2026-10-19 22:4x): app/layout.tsx reads the
// viewer's account only once terms are accepted, so onboarding.html renders
// the signed-out header, exactly like landing.html: one .nav__item reading
// the login label and no logout button.
const SIGNED_OUT_FIXTURES: ReadonlyArray<FixtureRef> = [LANDING, ONBOARDING]

const TWO_ITEM_NAV_FIXTURES: ReadonlyArray<FixtureRef> = ALL_FIXTURES.filter(
  (fx) => fx.file !== LANDING.file && fx.file !== ONBOARDING.file,
)

const INBOX_FIXTURES: ReadonlyArray<FixtureRef> = [
  { dir: 'w27', file: 'inbox-empty.html' },
  { dir: 'w27', file: 'inbox-message.html' },
]

const VIEWPORTS = [280, 320, 360, 375, 412] as const
type ViewportWidth = (typeof VIEWPORTS)[number]

const WIDE_VIEWPORTS = [375, 412] as const
const FIT_VIEWPORTS = [360, 375, 412] as const

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
// dropping rects narrower than 0.5px, shares one top within 3px.
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

// Collects every word under the page's nav items and the logout button,
// whichever of those exist in the current fixture, without asserting how
// many of them there are. Item 1 below is where cardinality is checked.
async function collectNavWords(page: Page): Promise<{ count: number; words: WordRectInfo[] }> {
  return page.evaluate(() => {
    const words: { word: string; tops: number[] }[] = []
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('header.site .nav__item, header.site .nav form button'),
    )
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
  })
}

interface PlainRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

interface HeaderLayout {
  header: PlainRect | null
  brand: PlainRect | null
  navItems: PlainRect[]
  logout: PlainRect | null
}

async function getHeaderLayout(page: Page): Promise<HeaderLayout> {
  // Note: no named helper function is declared inside this callback. The
  // tsx/esbuild transform wraps any named function (function declaration or
  // a const holding an arrow) with a __name() call to preserve its .name,
  // and that helper does not travel with the function when Playwright
  // serializes it into the page. Every rect is built inline instead.
  return page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('header.site')
    if (!header) {
      return { header: null, brand: null, navItems: [], logout: null }
    }
    const headerBox = header.getBoundingClientRect()
    const brandEl = header.querySelector<HTMLElement>('.brand')
    const navEls = Array.from(header.querySelectorAll<HTMLElement>('.nav__item'))
    const logoutEl = header.querySelector<HTMLElement>('.nav form button')
    return {
      header: {
        left: headerBox.left,
        top: headerBox.top,
        right: headerBox.right,
        bottom: headerBox.bottom,
        width: headerBox.width,
        height: headerBox.height,
      },
      brand: brandEl
        ? (() => {
            const b = brandEl.getBoundingClientRect()
            return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }
          })()
        : null,
      navItems: navEls.map((el) => {
        const r = el.getBoundingClientRect()
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
      }),
      logout: logoutEl
        ? (() => {
            const r = logoutEl.getBoundingClientRect()
            return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
          })()
        : null,
    }
  })
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

for (const fx of ALL_FIXTURES) {
  test(`item 1: ${label(fx)} exists and has no script tag`, () => {
    const p = fixturePath(fx)
    assert.ok(existsSync(p), `fixture ${label(fx)} must exist`)
    const html = readFileSync(p, 'utf8')
    assert.ok(!/<script/i.test(html), `fixture ${label(fx)} must not contain <script`)
  })
}

for (const fx of SIGNED_OUT_FIXTURES) {
  test(`item 1: ${label(fx)} header has exactly one nav item reading the login label and no logout button`, async () => {
    const page = await renderFixture(280, fx)
    const header = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('header.site .nav__item')).map((el) =>
        (el.textContent ?? '').trim(),
      )
      const logout = document.querySelector('header.site .nav form button')
      return { items, hasLogout: !!logout }
    })
    assert.equal(
      header.items.length,
      1,
      `${label(fx)}: expected exactly one .nav__item, found ${header.items.length} (${header.items.join(', ')})`,
    )
    assert.equal(header.items[0], 'تسجيل دخول', `${label(fx)}: expected nav item text "تسجيل دخول", got "${header.items[0]}"`)
    assert.ok(!header.hasLogout, `${label(fx)}: expected no logout button inside header.site`)
  })
}

for (const fx of TWO_ITEM_NAV_FIXTURES) {
  test(`item 1: ${label(fx)} header has two nav items and a logout button`, async () => {
    const page = await renderFixture(280, fx)
    const header = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('header.site .nav__item')).map((el) =>
        (el.textContent ?? '').trim(),
      )
      const logout = document.querySelector('header.site .nav form button')
      return { items, logoutText: logout ? (logout.textContent ?? '').trim() : null }
    })
    assert.equal(
      header.items.length,
      2,
      `${label(fx)}: expected exactly two .nav__item links, found ${header.items.length} (${header.items.join(', ')})`,
    )
    assert.equal(header.items[0], 'صندوقك', `${label(fx)}: first nav item expected "صندوقك", got "${header.items[0]}"`)
    assert.equal(
      header.items[1],
      'يلي بعتها',
      `${label(fx)}: second nav item expected "يلي بعتها", got "${header.items[1]}"`,
    )
    assert.ok(header.logoutText !== null, `${label(fx)}: expected a logout button inside header.site, found none`)
    assert.equal(
      header.logoutText,
      'تسجيل خروج',
      `${label(fx)}: logout button expected text "تسجيل خروج", got "${header.logoutText}"`,
    )
  })
}

for (const fx of INBOX_FIXTURES) {
  test(`item 1: ${label(fx)} has one link block button group with copy and story card buttons`, async () => {
    const page = await renderFixture(280, fx)
    const data = await page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll('.linkblock__buttons'))
      const group = groups[0]
      const buttons = group
        ? Array.from(group.querySelectorAll('button')).map((b) => (b.textContent ?? '').trim())
        : []
      return { groupCount: groups.length, buttons }
    })
    assert.equal(
      data.groupCount,
      1,
      `${label(fx)}: expected exactly one .linkblock__buttons, found ${data.groupCount}`,
    )
    assert.equal(
      data.buttons.length,
      2,
      `${label(fx)}: expected exactly two buttons in .linkblock__buttons, found ${data.buttons.length} (${data.buttons.join(', ')})`,
    )
    assert.ok(
      data.buttons.some((t) => t.includes('انسخ الرابط')),
      `${label(fx)}: expected a button containing "انسخ الرابط", got (${data.buttons.join(', ')})`,
    )
    assert.ok(
      data.buttons.some((t) => t.includes('بطاقة الستوري')),
      `${label(fx)}: expected a button containing "بطاقة الستوري", got (${data.buttons.join(', ')})`,
    )
  })
}

// ---------------------------------------------------------------------------
// Item 2: No page is wider than the screen
// ---------------------------------------------------------------------------

for (const fx of ALL_FIXTURES) {
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
// Item 3: No header word is split
// ---------------------------------------------------------------------------

for (const fx of ALL_FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 3: ${label(fx)} at ${width}px`, async () => {
      const page = await renderFixture(width, fx)
      const { count, words } = await collectNavWords(page)
      assert.ok(count > 0, `${label(fx)} at ${width}px: expected at least one nav item or logout button`)
      assertWordsWhole(words, `${label(fx)} at ${width}px`)
    })
  }
}

// ---------------------------------------------------------------------------
// Item 4: The header holds what is in it
// ---------------------------------------------------------------------------

for (const fx of ALL_FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 4: ${label(fx)} at ${width}px`, async () => {
      const page = await renderFixture(width, fx)
      const layout = await getHeaderLayout(page)
      assert.ok(layout.header, `${label(fx)} at ${width}px: header.site must exist`)
      assert.ok(layout.brand, `${label(fx)} at ${width}px: .brand must exist`)
      const header = layout.header as PlainRect
      const brand = layout.brand as PlainRect

      const within = (r: PlainRect, what: string) => {
        assert.ok(
          r.left >= header.left - 1,
          `${label(fx)} at ${width}px: ${what} left (${r.left}) < header left - 1 (${header.left - 1})`,
        )
        assert.ok(
          r.top >= header.top - 1,
          `${label(fx)} at ${width}px: ${what} top (${r.top}) < header top - 1 (${header.top - 1})`,
        )
        assert.ok(
          r.right <= header.right + 1,
          `${label(fx)} at ${width}px: ${what} right (${r.right}) > header right + 1 (${header.right + 1})`,
        )
        assert.ok(
          r.bottom <= header.bottom + 1,
          `${label(fx)} at ${width}px: ${what} bottom (${r.bottom}) > header bottom + 1 (${header.bottom + 1})`,
        )
      }

      within(brand, '.brand')
      layout.navItems.forEach((r, i) => within(r, `.nav__item[${i}]`))
      if (layout.logout) within(layout.logout, 'logout button')

      const boxes: Array<{ name: string; r: PlainRect }> = [
        ...layout.navItems.map((r, i) => ({ name: `.nav__item[${i}]`, r })),
        ...(layout.logout ? [{ name: 'logout button', r: layout.logout }] : []),
      ]
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].r
          const b = boxes[j].r
          const overlapW = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
          const overlapH = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
          const area = overlapW * overlapH
          assert.ok(
            area <= 1,
            `${label(fx)} at ${width}px: ${boxes[i].name} and ${boxes[j].name} overlap by ${area}px squared`,
          )
        }
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Item 5: Wide screens keep one row
// ---------------------------------------------------------------------------

for (const fx of TWO_ITEM_NAV_FIXTURES) {
  for (const width of WIDE_VIEWPORTS) {
    test(`item 5: ${label(fx)} at ${width}px`, async () => {
      const page = await renderFixture(width, fx)
      const data = await page.evaluate(() => {
        const navItems = Array.from(document.querySelectorAll<HTMLElement>('header.site .nav__item'))
        const logout = document.querySelector<HTMLElement>('header.site .nav form button')
        const navCenters = navItems.map((el) => {
          const r = el.getBoundingClientRect()
          return r.top + r.height / 2
        })
        const logoutCenter = logout
          ? (() => {
              const r = logout.getBoundingClientRect()
              return r.top + r.height / 2
            })()
          : null
        const oneLineCounts = navItems.map((el) => {
          const range = document.createRange()
          range.selectNodeContents(el)
          const rects = Array.from(range.getClientRects()).filter((r) => r.width >= 0.5)
          const tops = rects.map((r) => r.top)
          const lines: number[] = []
          for (const t of tops) {
            if (!lines.some((l) => Math.abs(l - t) <= 2)) lines.push(t)
          }
          return lines.length
        })
        return { navCount: navItems.length, hasLogout: !!logout, navCenters, logoutCenter, oneLineCounts }
      })
      assert.equal(
        data.navCount,
        2,
        `${label(fx)} at ${width}px: expected two .nav__item links, found ${data.navCount}`,
      )
      assert.ok(data.hasLogout, `${label(fx)} at ${width}px: expected a logout button`)
      const allCenters = [...data.navCenters, data.logoutCenter as number]
      const maxC = Math.max(...allCenters)
      const minC = Math.min(...allCenters)
      assert.ok(
        maxC - minC <= 2,
        `${label(fx)} at ${width}px: nav item and logout vertical centres spread ${maxC - minC}px (${allCenters.join(', ')}), expected <= 2`,
      )
      data.oneLineCounts.forEach((lineCount, i) => {
        assert.equal(
          lineCount,
          1,
          `${label(fx)} at ${width}px: .nav__item[${i}] expected to be on one line, got ${lineCount}`,
        )
      })
    })
  }
}

// ---------------------------------------------------------------------------
// Item 6: The link block's labels stay inside their buttons
// ---------------------------------------------------------------------------

for (const fx of INBOX_FIXTURES) {
  for (const width of VIEWPORTS) {
    test(`item 6: ${label(fx)} at ${width}px`, async () => {
      const page = await renderFixture(width, fx)
      const data = await page.evaluate(() => {
        const group = document.querySelector<HTMLElement>('.linkblock__buttons')
        if (!group) return null
        const buttons = Array.from(group.querySelectorAll<HTMLElement>('button'))
        return buttons.map((btn) => {
          const btnRect = btn.getBoundingClientRect()
          const range = document.createRange()
          range.selectNodeContents(btn)
          const rangeRect = range.getBoundingClientRect()
          const words: { word: string; tops: number[] }[] = []
          const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT)
          let node = walker.nextNode()
          while (node) {
            const text = node.nodeValue ?? ''
            const re = /\S+/g
            let m = re.exec(text)
            while (m) {
              const r = document.createRange()
              r.setStart(node, m.index)
              r.setEnd(node, m.index + m[0].length)
              const rects = Array.from(r.getClientRects()).filter((rc) => rc.width >= 0.5)
              words.push({ word: m[0], tops: rects.map((rc) => rc.top) })
              m = re.exec(text)
            }
            node = walker.nextNode()
          }
          return {
            label: (btn.textContent ?? '').trim(),
            btnLeft: btnRect.left,
            btnTop: btnRect.top,
            btnRight: btnRect.right,
            btnBottom: btnRect.bottom,
            height: btnRect.height,
            rangeLeft: rangeRect.left,
            rangeTop: rangeRect.top,
            rangeRight: rangeRect.right,
            rangeBottom: rangeRect.bottom,
            scrollWidth: btn.scrollWidth,
            clientWidth: btn.clientWidth,
            words,
          }
        })
      })
      assert.ok(data, `${label(fx)} at ${width}px: .linkblock__buttons must exist`)
      const buttons = data as NonNullable<typeof data>
      assert.equal(
        buttons.length,
        2,
        `${label(fx)} at ${width}px: expected two buttons in .linkblock__buttons, found ${buttons.length}`,
      )
      for (const b of buttons) {
        assert.ok(
          b.rangeLeft >= b.btnLeft - 1,
          `${label(fx)} at ${width}px: button "${b.label}" range left (${b.rangeLeft}) < button left - 1 (${b.btnLeft - 1})`,
        )
        assert.ok(
          b.rangeTop >= b.btnTop - 1,
          `${label(fx)} at ${width}px: button "${b.label}" range top (${b.rangeTop}) < button top - 1 (${b.btnTop - 1})`,
        )
        assert.ok(
          b.rangeRight <= b.btnRight + 1,
          `${label(fx)} at ${width}px: button "${b.label}" range right (${b.rangeRight}) > button right + 1 (${b.btnRight + 1})`,
        )
        assert.ok(
          b.rangeBottom <= b.btnBottom + 1,
          `${label(fx)} at ${width}px: button "${b.label}" range bottom (${b.rangeBottom}) > button bottom + 1 (${b.btnBottom + 1})`,
        )
        assert.ok(
          b.scrollWidth <= b.clientWidth + 1,
          `${label(fx)} at ${width}px: button "${b.label}" scrollWidth (${b.scrollWidth}) > clientWidth + 1 (${b.clientWidth + 1})`,
        )
        assertWordsWhole(b.words, `${label(fx)} at ${width}px: button "${b.label}"`)
      }
      assert.ok(
        Math.abs(buttons[0].height - buttons[1].height) <= 0.5,
        `${label(fx)} at ${width}px: buttons differ in height by ${Math.abs(buttons[0].height - buttons[1].height)}, expected <= 0.5`,
      )
    })
  }
}

// ---------------------------------------------------------------------------
// Item 7: Where they fit, they do not move
// ---------------------------------------------------------------------------

for (const fx of INBOX_FIXTURES) {
  for (const width of FIT_VIEWPORTS) {
    test(`item 7: ${label(fx)} at ${width}px`, async () => {
      const page = await renderFixture(width, fx)
      const data = await page.evaluate(() => {
        const group = document.querySelector<HTMLElement>('.linkblock__buttons')
        if (!group) return null
        const buttons = Array.from(group.querySelectorAll<HTMLElement>('button'))
        return buttons.map((btn) => {
          const btnRect = btn.getBoundingClientRect()
          const range = document.createRange()
          range.selectNodeContents(btn)
          const rects = Array.from(range.getClientRects()).filter((r) => r.width >= 0.5)
          const tops = rects.map((r) => r.top)
          const lines: number[] = []
          for (const t of tops) {
            if (!lines.some((l) => Math.abs(l - t) <= 2)) lines.push(t)
          }
          return {
            label: (btn.textContent ?? '').trim(),
            height: btnRect.height,
            lineCount: lines.length,
            tops,
          }
        })
      })
      assert.ok(data, `${label(fx)} at ${width}px: .linkblock__buttons must exist`)
      const buttons = data as NonNullable<typeof data>
      assert.equal(buttons.length, 2, `${label(fx)} at ${width}px: expected two buttons`)
      for (const b of buttons) {
        assert.ok(
          Math.abs(b.height - 40) <= 0.5,
          `${label(fx)} at ${width}px: button "${b.label}" height was ${b.height}, expected 40 (+/-0.5)`,
        )
        assert.equal(
          b.lineCount,
          1,
          `${label(fx)} at ${width}px: button "${b.label}" expected one line, got ${b.lineCount} (tops: ${b.tops.join(', ')})`,
        )
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Item 8: Other inline buttons are untouched
// ---------------------------------------------------------------------------

test('item 8: inbox-message.html at 360px logout button keeps white-space nowrap', async () => {
  const page = await renderFixture(360, { dir: 'w27', file: 'inbox-message.html' })
  const whiteSpace = await page.evaluate(() => {
    const btn = document.querySelector<HTMLElement>('header.site .nav form button')
    return btn ? window.getComputedStyle(btn).whiteSpace : null
  })
  assert.equal(
    whiteSpace,
    'nowrap',
    `inbox-message.html at 360px: logout button computed white-space was "${whiteSpace}", expected "nowrap"`,
  )
})

// ---------------------------------------------------------------------------
// Item 9: The browser is real
// ---------------------------------------------------------------------------

test('item 9: the browser is real and launches', () => {
  assert.ok(browser, 'Chromium browser must be running')
  assert.ok(browser.isConnected(), 'Chromium must be connected')
  for (const width of VIEWPORTS) {
    assert.ok(contexts.get(width), `browser context for ${width}px must exist`)
    assert.ok(pages.get(width), `page for ${width}px must exist`)
  }
})
