import React from 'react'
import { StateChip } from '../core/StateChip.jsx'
import { HourStamp } from './HourStamp.jsx'

/**
 * One received confession. There is no sender, no avatar and no name here by
 * design — the card is composed so the absence reads as intentional.
 */
export function MessageCard({ body, day = 'اليوم', hour = 2, meridiem = 'ص', status = 'delivered', offerState, truncate = false, expanded = false, onExpand, actions, children, style }) {
  const dim = status === 'hidden'
  return (
    <article style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-bubble)', padding: 'var(--card-pad)',
      boxShadow: 'var(--shadow-card)', opacity: dim ? 0.62 : 1,
      display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', ...style
    }}>
      <p style={{
        font: 'var(--weight-medium) var(--size-subtitle)/1.65 var(--font-ar)', color: 'var(--text-1)', margin: 0,
        ...(truncate && !expanded ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {})
      }}>{body}</p>
      {truncate && !expanded ? (
        <button type="button" onClick={onExpand} style={{
          alignSelf: 'flex-start', background: 'none', border: 'none', padding: '4px 0',
          color: 'var(--link)', font: 'var(--type-caption)', cursor: 'pointer'
        }}>كمّل قراءة</button>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <HourStamp day={day} hour={hour} meridiem={meridiem} />
        <span style={{ width: '1px', height: '12px', background: 'var(--line)' }}></span>
        <StateChip state={status} />
        {offerState ? <StateChip state={offerState} /> : null}
      </div>
      {children}
      {actions ? (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)',
          paddingTop: 'var(--space-3)', borderTop: '1px solid var(--line-faint)'
        }}>{actions}</div>
      ) : null}
    </article>
  )
}
