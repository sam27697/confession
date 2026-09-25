'use client'

// app/_components/ShareRow.tsx
//
// "شارك إلى" -- one control with several destinations, as asked for.
//
// WHAT IS AND IS NOT POSSIBLE HERE, because the difference decides the whole
// layout (docs/SPEC-week16-clickable-story.md §1):
//
//   - A Facebook story that OPENS THE LINK is reachable: Facebook's own
//     share page offers "Your story" as a destination, and the story it
//     makes is the page's link card. That is the lead button, and it is
//     given the story variant of the link (?q=) so the card is the question
//     the person picked.
//   - Every other story (Instagram, TikTok, WhatsApp status) is reachable
//     only through the phone's share sheet, with the image. The same tap
//     puts the link on the clipboard, so the link sticker is one paste.
//
// The grid underneath is for the platforms that accept a link from the web.
// Every one of them opens a POST or a MESSAGE, and each label says which.
//
// The buttons carry names, not logos. Reproducing the platforms' marks is
// their trademark to license, not ours to draw; if official brand assets are
// added later they drop into the same slots.

import { SHARE_TILES, type ShareGlyph } from '../../src/share-targets.js'
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
    case 'feed':
      // A post: a card with lines of text on it.
      return (
        <svg {...common}>
          <rect x="3.6" y="4.4" width="16.8" height="15.2" rx="2.4" />
          <path d="M7.2 9.2h9.6M7.2 12.4h9.6M7.2 15.6h5.6" />
        </svg>
      )
    case 'story':
      // A story: a tall frame inside the ring that every app draws around an
      // unwatched story. A shape, not anyone's mark.
      return (
        <svg {...common}>
          <rect x="7.4" y="2.6" width="9.2" height="18.8" rx="2.6" />
          <path d="M4.4 7.4a9.6 9.6 0 0 0 0 9.2M19.6 7.4a9.6 9.6 0 0 1 0 9.2" />
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
  storyUrl,
  caption,
  onShareImage,
  onDownload,
  canShareImage,
}: {
  shareUrl: string
  storyUrl: string
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

      {SHARE_TILES.map((t) => {
        if (t.kind !== 'story') return null
        return (
          <div key={t.id}>
            <a
              className="btn btn--primary btn--block"
              href={t.href({ url: storyUrl, text: caption })}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Glyph name={t.glyph} />
              {t.label}
            </a>
            <p className="hint hint--tight">
              بتفتحلك صفحة فيسبوك: اختار «قصتك» وانشر. الستوري بيطلع كرت بالسؤال، وأي حدا بيضغط عليه بيوصل لرابطك.
            </p>
          </div>
        )
      })}

      {canShareImage ? (
        <>
          <button type="button" className="btn btn--secondary btn--block" onClick={onShareImage}>
            الصورة للستوري + ستيكر الرابط
          </button>
          <p className="hint hint--tight">
            منسخلك الرابط مع الصورة. بالستوري (انستغرام، فيسبوك وغيرها) حط ستيكر «رابط» والصقه، ليصير الستوري بيفتح عالرابط.
          </p>
        </>
      ) : (
        <button type="button" className="btn btn--secondary btn--block" onClick={onDownload}>
          نزّل الصورة للستوري
        </button>
      )}

      <div className="sharerow__grid">
        {SHARE_TILES.map((t) => {
          // Story tiles are the lead buttons above, not grid chips.
          if (t.kind === 'story') return null
          // A sheet tile has no URL to open -- it hands the PNG to the phone's
          // share sheet. On a browser that cannot share files there is no
          // route at all, so the tile is not rendered rather than rendered
          // dead.
          if (t.kind === 'sheet') {
            if (!canShareImage) return null
            return (
              <button
                key={t.id}
                type="button"
                className="sharechip"
                style={{ ['--chip-accent' as string]: `var(${t.accent})` }}
                onClick={onShareImage}
              >
                <span className="sharechip__glyph"><Glyph name={t.glyph} /></span>
                <span className="sharechip__label">{t.label}</span>
              </button>
            )
          }
          return (
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
          )
        })}

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
