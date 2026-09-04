// test/22-hourstamp.test.ts
//
// Written from docs/SPEC-week11-design-system.md section 6, items 11
// through 16, and section 4.2's module contract, alone. src/hourstamp.ts
// does not exist yet in this worktree, so every test below is expected to
// error at import time, and that failure is the correct signal that the pure
// module section 4.2 describes has not been built here, not a fault in this
// file. The static import below follows this project's own convention
// (test/12-robots.test.ts imports '../src/robots.js' the same way) rather
// than a defensive dynamic import, because the module genuinely is supposed
// to exist by the time this file is meant to pass.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { toArabicDigits, formatHourStamp } from '../src/hourstamp.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOURSTAMP_SRC_PATH = path.join(REPO_ROOT, 'src', 'hourstamp.ts')

// ---------------------------------------------------------------------------
// Shared helpers: a small, self-contained Asia/Damascus clock, built with
// Intl only, so this test file never needs to guess or hardcode the
// Damascus UTC offset (spec section 4.2 requires the module itself to
// resolve it from the platform's tz database, and the test constructs its
// fixtures the same principled way rather than assuming +03:00).
// ---------------------------------------------------------------------------

const DAMASCUS_TZ = 'Asia/Damascus'

function damascusOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: DAMASCUS_TZ, timeZoneName: 'shortOffset' }).formatToParts(
    instant,
  )
  const tzPart = parts.find((p) => p.type === 'timeZoneName')!.value
  const m = /GMT([+-])(\d+)(?::(\d+))?/.exec(tzPart)
  assert.ok(m, `could not parse Damascus UTC offset from "${tzPart}"`)
  const sign = m![1] === '-' ? -1 : 1
  const hours = parseInt(m![2], 10)
  const minutes = m![3] ? parseInt(m![3], 10) : 0
  return sign * (hours * 60 + minutes)
}

// The UTC instant corresponding to a given wall-clock date and time in
// Asia/Damascus. One correction pass is enough for every fixture used below
// because Damascus's offset is a whole number of hours and none of these
// fixtures sit within a DST transition window.
function damascusInstant(year: number, month: number, day: number, hour: number, minute = 0): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute))
  const offset = damascusOffsetMinutes(guess)
  return new Date(guess.getTime() - offset * 60_000)
}

type DamascusDateParts = { year: number; month: number; day: number }

function damascusDateParts(instant: Date): DamascusDateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DAMASCUS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

function daysBetween(earlier: DamascusDateParts, later: DamascusDateParts): number {
  const a = Date.UTC(earlier.year, earlier.month - 1, earlier.day)
  const b = Date.UTC(later.year, later.month - 1, later.day)
  return Math.round((b - a) / 86_400_000)
}

// The exact table from spec section 4.2.
const LEVANTINE_MONTHS = [
  'كانون الثاني',
  'شباط',
  'آذار',
  'نيسان',
  'أيار',
  'حزيران',
  'تموز',
  'آب',
  'أيلول',
  'تشرين الأول',
  'تشرين الثاني',
  'كانون الأول',
]

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

// ---------------------------------------------------------------------------
// Item 11
// ---------------------------------------------------------------------------

test('item 11: toArabicDigits maps every Latin digit to its Arabic-Indic form and leaves everything else alone (spec section 6 item 11)', () => {
  for (let d = 0; d <= 9; d++) {
    assert.equal(toArabicDigits(String(d)), ARABIC_INDIC_DIGITS[d], `digit ${d} as a string`)
    assert.equal(toArabicDigits(d), ARABIC_INDIC_DIGITS[d], `digit ${d} as a number`)
  }

  const mixed = 'Room 42B - page 7! ص م، 2026 نسخة'
  let expected = ''
  for (const ch of mixed) {
    const code = ch.charCodeAt(0)
    expected += code >= 48 && code <= 57 ? ARABIC_INDIC_DIGITS[code - 48] : ch
  }
  assert.equal(toArabicDigits(mixed), expected, 'digits inside a mixed string must map, everything else must be untouched')

  const noDigits = 'اليوم أمس أيلول ص م, no digits in this one at all!'
  assert.equal(toArabicDigits(noDigits), noDigits, 'a string with no Latin digits must round-trip unchanged')

  assert.equal(toArabicDigits(1234567890), '١٢٣٤٥٦٧٨٩٠', 'a full multi-digit number must map digit by digit')
})

// ---------------------------------------------------------------------------
// Item 12
// ---------------------------------------------------------------------------

// Spec section 6 item 12, read at its strictest: the literal regex it gives
// catches a colon, the Arabic decimal separator, or a Latin HH:MM pair.
// Since the module's own digit rule (section 4.2, item 11) means every digit
// in real output is Arabic-Indic, not Latin, that literal regex alone would
// never fire against correct output, so it is kept here as a direct
// implementation of the item's own wording, and backed up with the
// "concrete" sweep the item asks for: a run of three or more consecutive
// Arabic-Indic digits is never valid in any branch (the day-of-month tops
// out at two digits, the hour tops out at two digits, and section 4.2 says a
// minute never appears, and a minute is exactly what would produce a longer
// run), and the output must always end in ص or م.
const LITERAL_ITEM_12_PATTERN = /[:٫]|\d\d[:٫]\d\d/
const ARABIC_INDIC_DIGIT_RUN = /[٠-٩]{3,}/

test('item 12: formatHourStamp never renders a minute, swept across one full year at one-hour steps (spec section 6 item 12)', () => {
  const now = new Date('2026-06-15T09:00:00.000Z')
  const hourMs = 3_600_000
  const totalHours = 366 * 24
  const startAt = new Date(now.getTime() - 200 * 24 * hourMs)

  for (let i = 0; i < totalHours; i++) {
    const at = new Date(startAt.getTime() + i * hourMs)
    const result = formatHourStamp(at, now)

    assert.doesNotMatch(
      result,
      LITERAL_ITEM_12_PATTERN,
      `formatHourStamp(${at.toISOString()}, ${now.toISOString()}) matched the forbidden minute pattern: "${result}"`,
    )
    assert.doesNotMatch(
      result,
      ARABIC_INDIC_DIGIT_RUN,
      `formatHourStamp(${at.toISOString()}, ${now.toISOString()}) contained a run of 3+ consecutive digits, which no valid hour-only stamp produces: "${result}"`,
    )
    assert.match(
      result,
      /[صم]$/,
      `formatHourStamp(${at.toISOString()}, ${now.toISOString()}) must end in ص or م, got: "${result}"`,
    )
  }
})

// ---------------------------------------------------------------------------
// Item 13
// ---------------------------------------------------------------------------

test('item 13: same calendar day renders اليوم, the previous day renders أمس, two days back renders a Levantine month name (spec section 6 item 13)', () => {
  const now = new Date('2026-09-04T09:00:00.000Z')
  const sameDayAt = new Date(now.getTime() - 3 * 3_600_000)
  const prevDayAt = new Date(now.getTime() - 24 * 3_600_000)
  const twoDaysAt = new Date(now.getTime() - 48 * 3_600_000)

  const nowParts = damascusDateParts(now)
  const sameParts = damascusDateParts(sameDayAt)
  const prevParts = damascusDateParts(prevDayAt)
  const twoParts = damascusDateParts(twoDaysAt)

  assert.deepEqual(sameParts, nowParts, 'test fixture: sameDayAt must land on the same Damascus calendar day as now')
  assert.equal(daysBetween(prevParts, nowParts), 1, 'test fixture: prevDayAt must land exactly one Damascus day before now')
  assert.equal(daysBetween(twoParts, nowParts), 2, 'test fixture: twoDaysAt must land exactly two Damascus days before now')

  const sameResult = formatHourStamp(sameDayAt, now)
  assert.ok(sameResult.includes('اليوم'), `same-day stamp must contain اليوم, got: "${sameResult}"`)

  const prevResult = formatHourStamp(prevDayAt, now)
  assert.ok(prevResult.includes('أمس'), `previous-day stamp must contain أمس, got: "${prevResult}"`)
  assert.ok(!prevResult.includes('اليوم'), `previous-day stamp must not also say اليوم, got: "${prevResult}"`)

  const expectedMonth = LEVANTINE_MONTHS[twoParts.month - 1]
  const twoResult = formatHourStamp(twoDaysAt, now)
  assert.ok(
    twoResult.includes(expectedMonth),
    `two-days-back stamp must contain the Levantine month name ${expectedMonth}, got: "${twoResult}"`,
  )
  assert.ok(!twoResult.includes('اليوم') && !twoResult.includes('أمس'), `two-days-back stamp must not say اليوم or أمس, got: "${twoResult}"`)
})

// ---------------------------------------------------------------------------
// Item 14
// ---------------------------------------------------------------------------

test('item 14: midnight renders ١٢ص, noon renders ١٢م, 13:00 renders ١م (spec section 6 item 14)', () => {
  const now = damascusInstant(2026, 9, 4, 18, 0)
  const midnight = damascusInstant(2026, 9, 4, 0, 0)
  const noon = damascusInstant(2026, 9, 4, 12, 0)
  const thirteenHundred = damascusInstant(2026, 9, 4, 13, 0)

  const midnightResult = formatHourStamp(midnight, now)
  assert.ok(midnightResult.includes('١٢ص'), `midnight must render ١٢ص, got: "${midnightResult}"`)

  const noonResult = formatHourStamp(noon, now)
  assert.ok(noonResult.includes('١٢م'), `noon must render ١٢م, got: "${noonResult}"`)

  const thirteenResult = formatHourStamp(thirteenHundred, now)
  assert.ok(thirteenResult.includes('١م'), `13:00 must render ١م, got: "${thirteenResult}"`)
})

// ---------------------------------------------------------------------------
// Item 15
// ---------------------------------------------------------------------------

test('item 15: formatHourStamp is pure, same arguments produce the same string twice, and it never calls Date.now() (spec section 6 item 15)', () => {
  const originalNow = Date.now
  Date.now = () => {
    throw new Error('formatHourStamp must not call Date.now(); now must come from its argument only')
  }
  try {
    const at = new Date('2026-09-04T10:00:00.000Z')
    const now = new Date('2026-09-04T12:00:00.000Z')
    const first = formatHourStamp(at, now)
    const second = formatHourStamp(at, now)
    assert.equal(first, second, 'calling formatHourStamp twice with identical arguments must return an identical string')
  } finally {
    Date.now = originalNow
  }
})

// ---------------------------------------------------------------------------
// Item 16
// ---------------------------------------------------------------------------

test('item 16: src/hourstamp.ts imports nothing from next, from the database, or from process (spec section 6 item 16)', () => {
  assert.ok(existsSync(HOURSTAMP_SRC_PATH), `src/hourstamp.ts must exist; looked at ${HOURSTAMP_SRC_PATH}`)
  const src = readFileSync(HOURSTAMP_SRC_PATH, 'utf8')

  const importLines = src.split('\n').filter((line) => /^\s*import\b/.test(line))
  const forbiddenModulePattern = /from\s+['"](next(\/[^'"]*)?|node:process|process|[^'"]*\b(db|pool|schema|pg|drizzle|pglite)(\.js)?)['"]/i

  const offenders = importLines.filter((line) => forbiddenModulePattern.test(line))
  assert.deepEqual(
    offenders,
    [],
    `src/hourstamp.ts must not import from next, the database layer, or process: ${JSON.stringify(offenders)}`,
  )

  // Spec section 6 item 16 is about what the module depends on, which is a
  // property of its code. A flat whole-file scan also reads the comments,
  // and this module's header comment states in prose that it uses no
  // process.env -- so the scan failed the file for documenting the very
  // guarantee the item asks for. Strip comments first and the check means
  // what it says; rewording the source to satisfy a string matcher would
  // have been the wrong repair.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
    .join('\n')

  assert.ok(!code.includes('process.'), 'src/hourstamp.ts must not reference process. anywhere in its code')
  assert.ok(!code.includes('require('), 'src/hourstamp.ts must not use require(), which could bypass the static-import check above')
})
