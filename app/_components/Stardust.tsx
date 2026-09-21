'use client'

// SPIKE B3-T05. This file exists on ux/spike-B-c3-stardust-canvas only, to be
// measured against the pure-CSS radial vignette B3-T03 already ships. It is not
// merged anywhere.

import { useEffect, useRef } from 'react'

type Star = { x: number; y: number; r: number; layer: number; a: number }

const LAYERS = [
  { count: 34, speed: 0.06, depth: 0.18 },
  { count: 22, speed: 0.11, depth: 0.34 },
  { count: 12, speed: 0.18, depth: 0.55 },
]

export function Stardust() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let width = 0
    let height = 0
    let stars: Star[] = []
    let pointerX = 0
    let pointerY = 0
    let raf = 0

    const seed = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      stars = []
      LAYERS.forEach((layer, i) => {
        for (let n = 0; n < layer.count; n++) {
          stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            r: 0.4 + Math.random() * (0.7 + i * 0.5),
            layer: i,
            a: 0.18 + Math.random() * 0.5,
          })
        }
      })
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height)
      for (const s of stars) {
        const layer = LAYERS[s.layer]
        const driftX = pointerX * layer.depth * 14
        const driftY = pointerY * layer.depth * 10
        const twinkle = reduced ? 1 : 0.65 + 0.35 * Math.sin(t * 0.001 * layer.speed * 8 + s.x)
        ctx.globalAlpha = s.a * twinkle
        ctx.beginPath()
        ctx.arc(s.x + driftX, s.y + driftY, s.r, 0, Math.PI * 2)
        ctx.fillStyle = s.layer === 2 ? '#D6F25B' : '#F2EFFF'
        ctx.fill()
      }
      ctx.globalAlpha = 1
      if (!reduced) raf = requestAnimationFrame(draw)
    }

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointerX = (e.clientX - (rect.left + rect.width / 2)) / rect.width
      pointerY = (e.clientY - (rect.top + rect.height / 2)) / rect.height
    }

    seed()
    raf = requestAnimationFrame(draw)
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('resize', seed)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('resize', seed)
    }
  }, [])

  return <canvas ref={ref} className="stardust" aria-hidden="true" />
}
