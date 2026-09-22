'use client'

// app/_components/ShareRow.tsx
//
// "شارك إلى" — one control with several destinations, as asked for.
//
// WHAT IS AND IS NOT POSSIBLE HERE, because the difference decides the whole
// layout: **no web page can post to an Instagram, TikTok, WhatsApp or
// Facebook story.** None of them expose a web endpoint for it. The only
// route from a page into a story is the phone's own share sheet — which
// DOES list all of those apps — so that is the primary button, and it
// carries the image itself, not a link.
//
// The row underneath is for the platforms that accept a link from the web.
// Every one of them opens a POST or a MESSAGE, and each label says which.
// A button labelled "انستغرام ستوري" that cannot do it is worse than no
// button, so there isn't one.
//
// The buttons carry names, not logos. Reproducing the platforms' marks is
// their trademark to license, not ours to draw; if official brand assets are
// added later they drop into the same slots.

import { LINK_TARGETS } from '../../src/share-targets.js'
import { useToast } from './ToastProvider.js'

export function ShareRow({
  shareUrl,
  caption,
  onShareImage,
  onDownload,
  canShareImage,
}: {
  shareUrl: string
  caption: string
  onShareImage: () => void
  onDownload: () => void
  canShareImage: boolean
}) {
  const { toast } = useToast()

  const copyLink = () => {
    navigator.clipboard?.writeText(shareUrl)
      .then(() => toast('تم نسخ الرابط.', 'citron'))
      .catch(() => toast('ما قدرنا ننسخ الرابط.', 'danger'))
  }

  return (
    <div className="sharerow">
      <p className="hint">شارك إلى:</p>

      {canShareImage ? (
        <>
          <button type="button" className="btn btn--primary btn--block" onClick={onShareImage}>
            الصورة للستوري
          </button>
          <p className="hint hint--tight">
            بتفتح لك تطبيقات الهاتف (انستغرام، واتساب، تيك توك وغيرها) واختار منها.
          </p>
        </>
      ) : (
        <button type="button" className="btn btn--primary btn--block" onClick={onDownload}>
          نزّل الصورة للستوري
        </button>
      )}

      <div className="sharerow__grid">
        {LINK_TARGETS.map((t) => (
          <a
            key={t.id}
            className="sharechip"
            href={t.href({ url: shareUrl, text: caption })}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.label}
          </a>
        ))}

        <button type="button" className="sharechip" onClick={copyLink}>
          انسخ الرابط
        </button>

        {canShareImage && (
          <button type="button" className="sharechip" onClick={onDownload}>
            نزّل الصورة
          </button>
        )}
      </div>
    </div>
  )
}
