import React from 'react'

const shell = {
  width: '100%', background: 'var(--bg-field)', color: 'var(--text-1)',
  border: '1px solid var(--border-field)', borderRadius: 'var(--radius-field)',
  font: 'var(--type-body)', padding: '0 15px', height: 'var(--control-h)',
  transition: 'var(--transition-control)', outline: 'none'
}

/** Single-line field: the reveal question, the stake, the report reason, an admin username. */
export function TextField({ id, label, hint, value, onChange, placeholder, type = 'text', maxLength, error, counter, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', ...style }}>
      {label ? <label htmlFor={id} style={{ font: 'var(--type-caption)', color: 'var(--text-2)' }}>{label}</label> : null}
      <input id={id} type={type} value={value} placeholder={placeholder} maxLength={maxLength}
        onChange={(e) => onChange && onChange(e.target.value)}
        style={{ ...shell, borderColor: error ? 'var(--danger-700)' : 'var(--border-field)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        {error
          ? <span style={{ font: 'var(--type-caption)', color: 'var(--danger-500)' }}>{error}</span>
          : hint ? <span style={{ font: 'var(--type-caption)', color: 'var(--text-3)' }}>{hint}</span> : <span></span>}
        {counter && maxLength ? <span style={{ font: 'var(--type-micro)', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{(value || '').length}/{maxLength}</span> : null}
      </div>
    </div>
  )
}
