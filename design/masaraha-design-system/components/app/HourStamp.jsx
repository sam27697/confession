import React from 'react'

const AR = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
export function toArabicDigits(n) { return String(n).replace(/[0-9]/g, (d) => AR[+d]) }

/**
 * Hour-only timestamp. Never a minute, never "منذ دقيقتين" — a minute-level
 * stamp plus knowing who was awake identifies the sender.
 */
export function HourStamp({ day = 'اليوم', hour = 2, meridiem = 'ص', style }) {
  return (
    <span style={{ font: 'var(--type-micro)', color: 'var(--text-3)', whiteSpace: 'nowrap', ...style }}>
      {day} {toArabicDigits(hour)}{meridiem}
    </span>
  )
}
