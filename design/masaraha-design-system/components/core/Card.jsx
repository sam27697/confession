import React from 'react'

/** The base panel. `bubble` notches the bottom-leading corner so it reads as speech. */
export function Card({ children, bubble = false, raised = false, tone = 'default', pad = 'md', style }) {
  const tones = {
    default: { background: raised ? 'var(--surface-2)' : 'var(--bg-card)', border: '1px solid var(--border-card)' },
    citron:  { background: 'var(--citron-wash)', border: '1px solid rgba(214,242,91,.26)' },
    rose:    { background: 'var(--rose-wash)', border: '1px solid rgba(227,155,168,.3)' },
    inset:   { background: 'var(--bg-field)', border: '1px solid var(--line-faint)' }
  }
  return (
    <div style={{
      ...tones[tone],
      borderRadius: bubble ? 'var(--radius-bubble)' : 'var(--radius-card)',
      padding: pad === 'lg' ? 'var(--card-pad-lg)' : pad === 'sm' ? '12px 14px' : 'var(--card-pad)',
      boxShadow: raised ? 'var(--shadow-raised)' : 'var(--shadow-card)',
      ...style
    }}>{children}</div>
  )
}
