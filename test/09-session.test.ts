import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signPayload, verifyPayload, signSession, verifySession, SESSION_MAX_AGE_MS } from '../src/session.js'

const SECRET_A = 'a'.repeat(32)
const SECRET_B = 'b'.repeat(32)
const ONE_MINUTE_MS = 60 * 1000

test('§3.3 a valid token round-trips through signPayload/verifyPayload', () => {
  const token = signPayload(SECRET_A, { accountId: 'abc-123' })
  const result = verifyPayload<{ accountId: string }>(SECRET_A, token, { maxAgeMs: ONE_MINUTE_MS })
  assert.ok(result)
  assert.equal(result.accountId, 'abc-123')
  assert.equal(typeof result.iat, 'number')
})

test('§3.3 a tampered payload is rejected', () => {
  const token = signPayload(SECRET_A, { accountId: 'abc-123' })
  const [, signature] = token.split('.')
  const tamperedBody = Buffer.from(JSON.stringify({ accountId: 'someone-else', iat: Date.now() }), 'utf8').toString(
    'base64url',
  )

  const result = verifyPayload(SECRET_A, `${tamperedBody}.${signature}`, { maxAgeMs: ONE_MINUTE_MS })
  assert.equal(result, null)
})

test('§3.3 a tampered signature is rejected', () => {
  const token = signPayload(SECRET_A, { accountId: 'abc-123' })
  const [body, signature] = token.split('.')

  // Tamper with the decoded bytes, not with the encoded character. A
  // 32-byte HMAC is 43 base64url characters and 43 * 6 = 258 bits, so the
  // last character carries only 4 significant bits -- its low 2 bits are
  // padding that base64url decoding discards. 'A' (index 0) and 'B' (index
  // 1) therefore decode to identical bytes, and the previous version of
  // this test, which rewrote the last character to 'B' whenever it was
  // already 'A', tampered with nothing at all whenever the signature's
  // final nibble happened to be zero: one run in sixteen, passing by luck
  // the other fifteen. Flipping a byte outright is unambiguous.
  const raw = Buffer.from(signature!, 'base64url')
  raw[0] ^= 0xff
  const tamperedSignature = raw.toString('base64url')
  assert.notEqual(tamperedSignature, signature, 'the tamper must actually change the signature')

  const result = verifyPayload(SECRET_A, `${body}.${tamperedSignature}`, { maxAgeMs: ONE_MINUTE_MS })
  assert.equal(result, null)
})

test('§3.3 a token verified against a foreign secret is rejected', () => {
  const token = signPayload(SECRET_A, { accountId: 'abc-123' })
  const result = verifyPayload(SECRET_B, token, { maxAgeMs: ONE_MINUTE_MS })
  assert.equal(result, null)
})

test('§3.3 an iat older than maxAgeMs is rejected regardless of signature validity', () => {
  const token = signPayload(SECRET_A, { accountId: 'abc-123' })
  const wayLater = Date.now() + ONE_MINUTE_MS + 1000
  const result = verifyPayload(SECRET_A, token, { maxAgeMs: ONE_MINUTE_MS, nowMs: wayLater })
  assert.equal(result, null)
})

test('§3.3 malformed tokens (wrong shape, empty parts) are rejected without throwing', () => {
  assert.equal(verifyPayload(SECRET_A, 'not-a-real-token', { maxAgeMs: ONE_MINUTE_MS }), null)
  assert.equal(verifyPayload(SECRET_A, '', { maxAgeMs: ONE_MINUTE_MS }), null)
  assert.equal(verifyPayload(SECRET_A, '.', { maxAgeMs: ONE_MINUTE_MS }), null)
  assert.equal(verifyPayload(SECRET_A, 'a.b.c', { maxAgeMs: ONE_MINUTE_MS }), null)
})

test('§3.3 signSession/verifySession round-trips and the payload holds only accountId (plus iat)', () => {
  const token = signSession(SECRET_A, { accountId: 'account-xyz' })
  const result = verifySession(SECRET_A, token)
  assert.ok(result)
  assert.deepEqual(Object.keys(result).sort(), ['accountId'])
  assert.equal(result.accountId, 'account-xyz')
})

test('§3.3 a session cookie older than 7 days (SESSION_MAX_AGE_MS) is rejected server-side even with a valid signature', () => {
  const token = signSession(SECRET_A, { accountId: 'account-xyz' })
  const justOverAWeekLater = Date.now() + SESSION_MAX_AGE_MS + 1000
  const result = verifySession(SECRET_A, token, justOverAWeekLater)
  assert.equal(result, null)
})

test('§3.3 verifySession rejects a foreign secret and a tampered token the same way it rejects garbage', () => {
  const token = signSession(SECRET_A, { accountId: 'account-xyz' })
  assert.equal(verifySession(SECRET_B, token), null)
  assert.equal(verifySession(SECRET_A, token + 'x'), null)
  assert.equal(verifySession(SECRET_A, 'garbage'), null)
})
