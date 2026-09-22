'use client'

// app/_components/OpenInBrowser.tsx
//
// The guard between a story link and a dead end.
//
// Google refuses OAuth inside an embedded webview and answers
// `403 disallowed_useragent`. This app is shared as a link in a story, so
// most first visits arrive inside Instagram's or Facebook's in-app browser —
// which is precisely where the only login cannot work. Left alone, the app's
// growth path and its sign-in are mutually exclusive, and the user sees a
// Google error page with our name on it.
//
// So: when the page is inside one of those browsers, the login button is
// replaced by the way out. The sign-in button is still reachable underneath
// as a quiet link, because the detection list is a list of strings and any
// such list is eventually wrong.
//
// Detection runs in an effect, never during render: the server has no user
// agent, and a server/client mismatch here would flash the wrong UI on the
// screen of every visitor.

import { useEffect, useState } from 'react'
import { isInAppBrowser, detectPlatform, escapeUrl } from '../../src/inapp.js'
import { useToast } from './ToastProvider.js'

export function OpenInBrowser({ children }: { children: React.ReactNode }) {
  const { toast } = useToast()
  const [inApp, setInApp] = useState(false)
  const [escape, setEscape] = useState<string | null>(null)
  const [override, setOverride] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent || ''
    if (!isInAppBrowser(ua)) return
    setInApp(true)
    setEscape(escapeUrl(window.location.href, detectPlatform(ua)))
  }, [])

  if (!inApp || override) return <>{children}</>

  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href)
      .then(() => toast('تم نسخ الرابط. افتحه بمتصفح الهاتف.', 'citron'))
      .catch(() => toast('ما قدرنا ننسخ الرابط.', 'danger'))
  }

  return (
    <div className="card card--citron">
      <p className="hint">
        إنت فاتح الصفحة جوا تطبيق، وتسجيل الدخول بغوغل ما بيشتغل هون.
        افتح الرابط بمتصفح الهاتف وكمّل بضغطة وحدة.
      </p>

      {escape ? (
        <a className="btn btn--primary btn--block" href={escape}>
          افتح بالمتصفح
        </a>
      ) : (
        <p className="hint">
          اضغط على ⋯ فوق واختار «فتح بالمتصفح».
        </p>
      )}

      <button type="button" className="btn btn--secondary btn--block" onClick={copyLink}>
        انسخ الرابط
      </button>

      <button type="button" className="linkish" onClick={() => setOverride(true)}>
        جرّب تسجيل الدخول هون على كل حال
      </button>
    </div>
  )
}
