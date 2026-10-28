// test/81-admin-surface.test.ts
//
// Written from docs/SPEC-week31-admin-surface.md section 4, items 1 to 9,
// and section 6, which amends item 9 and names the four w31 fixtures.
// Section 0 is the measurement those items answer. Section 1 names the
// two .stats-day spans that item 7 counts.
//
// "Visible" is section 4: a non-zero box and computed visibility not
// hidden. An element under display:none has a zero box, so it is not
// visible. A word drawn on two lines, and "on one line", follow
// test/78-heading-rows.test.ts and test/80-link-label.test.ts (the
// week 28 definition): a word is a maximal run of non-whitespace in one
// text node. It is whole when every client rect of a Range over that
// word, after dropping rects narrower than 0.5px, shares one top within
// 3px. "On one line" is that test over the element's whole text.
//
// Expected strings and counts come from the spec. The only stylesheet
// read is app/globals.css, injected before </head>.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GLOBALS_CSS_PATH = path.join(REPO_ROOT, 'app', 'globals.css')

// Section 4. Widths are fixed. Item 5 is only the three widths where the
// chosen table is supposed to fit. Height 780, isMobile, hasTouch.
const VIEWPORTS = [280, 320, 360, 390, 412] as const
type ViewportWidth = (typeof VIEWPORTS)[number]

const TABLE_FIT_VIEWPORTS = [360, 390, 412] as const

const VIEWPORT_HEIGHT = 780

// Section 4 gives 0.5px for a cell lying inside .stats-table. The 0.5px
// sliver filter and the 3px line band belong to the week 28 word definition.
const BOX_TOLERANCE = 0.5
const SLIVER_PX = 0.5
const LINE_TOP_PX = 3

const SIGN_IN_LABEL = 'تسجيل دخول'

// Section 4 item 3.
const ADMIN_LINKS = [
  { text: 'لوحة الإدارة', href: '/admin' },
  { text: 'الأرقام', href: '/admin/stats' },
  { text: 'البلاغات', href: '/admin/reports' },
] as const

const LOGOUT_ACTION = '/admin/logout'

// Section 6. The header row, then 14 body rows of 4 cells.
const STATS_HEADERS = ['اليوم', 'حسابات جديدة', 'رسايل', 'عروض'] as const
const STATS_BODY_ROWS = 14
const STATS_COLUMNS = 4
const DAY_MS = 24 * 60 * 60 * 1000

const SIGNED_OUT = 'admin-login.html'
const SIGNED_IN = ['admin.html', 'admin-stats.html', 'admin-reports.html'] as const
const ADMIN_FILES = [SIGNED_OUT, ...SIGNED_IN] as const
const STATS_FILE = 'admin-stats.html'

// Item 4. test/77-nav-words.test.ts lists the first nine. The two remaining
// w26 html files are participant pages as well, so they are included.
interface ParticipantRef {
  dir: 'w26' | 'w27'
  file: string
}

const PARTICIPANTS: ReadonlyArray<ParticipantRef> = [
  { dir: 'w27', file: 'inbox-empty.html' },
  { dir: 'w27', file: 'inbox-message.html' },
  { dir: 'w27', file: 'sent.html' },
  { dir: 'w26', file: 'landing.html' },
  { dir: 'w26', file: 'onboarding.html' },
  { dir: 'w26', file: 'compose.html' },
  { dir: 'w26', file: 'post-send-arabic-name.html' },
  { dir: 'w26', file: 'offer.html' },
  { dir: 'w26', file: 'account-delete.html' },
  { dir: 'w26', file: 'post-send-short-name.html' },
  { dir: 'w26', file: 'post-send-unbroken-name.html' },
]

// Items 2, 3 and 9 are not width loops. 390 is one of the section 4 widths,
// with the same height, isMobile and hasTouch as the loops.
const MARKUP_WIDTH: ViewportWidth = 390

interface PlainRect {
  left: number
  top: number
  right: number
  bottom: number
}

interface WordRectInfo {
  word: string
  tops: number[]
}

function adminPath(file: string): string {
  return path.join(REPO_ROOT, 'test', 'fixtures', 'w31', file)
}

function participantPath(fx: ParticipantRef): string {
  return path.join(REPO_ROOT, 'test', 'fixtures', fx.dir, fx.file)
}

function loadHtml(absPath: string, label: string): string {
  const html = readFileSync(absPath, 'utf8')
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8')
  const headClose = '</head>'
  const headIdx = html.indexOf(headClose)
  assert.ok(headIdx !== -1, `${label} must contain </head>`)
  return html.slice(0, headIdx) + '<style>' + css + '</style>' + html.slice(headIdx)
}

let browser: Browser | undefined
const contexts = new Map<ViewportWidth, BrowserContext>()
const pages = new Map<ViewportWidth, Page>()

async function render(width: ViewportWidth, absPath: string, label: string): Promise<Page> {
  const page = pages.get(width)
  assert.ok(page, `page for viewport ${width} must be initialized`)
  await page.setContent(loadHtml(absPath, label))
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

function isWhole(tops: number[]): boolean {
  if (tops.length === 0) return true
  return Math.max(...tops) - Math.min(...tops) <= LINE_TOP_PX
}

function assertWordsWhole(words: WordRectInfo[], context: string): void {
  for (const w of words) {
    assert.ok(isWhole(w.tops), `${context}: word "${w.word}" is split across tops ${w.tops.join(', ')}`)
  }
}

async function collectWords(page: Page, selector: string): Promise<{ count: number; words: WordRectInfo[] }> {
  return page.evaluate(
    (arg) => {
      const words: { word: string; tops: number[] }[] = []
      const elements = Array.from(document.querySelectorAll<HTMLElement>(arg.selector))
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
            const rects = Array.from(range.getClientRects()).filter((r) => r.width >= arg.sliver)
            words.push({ word: m[0], tops: rects.map((r) => r.top) })
            m = re.exec(text)
          }
          node = walker.nextNode()
        }
      }
      return { count: elements.length, words }
    },
    { selector, sliver: SLIVER_PX },
  )
}

// A YYYY-MM-DD that is a real calendar day, as UTC midnight. Section 6.
function utcDay(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const utc = Date.UTC(year, month - 1, day)
  const back = new Date(utc)
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) return null
  return utc
}

function sticksOut(cell: PlainRect, box: PlainRect): number {
  return Math.max(0, box.left - cell.left, cell.right - box.right, box.top - cell.top, cell.bottom - box.bottom)
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
  if (browser) await browser.close()
})

interface VisibleHeader {
  className: string
  plain: boolean
}

// ---------------------------------------------------------------------------
// Item 1: one visible header, and it is .site--plain. No visible sign-in link.
// ---------------------------------------------------------------------------

for (const file of ADMIN_FILES) {
  for (const width of VIEWPORTS) {
    test(`item 1 at ${width}: ${file} exactly one visible header`, async () => {
      const page = await render(width, adminPath(file), file)
      // Visibility is inlined. A named function inside page.evaluate is rewritten
      // by tsx to a __name helper that does not exist in the page.
      const data = await page.evaluate((signIn) => {
        const headers: { className: string; plain: boolean }[] = []
        for (const el of Array.from(document.querySelectorAll('header'))) {
          const box = el.getBoundingClientRect()
          if (box.width <= 0 || box.height <= 0) continue
          if (getComputedStyle(el).visibility === 'hidden') continue
          headers.push({ className: el.className, plain: el.classList.contains('site--plain') })
        }
        let signInLinks = 0
        for (const el of Array.from(document.querySelectorAll('a'))) {
          if ((el.textContent ?? '').trim() !== signIn) continue
          const box = el.getBoundingClientRect()
          if (box.width <= 0 || box.height <= 0) continue
          if (getComputedStyle(el).visibility === 'hidden') continue
          signInLinks += 1
        }
        return { headers, signInLinks }
      }, SIGN_IN_LABEL)

      const problems: string[] = []
      const described = data.headers.map((h: VisibleHeader) => h.className || '(no class)').join(' | ')
      if (data.headers.length !== 1) {
        problems.push(`visible headers ${data.headers.length} [${described}], expected 1`)
      } else if (!data.headers[0].plain) {
        problems.push(`the visible header is "${described}", expected .site--plain`)
      }
      if (data.signInLinks !== 0) {
        problems.push(`visible links reading "${SIGN_IN_LABEL}": ${data.signInLinks}`)
      }
      assert.equal(problems.length, 0, `${file} at ${width}: ${problems.join('; ')}`)
    })
  }
}

// ---------------------------------------------------------------------------
// Item 2: signed out, the admin header is the brand alone.
// Item 1 is what requires that header to be the only visible one. This item
// checks the header the change renders (.admin-shell > header), which is
// markup: no nav, no link but the brand, no form.
// ---------------------------------------------------------------------------

test('item 2: admin-login.html the visible header is the brand only', async () => {
  const page = await render(MARKUP_WIDTH, adminPath(SIGNED_OUT), SIGNED_OUT)
  const data = await page.evaluate(() => {
    const header = document.querySelector('.admin-shell > header')
    if (!header) return { found: false, visible: false, plain: false, navCount: 0, formCount: 0, brandLinks: 0, otherLinks: 0 }
    const box = header.getBoundingClientRect()
    const visible = box.width > 0 && box.height > 0 && getComputedStyle(header).visibility !== 'hidden'
    let brandLinks = 0
    let otherLinks = 0
    for (const el of Array.from(header.querySelectorAll('a'))) {
      if (el.classList.contains('brand')) brandLinks += 1
      else otherLinks += 1
    }
    return {
      found: true,
      visible,
      plain: header.classList.contains('site--plain'),
      navCount: header.querySelectorAll('nav').length,
      formCount: header.querySelectorAll('form').length,
      brandLinks,
      otherLinks,
    }
  })
  assert.ok(data.found, 'admin-login: .admin-shell > header must exist')
  assert.ok(data.visible, 'admin-login: the admin header must be visible')
  assert.ok(data.plain, 'admin-login: the admin header must be .site--plain')
  assert.equal(data.navCount, 0, `admin-login: admin header nav count ${data.navCount}`)
  assert.equal(data.formCount, 0, `admin-login: admin header form count ${data.formCount}`)
  assert.equal(data.brandLinks, 1, `admin-login: expected the brand link only, found ${data.brandLinks} brand links`)
  assert.equal(data.otherLinks, 0, `admin-login: admin header has ${data.otherLinks} links that are not the brand`)
})

// ---------------------------------------------------------------------------
// Item 3: signed in, the admin header has the three links and a logout form.
// ---------------------------------------------------------------------------

for (const file of SIGNED_IN) {
  test(`item 3: ${file} the header has the three links and a logout form`, async () => {
    const page = await render(MARKUP_WIDTH, adminPath(file), file)
    const data = await page.evaluate(() => {
      const header = document.querySelector('.admin-shell > header')
      if (!header) return { found: false, plain: false, links: [] as { text: string; href: string | null }[], forms: [] as { action: string | null; method: string }[] }
      const links = Array.from(header.querySelectorAll('a')).map((el) => ({
        text: (el.textContent ?? '').trim(),
        href: el.getAttribute('href'),
      }))
      const forms = Array.from(header.querySelectorAll('form')).map((el) => ({
        action: el.getAttribute('action'),
        method: (el.getAttribute('method') ?? '').toLowerCase(),
      }))
      return { found: true, plain: header.classList.contains('site--plain'), links, forms }
    })
    assert.ok(data.found, `${file}: .admin-shell > header must exist`)
    assert.ok(data.plain, `${file}: the admin header must be .site--plain`)
    for (const expected of ADMIN_LINKS) {
      const matches = data.links.filter((link) => link.text === expected.text && link.href === expected.href)
      assert.equal(
        matches.length,
        1,
        `${file}: expected one link "${expected.text}" -> ${expected.href}, found ${matches.length}`,
      )
    }
    const logout = data.forms.filter((form) => form.action === LOGOUT_ACTION && form.method === 'post')
    assert.equal(logout.length, 1, `${file}: expected one form posting to ${LOGOUT_ACTION}, found ${logout.length}`)
  })
}

// ---------------------------------------------------------------------------
// Item 4: participant pages still show header.site, not .site--plain.
// ---------------------------------------------------------------------------

for (const fx of PARTICIPANTS) {
  for (const width of VIEWPORTS) {
    test(`item 4 at ${width}: ${fx.file} shows header.site`, async () => {
      const page = await render(width, participantPath(fx), fx.file)
      const data = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('header.site')).map((el) => {
          const box = el.getBoundingClientRect()
          const visible = box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden'
          return {
            className: el.className,
            plain: el.classList.contains('site--plain'),
            visible,
          }
        })
      })
      assert.equal(data.length, 1, `${fx.file} at ${width}: expected one header.site, found ${data.length}`)
      assert.equal(data[0].plain, false, `${fx.file} at ${width}: header.site must not be .site--plain (${data[0].className})`)
      assert.equal(data[0].visible, true, `${fx.file} at ${width}: header.site must be visible`)
    })
  }
}

interface TableFit {
  scrollWidth: number
  clientWidth: number
  box: PlainRect
  cells: PlainRect[]
  thCount: number
  tdCount: number
}

// ---------------------------------------------------------------------------
// Item 5: from 360 up, the stats table fits its box.
// ---------------------------------------------------------------------------

for (const width of TABLE_FIT_VIEWPORTS) {
  test(`item 5 at ${width}: the stats table fits its box`, async () => {
    const page = await render(width, adminPath(STATS_FILE), STATS_FILE)
    const data = await page.evaluate((): TableFit | null => {
      const wrap = document.querySelector<HTMLElement>('.stats-table')
      if (!wrap) return null
      const box = wrap.getBoundingClientRect()
      const cells = Array.from(wrap.querySelectorAll<HTMLElement>('th, td')).map((el) => {
        const r = el.getBoundingClientRect()
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      })
      return {
        scrollWidth: wrap.scrollWidth,
        clientWidth: wrap.clientWidth,
        box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
        cells,
        thCount: wrap.querySelectorAll('th').length,
        tdCount: wrap.querySelectorAll('td').length,
      }
    })
    assert.ok(data, `${STATS_FILE} at ${width}: .stats-table must exist`)
    const fit = data as TableFit
    assert.ok(fit.thCount > 0 && fit.tdCount > 0, `${STATS_FILE} at ${width}: the table must have th and td cells`)
    const problems: string[] = []
    if (fit.scrollWidth > fit.clientWidth) {
      problems.push(`scrollWidth ${fit.scrollWidth} > clientWidth ${fit.clientWidth}`)
    }
    let outside = 0
    let worst = 0
    for (const cell of fit.cells) {
      const over = sticksOut(cell, fit.box)
      if (over > BOX_TOLERANCE) {
        outside += 1
        if (over > worst) worst = over
      }
    }
    if (outside > 0) {
      problems.push(`${outside} of ${fit.cells.length} cells stick out of .stats-table, worst by ${worst}px`)
    }
    assert.equal(problems.length, 0, `${STATS_FILE} at ${width}: ${problems.join('; ')}`)
  })
}

// ---------------------------------------------------------------------------
// Item 6: no word of a th is drawn on two lines.
// ---------------------------------------------------------------------------

for (const width of VIEWPORTS) {
  test(`item 6 at ${width}: no word of a th is drawn on two lines`, async () => {
    const page = await render(width, adminPath(STATS_FILE), STATS_FILE)
    const { count, words } = await collectWords(page, '.stats-table th')
    assert.equal(count, STATS_HEADERS.length, `${STATS_FILE} at ${width}: expected ${STATS_HEADERS.length} th, found ${count}`)
    assert.ok(words.length > 0, `${STATS_FILE} at ${width}: th elements must contain words`)
    assertWordsWhole(words, `${STATS_FILE} at ${width}`)
  })
}

interface DayLines {
  text: string
  tops: number[]
}

// ---------------------------------------------------------------------------
// Item 7: each .stats-day is drawn on one line.
// ---------------------------------------------------------------------------

for (const width of VIEWPORTS) {
  test(`item 7 at ${width}: each stats-day is drawn on one line`, async () => {
    const page = await render(width, adminPath(STATS_FILE), STATS_FILE)
    const days = await page.evaluate((sliver): DayLines[] => {
      return Array.from(document.querySelectorAll<HTMLElement>('.stats-day')).map((el) => {
        const range = document.createRange()
        range.selectNodeContents(el)
        const rects = Array.from(range.getClientRects()).filter((r) => r.width >= sliver)
        return { text: (el.textContent ?? '').trim(), tops: rects.map((r) => r.top) }
      })
    }, SLIVER_PX)
    // Section 1: the two date spans.
    assert.equal(days.length, 2, `${STATS_FILE} at ${width}: expected 2 .stats-day, found ${days.length}`)
    for (const day of days) {
      assert.ok(day.tops.length > 0, `${STATS_FILE} at ${width}: .stats-day "${day.text}" is not drawn`)
      assert.ok(
        isWhole(day.tops),
        `${STATS_FILE} at ${width}: .stats-day "${day.text}" is drawn on more than one line (tops ${day.tops.join(', ')})`,
      )
    }
  })
}

// ---------------------------------------------------------------------------
// Item 8: the page scrollWidth equals the viewport width.
// ---------------------------------------------------------------------------

for (const file of ADMIN_FILES) {
  for (const width of VIEWPORTS) {
    test(`item 8 at ${width}: ${file} scrollWidth equals the viewport`, async () => {
      const page = await render(width, adminPath(file), file)
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      assert.equal(scrollWidth, width, `${file} at ${width}: scrollWidth was ${scrollWidth}, expected ${width}`)
    })
  }
}

interface StatsTableText {
  headers: string[]
  rows: string[][]
}

// ---------------------------------------------------------------------------
// Item 9, as amended in section 6: the table's content, not its layout.
// ---------------------------------------------------------------------------

test('item 9: the stats table is fourteen rows of dates and counts', async () => {
  const page = await render(MARKUP_WIDTH, adminPath(STATS_FILE), STATS_FILE)
  const data = await page.evaluate((): StatsTableText | null => {
    const table = document.querySelector('.stats-table table')
    if (!table) return null
    const headRow = table.querySelector('thead tr')
    const headers = headRow
      ? Array.from(headRow.children)
          .filter((el) => el.tagName === 'TH' || el.tagName === 'TD')
          .map((el) => (el.textContent ?? '').trim())
      : []
    const rows = Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
      Array.from(tr.children)
        .filter((el) => el.tagName === 'TH' || el.tagName === 'TD')
        .map((el) => (el.textContent ?? '').trim()),
    )
    return { headers, rows }
  })
  assert.ok(data, `${STATS_FILE}: .stats-table table must exist`)
  const table = data as StatsTableText
  assert.deepEqual(table.headers, [...STATS_HEADERS], `${STATS_FILE}: header row mismatch`)
  assert.equal(table.rows.length, STATS_BODY_ROWS, `${STATS_FILE}: expected ${STATS_BODY_ROWS} body rows, found ${table.rows.length}`)
  const days: number[] = []
  for (let i = 0; i < table.rows.length; i += 1) {
    const row = table.rows[i]
    assert.equal(row.length, STATS_COLUMNS, `${STATS_FILE}: row ${i} has ${row.length} cells, expected ${STATS_COLUMNS}`)
    const day = utcDay(row[0])
    assert.ok(day !== null, `${STATS_FILE}: row ${i} first cell "${row[0]}" is not a YYYY-MM-DD date`)
    days.push(day as number)
    for (let c = 1; c < STATS_COLUMNS; c += 1) {
      assert.match(row[c], /^\d+$/, `${STATS_FILE}: row ${i} cell ${c} "${row[c]}" is not a whole number`)
    }
  }
  for (let i = 1; i < days.length; i += 1) {
    const gap = days[i - 1] - days[i]
    assert.equal(gap, DAY_MS, `${STATS_FILE}: row ${i} is not the day before row ${i - 1}`)
  }
})
