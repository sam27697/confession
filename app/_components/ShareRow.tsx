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

import { LINK_TARGETS, type ShareGlyph } from '../../src/share-targets.js'
import { useToast } from './ToastProvider.js'

// One 24x24 viewBox, stroked with currentColor so every tile inherits its own
// accent and both themes work without a second asset. These describe the
// action, never a platform's mark.
function Glyph({ name }: { name: ShareGlyph }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  }
  switch (name) {
    case 'bubble':
      return (
        <svg {...common}>
          <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.7 9.7 0 0 1-2.8-.4L4 21l1.6-4.1A8.1 8.1 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3Z" />
        </svg>
      )
    case 'plane':
      return (
        <svg {...common}>
          <path d="M21.5 3.5 2.8 10.4l6.3 2.3 2.3 6.3 10.1-15.5Z" />
          <path d="M9.1 12.7 21.5 3.5" />
        </svg>
      )
    case 'globe':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.6" />
          <path d="M3.4 12h17.2M12 3.4c2.3 2.5 3.4 5.4 3.4 8.6S14.3 18.1 12 20.6c-2.3-2.5-3.4-5.4-3.4-8.6S9.7 5.9 12 3.4Z" />
        </svg>
      )
    case 'spark':
      return (
        <svg {...common}>
          <path d="M12 3.2 13.9 9l5.9 1.9-5.9 1.9L12 20.8 10.1 12.8 4.2 10.9 10.1 9 12 3.2Z" />
        </svg>
      )
    case 'image':
      return (
        <svg {...common}>
          <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.4" />
          <circle cx="8.6" cy="9.6" r="1.6" />
          <path d="m3.9 16.6 4.4-4a2 2 0 0 1 2.7 0l5.3 4.8M14.4 13.2l1.6-1.4a2 2 0 0 1 2.7 0l1.9 1.7" />
        </svg>
      )
    case 'link':
    default:
      return (
        <svg {...common}>
          <path d="M10.1 13.9a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 1 0-5.1-5.1l-1.2 1.2" />
          <path d="M13.9 10.1a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 1 0 5.1 5.1l1.2-1.2" />
        </svg>
      )
  }
}

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
            style={{ ['--chip-accent' as string]: `var(${t.accent})` }}
            href={t.href({ url: shareUrl, text: caption })}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="sharechip__glyph"><Glyph name={t.glyph} /></span>
            <span className="sharechip__label">{t.label}</span>
          </a>
        ))}

        <button
          type="button"
          className="sharechip"
          style={{ ['--chip-accent' as string]: 'var(--citron-700)' }}
          onClick={copyLink}
        >
          <span className="sharechip__glyph"><Glyph name="link" /></span>
          <span className="sharechip__label">انسخ الرابط</span>
        </button>

        {canShareImage && (
          <button
            type="button"
            className="sharechip"
            style={{ ['--chip-accent' as string]: 'var(--action-primary)' }}
            onClick={onDownload}
          >
            <span className="sharechip__glyph"><Glyph name="image" /></span>
            <span className="sharechip__label">نزّل الصورة</span>
          </button>
        )}
      </div>
    </div>
  )
}
