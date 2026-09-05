'use client'

// app/_components/ToastProvider.tsx
//
// Spec §9: one of the three client components the island authorises. It
// renders a live region at the root of every page and hands `toast()` to the
// components below it.
//
// Two tones, and they are the stylesheet's own: a confirmation is citron, a
// failure is danger. A toast is a transient echo of a `.notice`, so it
// borrows that vocabulary rather than inventing success/error/info -- there
// is no third tone because there is no third thing the app has to say this
// way.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export type ToastTone = 'citron' | 'danger'

type Toast = { id: number; message: string; tone: ToastTone; leaving: boolean }

// Long enough to read a short Arabic sentence, short enough that a stale
// toast is never still on screen when the next action completes.
const VISIBLE_MS = 3200
// Must stay in step with the .toast--leaving transition in app/globals.css.
const EXIT_MS = 240

const ToastContext = createContext<{ toast: (message: string, tone?: ToastTone) => void }>({
  toast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Every timer this provider starts is tracked and cleared on unmount, so
  // navigating away mid-toast cannot leave a setState aimed at a dead tree.
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending) clearTimeout(timer)
      pending.length = 0
    }
  }, [])

  const toast = useCallback((message: string, tone: ToastTone = 'citron') => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, tone, leaving: false }])

    timers.current.push(
      setTimeout(() => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
        timers.current.push(
          setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), EXIT_MS),
        )
      }, VISIBLE_MS),
    )
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* polite, not assertive: a "link copied" confirmation must never
          interrupt a screen reader mid-sentence. The container is always
          rendered so the live region exists before the first announcement --
          a region inserted at the same moment as its text is not reliably
          announced. */}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {/* The tone comparison is hoisted out of the attribute, and the class
            strings are spelled out as whole literals, for the same reason
            app/inbox/page.tsx hoists `isHidden`. Acceptance item 5 reads
            class names straight out of the source: it takes every string
            literal inside a className expression, so `t.tone === 'danger'`
            written inline would offer it the class `danger`; and it sees
            only literals, so a helper's return value would be invisible and
            the four toast rules would read as dead. Verbose, and checkable. */}
        {toasts.map((t) => {
          const isDanger = t.tone === 'danger'
          return (
            <p
              key={t.id}
              className={
                isDanger
                  ? t.leaving
                    ? 'toast toast--danger toast--leaving'
                    : 'toast toast--danger'
                  : t.leaving
                    ? 'toast toast--citron toast--leaving'
                    : 'toast toast--citron'
              }
            >
              {t.message}
            </p>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
