import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../src/env.js'

const BASE: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/confession',
  SESSION_SECRET: 'x'.repeat(32),
  APP_ORIGIN: 'https://stg.confession.fayad.app',
}

test('§2 ALLOW_DEV_LOGIN=1 with a production-looking APP_ORIGIN refuses to start', () => {
  assert.throws(() =>
    loadEnv({
      ...BASE,
      APP_ORIGIN: 'https://confession.fayad.app',
      ALLOW_DEV_LOGIN: '1',
    }),
  )
})

test('§2 ALLOW_DEV_LOGIN=1 is accepted on a staging-looking APP_ORIGIN (https://stg.*)', () => {
  const env = loadEnv({ ...BASE, APP_ORIGIN: 'https://stg.confession.fayad.app', ALLOW_DEV_LOGIN: '1' })
  assert.equal(env.allowDevLogin, true)
})

test('§2 ALLOW_DEV_LOGIN=1 is accepted on http://localhost', () => {
  const env = loadEnv({ ...BASE, APP_ORIGIN: 'http://localhost:3000', ALLOW_DEV_LOGIN: '1' })
  assert.equal(env.allowDevLogin, true)
})

test('§2 ALLOW_DEV_LOGIN unset is fine even with a production-looking APP_ORIGIN — the check only fires when the switch is on', () => {
  const env = loadEnv({ ...BASE, APP_ORIGIN: 'https://confession.fayad.app' })
  assert.equal(env.allowDevLogin, false)
})

test('§2 a near-miss origin (https://staging.example.com, no dot after stg) is still refused with ALLOW_DEV_LOGIN=1', () => {
  assert.throws(() => loadEnv({ ...BASE, APP_ORIGIN: 'https://staging.confession.fayad.app', ALLOW_DEV_LOGIN: '1' }))
})

test('§2 a missing required variable throws', () => {
  const { DATABASE_URL: _unused, ...rest } = BASE
  assert.throws(() => loadEnv(rest))
})

test('§2 SESSION_SECRET under 32 bytes throws', () => {
  assert.throws(() => loadEnv({ ...BASE, SESSION_SECRET: 'too-short' }))
})

test('§2 a blank required variable (whitespace only) is treated as missing', () => {
  assert.throws(() => loadEnv({ ...BASE, DATABASE_URL: '   ' }))
})

test('§2 FACEBOOK_APP_ID/SECRET are optional and default to null', () => {
  const env = loadEnv(BASE)
  assert.equal(env.facebookAppId, null)
  assert.equal(env.facebookAppSecret, null)
})

test('§2 PORT defaults to 3000 and rejects a non-positive-integer value', () => {
  assert.equal(loadEnv(BASE).port, 3000)
  assert.throws(() => loadEnv({ ...BASE, PORT: '0' }))
  assert.throws(() => loadEnv({ ...BASE, PORT: 'not-a-number' }))
})
