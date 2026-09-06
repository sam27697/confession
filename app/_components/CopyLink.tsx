'use client'

// app/_components/CopyLink.tsx
//
// Spec §7.1 recorded the copy button as deliberately not built, because it
// needs `navigator.clipboard` and the app shipped no client JavaScript, and
// "shipping a button that does nothing is worse than shipping none". Spec §9
// takes that decision and builds it -- but keeps the sentence that justified
// deferring it.
//
// So the button renders only once two things are true on this device: the
// component has mounted (JavaScript ran) and `navigator.clipboard.writeText`
// actually exists. It is absent on a page with JavaScript off, and absent in
// a context where the Clipboard API is unavailable -- an insecure origin,
// most obviously, which is exactly where a naive `navigator.clipboard.write`
// throws a TypeError that a `.catch()` never sees, because the throw happens
// while reading the property rather than inside the promise.
//
// The slug itself stays selectable text above this button either way, so the
// link is always obtainable by hand. This is an accelerator, never the only
// route.

import { useEffect, useRef, useState } from 'react'
import { useToast } from './ToastProvider.js'
import { Celebrate } from './Celebrate.js'

const CONFIRM_MS = 1400

export function CopyLink({ url }: { url: string }) {
  const { toast } = useToast()
  const [canCopy, setCanCopy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setCanCopy(typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function')
  }, [])

  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    if (celebrateTimer.current) clearTimeout(celebrateTimer.current)
  }, [])

  if (!canCopy) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast('اننسخ الرابط.', 'citron')
      // The toast lands at the bottom of the screen and the thumb is at the
      // top of it, so the button confirms in place as well.
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current)
      setCopied(true)
      setCelebrating(true)
      confirmTimer.current = setTimeout(() => setCopied(false), CONFIRM_MS)
      celebrateTimer.current = setTimeout(() => setCelebrating(false), 2000)
    } catch {
      // Permission denied, or a document that is not focused. The slug is on
      // screen regardless, so the recovery is to say so plainly.
      toast('ما قدرنا ننسخ الرابط. فيك تعلّمه بإيدك.', 'danger')
    }
  }

  return (
    <>
      <button
        type="button"
        className={copied ? 'btn btn--secondary btn--sm btn--copied' : 'btn btn--secondary btn--sm'}
        onClick={handleCopy}
      >
        {copied ? 'اننسخ ✅' : 'انسخ الرابط 🔗'}
      </button>
      {celebrating && <Celebrate />}
    </>
  )
}
