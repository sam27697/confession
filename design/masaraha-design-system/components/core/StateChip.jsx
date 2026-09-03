import React from 'react'

const map = {
  delivered:   { label: 'وصلت',            fg: 'var(--citron-300)',  bg: 'var(--citron-wash)',  bd: 'rgba(214,242,91,.28)' },
  hidden:      { label: 'مخبّاها',          fg: 'var(--hidden-500)',  bg: 'var(--hidden-wash)',  bd: 'rgba(142,127,121,.3)' },
  reported:    { label: 'تم الإبلاغ عنها',  fg: 'var(--danger-500)',  bg: 'var(--danger-wash)',  bd: 'rgba(255,92,77,.3)' },
  pending:     { label: 'لسا ما رد',        fg: 'var(--pending-500)', bg: 'var(--pending-wash)', bd: 'rgba(240,185,91,.32)' },
  resolved:    { label: 'انكشفوا الاتنين',  fg: 'var(--rose-300)',    bg: 'var(--rose-wash)',    bd: 'rgba(227,155,168,.34)' },
  declined:    { label: 'ما وافق',          fg: 'var(--text-2)',      bg: 'var(--surface-2)',    bd: 'var(--line)' },
  cancelled:   { label: 'انسحب العرض',      fg: 'var(--text-3)',      bg: 'transparent',         bd: 'var(--line)' }
}

/** Status of a confession or a reveal offer. Label comes from the state; pass `label` only to override. */
export function StateChip({ state = 'delivered', label, style }) {
  const t = map[state] || map.delivered
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px', font: 'var(--type-caption)',
      color: t.fg, background: t.bg, border: '1px solid ' + t.bd,
      borderRadius: 'var(--radius-chip)', padding: '4px 11px', ...style
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: t.fg, opacity: .9 }}></span>
      {label || t.label}
    </span>
  )
}
