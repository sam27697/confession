import React from 'react'

/** The mark: a notched speech bubble carrying م. Drawn inline — the app ships no image files. */
export function BrandMark({ size = 40, tone = 'citron', wordmark = false, style }) {
  const bg = tone === 'citron' ? 'var(--citron-500)' : tone === 'rose' ? 'var(--rose-500)' : 'var(--text-1)'
  const fg = tone === 'citron' ? 'var(--text-on-accent)' : tone === 'rose' ? 'var(--text-on-reveal)' : 'var(--ground)'
  const r = Math.round(size * 0.28)
  const notch = Math.round(size * 0.08)
  const mark = (
    <span aria-hidden="true" style={{
      width: size, height: size, flex: '0 0 auto', display: 'grid', placeItems: 'center',
      background: bg, color: fg,
      borderRadius: r + 'px ' + r + 'px ' + notch + 'px ' + r + 'px',
      font: 'var(--weight-black) ' + Math.round(size * 0.52) + 'px/1 var(--font-ar)',
      paddingBottom: Math.round(size * 0.04)
    }}>م</span>
  )
  if (!wordmark) return <span style={style}>{mark}</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.3), ...style }}>
      {mark}
      <span style={{ font: 'var(--weight-black) ' + Math.round(size * 0.6) + 'px/1 var(--font-ar)', color: 'var(--text-1)' }}>مصارحة</span>
    </span>
  )
}
