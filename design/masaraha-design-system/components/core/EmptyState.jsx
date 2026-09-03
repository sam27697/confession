import React from 'react'

/** Not an error state — a prompt. The empty inbox is the screen that decides whether a user shares their link. */
export function EmptyState({ title, body, action, glyph = 'bubble', style }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      gap: 'var(--space-4)', padding: 'var(--space-10) var(--space-5)',
      background: 'var(--veil-citron)', borderRadius: 'var(--radius-card)', ...style
    }}>
      <span aria-hidden="true" style={{
        width: '64px', height: '64px', display: 'grid', placeItems: 'center',
        borderRadius: 'var(--radius-bubble)', background: 'var(--surface-2)',
        border: '1px solid var(--line)', color: 'var(--citron-500)',
        font: 'var(--weight-black) 28px/1 var(--font-ar)'
      }}>{glyph === 'bubble' ? 'م' : '؟'}</span>
      <div style={{ font: 'var(--type-subtitle)', color: 'var(--text-1)' }}>{title}</div>
      {body ? <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-2)', maxWidth: '30ch' }}>{body}</div> : null}
      {action ? <div style={{ marginTop: 'var(--space-2)' }}>{action}</div> : null}
    </div>
  )
}
