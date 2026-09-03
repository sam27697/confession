import React from 'react'
import { BrandMark } from '../brand/BrandMark.jsx'

/** Sticky glass header. Two destinations, never more. */
export function AppHeader({ active = 'inbox', onNavigate, signedIn = true, plain = false, style }) {
  const items = plain
    ? [{ id: 'admin', label: 'لوحة الإدارة' }, { id: 'reports', label: 'البلاغات' }]
    : [{ id: 'inbox', label: 'صندوقك' }, { id: 'sent', label: 'يلي بعتها' }]
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 5,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)',
      padding: '12px var(--gutter)',
      background: plain ? 'var(--surface-1)' : 'var(--glass-bg)',
      backdropFilter: plain ? undefined : 'var(--glass-blur)',
      WebkitBackdropFilter: plain ? undefined : 'var(--glass-blur)',
      borderBottom: '1px solid var(--line)', ...style
    }}>
      <BrandMark size={32} tone={plain ? 'light' : 'citron'} wordmark={!plain} style={{ flex: '0 0 auto' }} />
      {plain ? <span style={{ font: 'var(--type-caption)', color: 'var(--text-2)' }}>إدارة</span> : null}
      {signedIn ? (
        <nav style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {items.map((it) => (
            <button key={it.id} type="button" onClick={() => onNavigate && onNavigate(it.id)} style={{
              background: active === it.id ? 'var(--surface-3)' : 'transparent',
              color: active === it.id ? 'var(--text-1)' : 'var(--text-2)',
              border: '1px solid ' + (active === it.id ? 'var(--line-strong)' : 'transparent'),
              borderRadius: 'var(--radius-pill)', padding: '9px 14px', minHeight: 'var(--control-h-sm)',
              font: 'var(--type-caption)', cursor: 'pointer', transition: 'var(--transition-control)'
            }}>{it.label}</button>
          ))}
        </nav>
      ) : null}
    </header>
  )
}
