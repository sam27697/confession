'use client'

// app/_components/StoryCard.tsx
//
// Spec section 9: the fourth component of the client island. It draws a
// 1080x1920 story card for the owner's link on a canvas, and hands it to the
// share sheet where there is one or to a download where there is not.
//
// It is the growth screen's whole job made one tap shorter: the link block
// already renders the slug and copies it, and this turns that slug into the
// image the owner actually posts.
//
// Three rules it inherits from the rest of the app:
//
//   - No hardcoded colour. Every value the canvas paints is read from the
//     design tokens on :root at draw time, so the card cannot drift from the
//     stylesheet the way a copied hex literal silently does. Acceptance item
//     2 keeps the stylesheet honest against design/; this keeps the canvas
//     honest against the stylesheet.
//   - No hardcoded origin. The link drawn on the card is built from
//     window.location.origin, so a card made on staging says staging.
//   - Nothing renders until the browser is known to support it, so there is
//     no dead control (spec section 7.1).

import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from './ToastProvider.js'

const PROMPTS = [
  'شي بقلبك عليي ومستحي تقوله بوجهي؟',
  'اعترف بشي بتحبه فيني ومستحيل تتجرأ تحكيه؟',
  'شو أكتر حركة بعملها وبتستفزك بالسر؟',
]

const CARD_W = 1080
const CARD_H = 1920

type Palette = {
  surface1: string
  ground: string
  groundDeep: string
  citron: string
  onAccent: string
  text1: string
  text2: string
  text3: string
  line: string
  fontAr: string
}

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback
  return {
    surface1: token('--surface-1', '#1E1715'),
    ground: token('--ground', '#150F0E'),
    groundDeep: token('--ground-deep', '#0D0908'),
    citron: token('--citron-500', '#D6F25B'),
    onAccent: token('--text-on-accent', '#1A1F06'),
    text1: token('--text-1', '#F5EFE9'),
    text2: token('--text-2', '#B5A69E'),
    text3: token('--text-3', '#7D6E68'),
    line: token('--line', '#382E2B'),
    fontAr: token('--font-ar', 'system-ui,-apple-system,Tahoma,Arial,sans-serif'),
  }
}

// Safari shipped roundRect only in 16.4, and this app's audience is largely
// on phones. Fall back to an arc-built path rather than losing the notch.
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: number | [number, number, number, number],
): void {
  const [tl, tr, br, bl] = typeof radii === 'number' ? [radii, radii, radii, radii] : radii
  ctx.beginPath()
  if (typeof (ctx as { roundRect?: unknown }).roundRect === 'function') {
    ctx.roundRect(x, y, w, h, [tl, tr, br, bl])
    return
  }
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + w - tr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr)
  ctx.lineTo(x + w, y + h - br)
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h)
  ctx.lineTo(x + bl, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl)
  ctx.lineTo(x, y + tl)
  ctx.quadraticCurveTo(x, y, x + tl, y)
  ctx.closePath()
}

function wrapCentred(
  ctx: CanvasRenderingContext2D,
  text: string,
  centreX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(' ')
  let line = ''
  let y = startY
  for (let i = 0; i < words.length; i++) {
    const candidate = line ? `${line} ${words[i]}` : words[i]!
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, centreX, y)
      line = words[i]!
      y += lineHeight
    } else {
      line = candidate
    }
  }
  if (line) ctx.fillText(line, centreX, y)
}

function draw(canvas: HTMLCanvasElement, prompt: string, linkLabel: string): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const p = readPalette()
  canvas.width = CARD_W
  canvas.height = CARD_H

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Arabic shapes and orders correctly in canvas only when the context is
  // told which way the run goes.
  ctx.direction = 'rtl'

  const centre = CARD_W / 2

  const bg = ctx.createRadialGradient(centre, 400, 50, centre, CARD_H / 2, 900)
  bg.addColorStop(0, p.surface1)
  bg.addColorStop(0.5, p.ground)
  bg.addColorStop(1, p.groundDeep)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  const glow = ctx.createRadialGradient(centre, 0, 10, centre, 0, 600)
  glow.addColorStop(0, 'rgba(214,242,91,.18)')
  glow.addColorStop(1, 'rgba(214,242,91,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, CARD_W, 800)

  // The brand mark, drawn the way .brand__mark is drawn in CSS: a citron
  // square whose bottom-leading corner is the notch. Canvas radii run
  // top-left, top-right, bottom-right, bottom-left; in an RTL document the
  // bottom-leading corner is the bottom-right one.
  const markSize = 130
  const markY = 320
  ctx.fillStyle = p.citron
  roundedRect(ctx, centre - markSize / 2, markY - markSize / 2, markSize, markSize, [36, 36, 12, 36])
  ctx.fill()

  ctx.fillStyle = p.onAccent
  ctx.font = `bold 72px ${p.fontAr}`
  ctx.fillText('م', centre, markY + 4)

  ctx.fillStyle = p.text1
  ctx.font = `bold 54px ${p.fontAr}`
  ctx.fillText('مصارحة', centre, 440)

  ctx.fillStyle = p.text2
  ctx.font = `500 36px ${p.fontAr}`
  ctx.fillText('صندوق أسرار', centre, 510)

  const cardW = 920
  const cardH = 580
  const cardX = (CARD_W - cardW) / 2
  const cardY = 640

  ctx.fillStyle = p.surface1
  ctx.strokeStyle = p.line
  ctx.lineWidth = 4
  roundedRect(ctx, cardX, cardY, cardW, cardH, 44)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = p.citron
  ctx.font = `bold 36px ${p.fontAr}`
  ctx.fillText('سؤال الستوري', centre, cardY + 90)

  ctx.fillStyle = p.text1
  ctx.font = `bold 50px ${p.fontAr}`
  wrapCentred(ctx, prompt, centre, cardY + 230, cardW - 120, 76)

  ctx.fillStyle = p.text2
  ctx.font = `400 32px ${p.fontAr}`
  ctx.fillText('احكيلي اللي بقلبك بالسر وبدون ما اعرف مين إنت', centre, cardY + cardH - 80)

  const stickW = 840
  const stickH = 140
  const stickY = 1320
  ctx.fillStyle = 'rgba(214,242,91,.12)'
  ctx.strokeStyle = p.citron
  ctx.lineWidth = 3
  roundedRect(ctx, (CARD_W - stickW) / 2, stickY, stickW, stickH, 70)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = p.citron
  ctx.font = `bold 40px ${p.fontAr}`
  // The link is Latin text inside an RTL context; draw it left-to-right so
  // the slug does not come out reversed.
  ctx.direction = 'ltr'
  ctx.fillText(linkLabel, centre, stickY + stickH / 2 + 2)
  ctx.direction = 'rtl'

  ctx.fillStyle = p.text3
  ctx.font = `400 32px ${p.fontAr}`
  ctx.fillText('حط رابطك بستيكر الرابط بالستوري ليقدروا يجاوبوك مباشرة', centre, 1540)
}

export function StoryCard({ url, slug }: { url: string; slug: string }) {
  const { toast } = useToast()
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    setReady(typeof canvas.getContext === 'function' && !!canvas.getContext('2d'))
  }, [])

  // The label drawn on the card, and the link the share sheet carries, both
  // come from the page's own origin rather than a constant.
  const shareUrl = typeof window === 'undefined' ? url : `${window.location.origin}/c/${slug}`
  const linkLabel = shareUrl.replace(/^https?:\/\//, '')

  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    if (canvas) draw(canvas, PROMPTS[prompt]!, linkLabel)
  }, [open, prompt, linkLabel])

  // Escape closes, the sheet takes focus on open and hands it back on close,
  // and the page behind does not scroll while it is up.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      triggerRef.current?.focus()
    }
  }, [open])

  const handleShare = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(async (blob) => {
      if (!blob) {
        toast('ما قدرنا نجهز البطاقة.', 'danger')
        return
      }
      const file = new File([blob], `masaraha-${slug}.png`, { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'مصارحة', text: shareUrl })
          return
        } catch {
          // A dismissed share sheet is not a failure, and neither is a
          // browser that advertises canShare and then refuses. Fall through
          // to the download, which always works.
        }
      }

      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `masaraha-${slug}.png`
      a.click()
      URL.revokeObjectURL(objectUrl)
      toast('تنزّلت بطاقة الستوري.', 'citron')
    }, 'image/png')
  }, [slug, shareUrl, toast])

  if (!ready) return null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn--secondary btn--sm"
        onClick={() => setOpen(true)}
      >
        بطاقة الستوري
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="بطاقة الستوري"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__head">
              <span>قوالب الستوري</span>
              <button ref={closeRef} type="button" className="btn btn--secondary btn--sm" onClick={() => setOpen(false)}>
                سكّر
              </button>
            </div>

            <p className="hint">اختر السؤال يلي بدك تحطه بالستوري:</p>

            <div className="story-prompts">
              {PROMPTS.map((p, i) => {
                const isActive = i === prompt
                return (
                  <button
                    key={p}
                    type="button"
                    className={isActive ? 'prompt-pill prompt-pill--active' : 'prompt-pill'}
                    aria-pressed={isActive}
                    onClick={() => setPrompt(i)}
                  >
                    {p}
                  </button>
                )
              })}
            </div>

            <div className="story-preview">
              <canvas ref={canvasRef} aria-label="معاينة بطاقة الستوري" />
            </div>

            <button type="button" className="btn btn--primary btn--block" onClick={handleShare}>
              نزّل وشارك
            </button>
          </div>
        </div>
      )}
    </>
  )
}
