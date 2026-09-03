import React from 'react'
import { Button } from '../core/Button.jsx'
import { Toggle } from '../core/Toggle.jsx'

/**
 * The growth loop. The user's personal link, a copy action, a share action and
 * the on/off switch. Gets the most visual weight on /inbox.
 */
export function LinkBlock({ origin = 'confession.fayad.app/c/', slug = 'k7m2xq9had4v', enabled = true, copied = false, onCopy, onShare, onToggle, style }) {
  return (
    <section style={{
      position: 'relative', overflow: 'hidden',
      background: 'var(--surface-1)', backgroundImage: 'var(--veil-citron)',
      border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-xl)',
      padding: 'var(--card-pad-lg)', boxShadow: 'var(--shadow-raised)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', ...style
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <span style={{ font: 'var(--type-caption)', color: 'var(--citron-300)' }}>رابطك</span>
        <span style={{ font: 'var(--type-micro)', color: 'var(--text-3)' }}>{enabled ? 'شغال' : 'مطفي'}</span>
      </div>

      <div dir="ltr" style={{
        background: 'var(--bg-field)', border: '1px dashed var(--line-strong)',
        borderRadius: 'var(--radius-field)', padding: '14px 16px',
        font: 'var(--type-slug)', letterSpacing: 'var(--tracking-latin)',
        color: 'var(--text-2)', wordBreak: 'break-all', textAlign: 'left',
        opacity: enabled ? 1 : 0.5
      }}>
        {origin}<span style={{ color: 'var(--citron-500)', fontWeight: 'var(--weight-bold)' }}>{slug}</span>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Button variant="primary" size="md" onClick={onCopy} style={{ flex: 1 }}>{copied ? 'تنسّخ ✓' : 'انسخ الرابط'}</Button>
        <Button variant="secondary" size="md" onClick={onShare} style={{ flex: 1 }}>شارك</Button>
      </div>

      <div style={{ paddingTop: 'var(--space-2)', borderTop: '1px solid var(--line-faint)' }}>
        <Toggle id="link-enabled" checked={enabled} onChange={onToggle}
          label="الرابط شغال" hint={enabled ? 'الناس تقدر تبعتلك هلق.' : 'ما حدا يقدر يبعتلك لحد ما تشغلو.'} />
      </div>
    </section>
  )
}
