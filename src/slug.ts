// src/slug.ts
//
// Public link slugs (spec §4.2). Alphabet excludes 0/1/i/l/o — characters
// that look like each other in a lot of fonts, which turns into a support
// ticket the first time someone copies a slug off a screenshot.
//
// Drawn via rejection sampling over crypto.randomBytes, NOT `% alphabet
// length`. The alphabet below is 31 characters and 256 (one byte) is not a
// multiple of 31, so a plain modulo would land on the low end of the
// alphabet slightly more often than the high end. That is a small bias, but
// a public identifier is exactly the kind of thing where "small and free to
// avoid" is worth getting right the first time rather than explaining later.

import { randomBytes } from 'node:crypto'

export const SLUG_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export const SLUG_LENGTH = 12

const ALPHABET_LEN = SLUG_ALPHABET.length

// The largest multiple of ALPHABET_LEN that still fits in a byte (0-255).
// A drawn byte at or above this ceiling is discarded and redrawn, so every
// byte that is kept maps onto the alphabet with exactly equal probability.
const REJECTION_CEILING = Math.floor(256 / ALPHABET_LEN) * ALPHABET_LEN

export function generateSlug(): string {
  const chars: string[] = []
  while (chars.length < SLUG_LENGTH) {
    // Draw a batch of random bytes at a time rather than one at a time —
    // the common case needs no more than SLUG_LENGTH bytes and only
    // occasionally a few extra to replace a rejected one.
    const batch = randomBytes(SLUG_LENGTH)
    for (const byte of batch) {
      if (chars.length >= SLUG_LENGTH) break
      if (byte >= REJECTION_CEILING) continue // biased range — discard and redraw
      chars.push(SLUG_ALPHABET[byte % ALPHABET_LEN])
    }
  }
  return chars.join('')
}
