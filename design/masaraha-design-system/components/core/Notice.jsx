import React from 'react'

const tones = {
  info:    { bg: 'var(--surface-2)',  bd: 'var(--line)',            fg: 'var(--text-2)' },
  citron:  { bg: 'var(--citron-wash)',bd: 'rgba(214,242,91,.26)',   fg: 'var(--citron-100)' },
  rose:    { bg: 'var(--rose-wash)',  bd: 'rgba(227,155,168,.28)',  fg: 'var(--rose-100)' },
  warning: { bg: 'var(--pending-wash)',bd: 'rgba(240,185,91,.3)',   fg: '#F7DCA9' },
  danger:  { bg: 'var(--danger-wash)',bd: 'rgba(255,92,77,.32)',    fg: '#FFC9C1' }
}

/** A quiet block of truth: the anonymity disclosure, a rate limit, an error. */
export function Notice({ children, tone = 'info', title, style }) {
  const t = tones[tone] || tones.info
  return (
    <div style={{
      background: t.bg, border: '1px solid ' + t.bd, borderRadius: 'var(--radius-md)',
      padding: '13px 15px', color: t.fg, font: 'var(--type-body-sm)', ...style
    }}>
      {title ? <div style={{ font: 'var(--type-caption)', fontWeight: 'var(--weight-bold)', marginBottom: '4px', opacity: .9 }}>{title}</div> : null}
      {children}
    </div>
  )
}
