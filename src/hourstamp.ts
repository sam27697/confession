// src/hourstamp.ts
//
// Spec §4: confessions.created_hour carries a database CHECK, live since
// week 2, that rejects any value not truncated to the hour. This module
// renders exactly what that column holds and no finer grain -- a minute
// never appears in the output, in any branch.
//
// Pure by construction: no Date.now(), no process.env, no database, no
// request. The caller resolves "now" once per page render and passes it
// in, so the function itself stays testable with fixed inputs.
//
// Timezone is fixed to Asia/Damascus and resolved through
// Intl.DateTimeFormat rather than a hardcoded +03:00 offset, so daylight
// saving history (Syria ran DST until 2022) comes from the platform's own
// tz database instead of a constant this file would have to keep current.

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

export function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) => AR_DIGITS[Number(digit)])
}

// Levantine month names (§4.2's table), used only once a stamp is more than
// one calendar day old -- same-day and previous-day stamps never name a
// month at all.
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

const DAMASCUS_TIME_ZONE = 'Asia/Damascus'

const DAMASCUS_PARTS_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: DAMASCUS_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  hourCycle: 'h23', // 0-23, never "24" for midnight
})

function damascusParts(at: Date): { year: number; month: number; day: number; hour: number } {
  const parts = DAMASCUS_PARTS_FORMAT.formatToParts(at)
  const read = (type: 'year' | 'month' | 'day' | 'hour'): number =>
    Number(parts.find((p) => p.type === type)?.value)
  return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour') }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Hour-only, day-relative timestamp in Damascus local time. Never a minute,
 * never a relative "منذ دقيقتين" -- a minute-grade stamp plus knowing who
 * was awake identifies the sender (readme rule 4).
 */
export function formatHourStamp(at: Date, now: Date): string {
  const a = damascusParts(at)
  const n = damascusParts(now)

  const meridiem = a.hour >= 12 ? 'م' : 'ص'
  const hour12 = a.hour % 12 === 0 ? 12 : a.hour % 12
  const hourDigits = toArabicDigits(hour12)

  // Calendar-day difference, computed from the Damascus-local y/m/d so a
  // date near midnight never misclassifies across the UTC/local boundary.
  const atDayUtc = Date.UTC(a.year, a.month - 1, a.day)
  const nowDayUtc = Date.UTC(n.year, n.month - 1, n.day)
  const dayDiff = Math.round((nowDayUtc - atDayUtc) / MS_PER_DAY)

  let dayLabel: string
  if (dayDiff === 0) {
    dayLabel = 'اليوم'
  } else if (dayDiff === 1) {
    dayLabel = 'أمس'
  } else {
    dayLabel = `${toArabicDigits(a.day)} ${LEVANTINE_MONTHS[a.month - 1]}`
  }

  return `${dayLabel} ${hourDigits}${meridiem}`
}
