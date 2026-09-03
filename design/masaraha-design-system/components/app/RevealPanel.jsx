import React from 'react'
import { Card } from '../core/Card.jsx'
import { StateChip } from '../core/StateChip.jsx'

const row = { display: 'flex', flexDirection: 'column', gap: '4px' }
const lbl = { font: 'var(--type-caption)', color: 'var(--rose-300)' }
const val = { font: 'var(--type-body-strong)', color: 'var(--text-1)' }

/**
 * The reveal exchange — the emotional centre. Shows the recipient's question and
 * her stake, and on `resolved`, both answers and the sender's name.
 */
export function RevealPanel({ state = 'pending', question, stake, senderAnswer, recipientAnswer, senderName, viewpoint = 'sender', footer, style }) {
  const resolved = state === 'resolved'
  return (
    <Card tone="rose" pad="lg" style={{
      borderRadius: 'var(--radius-xl)',
      backgroundImage: resolved ? 'var(--veil-rose)' : undefined,
      boxShadow: resolved ? 'var(--glow-rose)' : undefined,
      display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', ...style
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <span style={{ font: 'var(--type-subtitle)', color: 'var(--rose-100)' }}>صارحني بدورك</span>
        <StateChip state={state} />
      </div>

      {resolved && senderName ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
          <div style={{ font: 'var(--type-caption)', color: 'var(--rose-300)', marginBottom: '6px' }}>يلي بعتلك</div>
          <div style={{ font: 'var(--type-display)', color: 'var(--text-1)' }}>{senderName}</div>
        </div>
      ) : null}

      {question ? <div style={row}><span style={lbl}>{viewpoint === 'sender' ? 'شو بدها تعرف' : 'شو سألتو'}</span><span style={val}>{question}</span></div> : null}
      {stake ? <div style={row}><span style={lbl}>{viewpoint === 'sender' ? 'شو رح تحكيلك عن حالها' : 'شو حكيتلو عن حالك'}</span><span style={val}>{stake}</span></div> : null}

      {resolved ? (
        <>
          <div style={{ height: '1px', background: 'rgba(227,155,168,.24)' }}></div>
          <div style={row}><span style={lbl}>جوابه</span><span style={val}>{senderAnswer}</span></div>
          <div style={row}><span style={lbl}>جوابك</span><span style={val}>{recipientAnswer}</span></div>
        </>
      ) : null}

      {state === 'pending' ? (
        <div style={{ font: 'var(--type-body-sm)', color: 'var(--rose-100)', opacity: .8 }}>
          ما حدا بيشوف جواب التاني قبل ما ينزلوا الاتنين سوا.
        </div>
      ) : null}
      {state === 'declined' ? (
        <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>ما وافق على المصارحة. جوابك ضلّ عندك وما حدا شافو.</div>
      ) : null}
      {state === 'cancelled' ? (
        <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-2)' }}>انسحب عرض المصارحة.</div>
      ) : null}

      {footer ? <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>{footer}</div> : null}
    </Card>
  )
}
