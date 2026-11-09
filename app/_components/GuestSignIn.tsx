'use client'

// app/_components/GuestSignIn.tsx
//
// The sign-in link under the signed-out compose box on /c/<slug> (week 36).
// A visitor writes first and signs in second; what they wrote waits in this
// tab's sessionStorage under the same key the signed-in form restores from,
// and nothing reaches the server until they press «ابعت» after signing in.
//
// The link itself is a plain anchor and works without JavaScript. The effect
// only wires the box's autosave; it never reads the text at click time,
// never touches the href and never navigates.
//
// The box is rendered disabled, with the old "sign in first" hint showing
// (week 36 §5.2). Only when sessionStorage has taken a probe write does the
// effect wire the box, enable it and mark the root data-draft-ready, which
// swaps in the hint that promises the draft is kept. Before hydration, with
// storage refused, or inside an in-app browser about to be left, nothing can
// be typed that would then be lost.

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { wireDraftBox } from './SubmitButton.js'

export function GuestSignIn({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const linkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const root = linkRef.current?.closest('[data-compose]')
    if (!root) return
    const textarea = root.querySelector('textarea[data-draft-slug]') as HTMLTextAreaElement | null
    if (!textarea) return
    try {
      sessionStorage.setItem('confession_draft_probe', '1')
      sessionStorage.removeItem('confession_draft_probe')
    } catch {
      return
    }
    const unwire = wireDraftBox(root, textarea)
    if (!unwire) return
    textarea.disabled = false
    root.setAttribute('data-draft-ready', '')
    // React can reuse this element for OpenInBrowser's escape card, so the
    // attribute set by hand goes when the wiring does (§5.3).
    return () => {
      unwire()
      root.removeAttribute('data-draft-ready')
    }
  }, [])

  return (
    <a ref={linkRef} className={className} href={href}>
      {children}
    </a>
  )
}
