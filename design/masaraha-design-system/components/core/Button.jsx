import React from 'react'

const base = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
  fontFamily: 'var(--font-ar)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-ar)',
  border: '1px solid transparent', borderRadius: 'var(--radius-button)', cursor: 'pointer',
  transition: 'var(--transition-control)', textAlign: 'center', textDecoration: 'none',
  minHeight: 'var(--tap-min)', whiteSpace: 'nowrap'
}

const sizes = {
  lg: { height: 'var(--control-h)', padding: '0 26px', fontSize: 'var(--size-body)' },
  md: { height: '46px', padding: '0 20px', fontSize: 'var(--size-body-sm)' },
  sm: { height: 'var(--control-h-sm)', minHeight: 'var(--control-h-sm)', padding: '0 14px', fontSize: 'var(--size-caption)' }
}

const variants = {
  primary: { background: 'var(--action-primary)', color: 'var(--text-on-accent)', boxShadow: '0 10px 30px -14px var(--citron-glow)' },
  reveal: { background: 'var(--action-reveal)', color: 'var(--text-on-reveal)', boxShadow: '0 12px 34px -14px var(--rose-glow)' },
  secondary: { background: 'var(--surface-2)', color: 'var(--text-1)', borderColor: 'var(--line)' },
  ghost: { background: 'transparent', color: 'var(--text-2)', borderColor: 'transparent' },
  destructive: { background: 'transparent', color: 'var(--danger-500)', borderColor: 'var(--danger-700)' },
  destructiveSolid: { background: 'var(--danger-500)', color: '#1B0704', borderColor: 'transparent' }
}

/** The one action on a screen. `reveal` is reserved for صارحني بدورك. */
export function Button({ children, variant = 'primary', size = 'lg', block = false, disabled = false, as = 'button', href, onClick, type = 'button', style }) {
  const Tag = as === 'a' ? 'a' : 'button'
  const s = {
    ...base, ...sizes[size], ...variants[variant],
    width: block ? '100%' : undefined,
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? 'none' : undefined,
    boxShadow: disabled ? 'none' : (variants[variant].boxShadow || undefined),
    ...style
  }
  const props = Tag === 'a' ? { href, style: s, onClick } : { type, disabled, style: s, onClick }
  return <Tag {...props}>{children}</Tag>
}
