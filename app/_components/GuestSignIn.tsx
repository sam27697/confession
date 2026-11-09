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
    return wireDraftBox(root, textarea)
  }, [])

  return (
    <a ref={linkRef} className={className} href={href}>
      {children}
    </a>
  )
}
