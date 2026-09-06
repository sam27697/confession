'use client'

// app/_components/Celebrate.tsx
//
// Spec section 9.9: a burst when a confession lands. The send screen already
// said «الرسالة وصلت.» in a notice, which is accurate and says nothing about
// how it felt. This is the half-second that does.
//
// It renders nothing at all when the reader has asked for reduced motion --
// not a slower burst, none. A shower of glyphs across the viewport is the
// single most literal thing that preference exists to stop.
//
// The glyphs are written as literals rather than imported from
// app/_lib/emoji.ts because acceptance item 10c bans a client component from
// importing anything under _lib/: whatever a 'use client' module imports is
// compiled into the browser bundle. Item 7b still holds them to the declared
// vocabulary, so they cannot drift from it -- the check just reads them from
// here instead of following an import.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const GLYPHS = ['💜', '✨', '🔥', '👀', '🚀']

// Fixed spread rather than Math.random(): the burst looks scattered, and it
// looks the same scattered way every time, which means a screenshot of it is
// reproducible and a re-render cannot reshuffle it mid-flight.
const BITS = [
  { left: 6, delay: 0, drift: -18, spin: -24 },
  { left: 14, delay: 120, drift: 12, spin: 18 },
  { left: 23, delay: 40, drift: -8, spin: 32 },
  { left: 31, delay: 200, drift: 20, spin: -14 },
  { left: 39, delay: 80, drift: -14, spin: 22 },
  { left: 47, delay: 260, drift: 6, spin: -30 },
  { left: 55, delay: 20, drift: -20, spin: 16 },
  { left: 63, delay: 160, drift: 14, spin: -20 },
  { left: 71, delay: 100, drift: -6, spin: 28 },
  { left: 79, delay: 220, drift: 18, spin: -16 },
  { left: 87, delay: 60, drift: -12, spin: 20 },
  { left: 94, delay: 180, drift: 8, spin: -26 },
]

const LIFETIME_MS = 1900

export function Celebrate() {
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    setRunning(true)
    const timer = setTimeout(() => setRunning(false), LIFETIME_MS)
    return () => clearTimeout(timer)
  }, [])

  if (!running) return null

  return createPortal(
    // aria-hidden and pointer-events:none in the stylesheet: this is
    // decoration over a screen that has already announced its result in the
    // notice above, and it must not be read out again or catch a tap.
    <div className="celebrate" aria-hidden="true">
      {BITS.map((bit, i) => (
        <span
          key={bit.left}
          className="celebrate__bit"
          style={
            {
              '--bit-left': `${bit.left}%`,
              '--bit-delay': `${bit.delay}ms`,
              '--bit-drift': `${bit.drift}px`,
              '--bit-spin': `${bit.spin}deg`,
            } as React.CSSProperties
          }
        >
          {GLYPHS[i % GLYPHS.length]}
        </span>
      ))}
    </div>,
    document.body,
  )
}
