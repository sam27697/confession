import React from 'react'

/** A consent line the user has to tick. The onboarding age gate is two of these. */
export function CheckboxRow({ id, checked = false, onChange, children, strong = false }) {
  return (
    <label htmlFor={id} style={{
      display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
      minHeight: 'var(--tap-min)', padding: '10px 12px', cursor: 'pointer',
      background: checked ? 'var(--citron-wash)' : 'var(--surface-2)',
      border: '1px solid ' + (checked ? 'rgba(214,242,91,.3)' : 'var(--line)'),
      borderRadius: 'var(--radius-field)', transition: 'var(--transition-control)'
    }}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange && onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <span aria-hidden="true" style={{
        flex: '0 0 auto', width: '24px', height: '24px', marginTop: '3px',
        borderRadius: 'var(--radius-xs)', display: 'grid', placeItems: 'center',
        background: checked ? 'var(--citron-500)' : 'transparent',
        border: '1px solid ' + (checked ? 'var(--citron-500)' : 'var(--line-strong)'),
        color: 'var(--text-on-accent)', font: 'var(--weight-black) 14px/1 var(--font-latin)'
      }}>{checked ? '✓' : ''}</span>
      <span style={{
        font: strong ? 'var(--type-body-strong)' : 'var(--type-body-sm)',
        color: checked ? 'var(--text-1)' : 'var(--text-2)'
      }}>{children}</span>
    </label>
  )
}
