import React from 'react'

/** The writing area. On the public send page it is the screen's centre of gravity. */
export function TextArea({ id, label, hint, value, onChange, placeholder, rows = 5, maxLength = 4000, counter = true, hero = false, error, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', ...style }}>
      {label ? <label htmlFor={id} style={{ font: 'var(--type-caption)', color: 'var(--text-2)' }}>{label}</label> : null}
      <textarea id={id} rows={rows} value={value} placeholder={placeholder} maxLength={maxLength}
        onChange={(e) => onChange && onChange(e.target.value)}
        style={{
          width: '100%', resize: 'none', background: 'var(--bg-field)', color: 'var(--text-1)',
          border: '1px solid ' + (error ? 'var(--danger-700)' : 'var(--border-field)'),
          borderRadius: hero ? 'var(--radius-bubble)' : 'var(--radius-field)',
          font: hero ? 'var(--weight-medium) var(--size-subtitle)/1.7 var(--font-ar)' : 'var(--type-body)',
          padding: hero ? '18px' : '14px 15px', outline: 'none',
          transition: 'var(--transition-control)'
        }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        {error
          ? <span style={{ font: 'var(--type-caption)', color: 'var(--danger-500)' }}>{error}</span>
          : hint ? <span style={{ font: 'var(--type-caption)', color: 'var(--text-3)' }}>{hint}</span> : <span></span>}
        {counter ? <span style={{ font: 'var(--type-micro)', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{(value || '').length}/{maxLength}</span> : null}
      </div>
    </div>
  )
}
