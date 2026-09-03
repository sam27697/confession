import React from 'react'

/** The link on/off switch. Label sits before it; the whole row is the tap target. */
export function Toggle({ checked = false, onChange, label, hint, id }) {
  return (
    <label htmlFor={id} style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minHeight: 'var(--tap-min)',
      cursor: 'pointer', userSelect: 'none'
    }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        {label ? <span style={{ display: 'block', font: 'var(--type-body-strong)', color: 'var(--text-1)' }}>{label}</span> : null}
        {hint ? <span style={{ display: 'block', font: 'var(--type-caption)', color: 'var(--text-2)' }}>{hint}</span> : null}
      </span>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange && onChange(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <span aria-hidden="true" style={{
        position: 'relative', flex: '0 0 auto', width: '54px', height: '32px',
        borderRadius: 'var(--radius-pill)',
        background: checked ? 'var(--citron-500)' : 'var(--surface-3)',
        border: '1px solid ' + (checked ? 'var(--citron-700)' : 'var(--line)'),
        boxShadow: checked ? '0 8px 24px -12px var(--citron-glow)' : 'var(--shadow-press)',
        transition: 'background-color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)'
      }}>
        <span style={{
          position: 'absolute', top: '3px', width: '24px', height: '24px', borderRadius: '999px',
          background: checked ? 'var(--text-on-accent)' : 'var(--text-2)',
          right: checked ? '3px' : '25px',
          transition: 'right var(--dur-base) var(--ease-out), background-color var(--dur-base) var(--ease-out)'
        }}></span>
      </span>
    </label>
  )
}
