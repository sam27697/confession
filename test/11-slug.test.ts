import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SLUG_ALPHABET, SLUG_LENGTH, generateSlug } from '../src/slug.js'

test('§4.2 the alphabet excludes 0, 1, i, l and o', () => {
  for (const excluded of ['0', '1', 'i', 'l', 'o']) {
    assert.ok(!SLUG_ALPHABET.includes(excluded), `alphabet must not contain ${excluded}`)
  }
  assert.equal(SLUG_ALPHABET.length, 31)
})

test('§4.2 10,000 generated slugs are 12 characters, drawn only from the alphabet, and unique', () => {
  const slugs = new Set<string>()
  for (let i = 0; i < 10_000; i++) {
    const slug = generateSlug()
    assert.equal(slug.length, SLUG_LENGTH)
    for (const ch of slug) assert.ok(SLUG_ALPHABET.includes(ch), `unexpected character ${ch} in slug ${slug}`)
    slugs.add(slug)
  }
  assert.equal(slugs.size, 10_000, 'no collision across 10,000 draws')
})

test('§4.2 character distribution across 10,000 slugs is not modulo-biased', () => {
  // A plain `randomByte % 31` draw is NOT uniform: 256 is not a multiple of
  // 31 (256 = 8*31 + 8), so under a naive modulo the first 8 letters of the
  // alphabet would land about 12.5% more often than the rest. generateSlug
  // uses rejection sampling specifically to avoid that, so this checks the
  // realised distribution is consistent with a fair 31-sided die, via a
  // chi-square goodness-of-fit test over the 31 characters.
  //
  // Degrees of freedom = 31 - 1 = 30. The chi-square critical value for
  // df=30 at alpha=0.001 — a one-in-a-thousand false-failure rate, chosen
  // to keep this stable across repeated CI runs while still failing hard
  // on a real bias — is 59.70 (standard chi-square table). Worked out by
  // hand for the biased-modulo alternative at this sample size, the
  // statistic lands in the hundreds, so the margin between "fair" and
  // "biased" here is wide and this bound is not a coin flip either way.
  const CHI_SQUARE_CRITICAL_DF30_ALPHA001 = 59.7

  const counts = new Map<string, number>()
  for (const ch of SLUG_ALPHABET) counts.set(ch, 0)

  let totalChars = 0
  for (let i = 0; i < 10_000; i++) {
    for (const ch of generateSlug()) {
      counts.set(ch, (counts.get(ch) ?? 0) + 1)
      totalChars += 1
    }
  }

  const expected = totalChars / SLUG_ALPHABET.length
  let chiSquare = 0
  for (const observed of counts.values()) {
    chiSquare += (observed - expected) ** 2 / expected
  }

  assert.ok(
    chiSquare < CHI_SQUARE_CRITICAL_DF30_ALPHA001,
    `chi-square statistic ${chiSquare.toFixed(2)} exceeds the df=30 alpha=0.001 critical value ${CHI_SQUARE_CRITICAL_DF30_ALPHA001} — distribution looks biased`,
  )
})
