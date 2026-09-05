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

import { useEffect, useState } from 'react'
import { useToast } from './ToastProvider.js'

export function CopyLink({ url }: { url: string }) {
  const { toast } = useToast()
  const [canCopy, setCanCopy] = useState(false)

  useEffect(() => {
    setCanCopy(typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function')
  }, [])

  if (!canCopy) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast('اننسخ الرابط.', 'citron')
    } catch {
      // Permission denied, or a document that is not focused. The slug is on
      // screen regardless, so the recovery is to say so plainly.
      toast('ما قدرنا ننسخ الرابط. فيك تعلّمه بإيدك.', 'danger')
    }
  }

  return (
    <button type="button" className="btn btn--secondary btn--sm" onClick={handleCopy}>
      انسخ الرابط
    </button>
  )
}
