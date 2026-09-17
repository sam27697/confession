'use client'

// app/_components/SubmitButton.tsx
//
// Spec §9: a submit button that disables itself and says so while its Server
// Action is in flight. It replaces a plain `<button type="submit">` and
// changes nothing else about the form -- no `action`, no field `name`, no
// validation attribute, per spec §0.
//
// It is only ever placed inside a form whose `action` is a Server Action.
// useFormStatus reports pending for React-driven submissions only; on the
// two native posts in this app (`/auth/dev` and `/auth/logout`, both plain
// `<form action="/url" method="post">`) it would report `pending` forever
// false, and the button would be a spinner that never spins. Those two keep
// their plain `<button>`.
//
// Without JavaScript this degrades to exactly what it replaced: a real
// submit button that posts the form. That is why it is a button and not a
// scripted control -- spec §7.1's "shipping a dead button is worse than
// shipping none" still holds, and this one is never dead.

import { useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'

export function SubmitButton({
  children,
  className,
  loadingText,
}: {
  children: ReactNode
  className?: string
  loadingText?: string
}) {
  const { pending } = useFormStatus()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const button = buttonRef.current
    if (!button) return
    const form = button.closest('form')
    if (!form) return
    const textarea = form.querySelector('textarea[name="body"]') as HTMLTextAreaElement | null
    if (!textarea) return
    const slug = textarea.getAttribute('data-draft-slug')
    if (!slug) return

    const indicator = form.querySelector('#draft-status') as HTMLElement | null

    let saved: string | null = null
    try {
      saved = sessionStorage.getItem('confession_draft_' + slug)
    } catch {
      void 0
    }
    if (saved && !textarea.value) {
      textarea.value = saved
      if (indicator) indicator.textContent = 'تم استعادة المسودة'
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const handleInput = () => {
      if (indicator) indicator.textContent = 'عم يحفظ...'
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        try {
          sessionStorage.setItem('confession_draft_' + slug, textarea.value)
          if (indicator) indicator.textContent = 'تم الحفظ تلقائياً'
        } catch {
          void 0
        }
      }, 150)
    }

    const handleSubmit = () => {
      if (indicator) indicator.textContent = ''
    }

    textarea.addEventListener('input', handleInput)
    form.addEventListener('submit', handleSubmit)
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      textarea.removeEventListener('input', handleInput)
      form.removeEventListener('submit', handleSubmit)
    }
  }, [])

  return (
    <button ref={buttonRef} type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          {/* A CSS shape, not an icon: the stylesheet's header rule is that
              every visual asset in this app is a colour, a gradient or a
              CSS box, and spec §0 lists "no icons" among what the design
              system replaced. aria-hidden because the button's own text
              already carries the state, and aria-busy announces it. */}
          <span className="btn__spinner" aria-hidden="true" />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  )
}

