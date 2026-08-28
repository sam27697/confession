import { test } from 'node:test'
import assert from 'node:assert/strict'
import { robotsBody } from '../src/robots.js'

const PRODUCTION_ORIGIN = 'https://confession.fayad.app'
const STAGING_ORIGIN = 'https://stg.confession.fayad.app'

// §3: "Disallow: lines for /c/, /inbox, /sent, /offer/, /onboarding, /auth/"
const ALLOW_LIST_DISALLOWED_PATHS = ['/c/', '/inbox', '/sent', '/offer/', '/onboarding', '/auth/']

function lines(body: string): string[] {
  return body.split('\n').map((line) => line.trimEnd())
}

test('§3 the exact production origin returns the allow-list body with the six named Disallow paths', () => {
  const body = robotsBody(PRODUCTION_ORIGIN)
  const bodyLines = lines(body)
  assert.ok(bodyLines.includes('User-agent: *'), 'allow-list body must include a User-agent: * line')
  for (const p of ALLOW_LIST_DISALLOWED_PATHS) {
    assert.ok(bodyLines.includes(`Disallow: ${p}`), `allow-list body missing "Disallow: ${p}"`)
  }
})

test('§3 the production allow-list body does not contain a bare "Disallow: /" line', () => {
  const body = robotsBody(PRODUCTION_ORIGIN)
  assert.ok(!lines(body).includes('Disallow: /'), 'the production body must not close the whole site')
})

test('§3 the staging origin (https://stg.confession.fayad.app) returns the closed body', () => {
  const body = robotsBody(STAGING_ORIGIN)
  assert.ok(lines(body).includes('Disallow: /'), 'staging must get "Disallow: /"')
})

test('§3 http://localhost:3000 returns the closed body', () => {
  const body = robotsBody('http://localhost:3000')
  assert.ok(lines(body).includes('Disallow: /'))
})

test('§3 the Dockerfile build-time placeholder origin returns the closed body — an unevaluated route must not silently publish the open one', () => {
  // Per spec §3: "APP_ORIGIN at image-build time is the placeholder
  // http://localhost:3000 from the Dockerfile. If Next evaluates this route
  // at build time it bakes Disallow: / into the production image and
  // de-lists the real site." This is exactly the failure mode this test
  // exists to catch: the placeholder origin must never resolve to the
  // open, allow-list body.
  const DOCKERFILE_BUILD_TIME_APP_ORIGIN = 'http://localhost:3000'
  const body = robotsBody(DOCKERFILE_BUILD_TIME_APP_ORIGIN)
  const bodyLines = lines(body)
  assert.ok(bodyLines.includes('Disallow: /'), 'the build-time placeholder origin must get the closed body')
  for (const p of ALLOW_LIST_DISALLOWED_PATHS) {
    assert.ok(!bodyLines.includes(`Disallow: ${p}`), `build-time placeholder must not get the allow-list line for ${p}`)
  }
})

test('§3 default-deny matches the production origin exactly, not by prefix or substring', () => {
  const nearMisses = [
    'https://confession.fayad.app.evil.com', // production origin as a prefix of an attacker domain
    'https://confession.fayad.app/',          // trailing slash
    'https://stg.confession.fayad.app',       // the production hostname as a suffix of the staging one
    'http://confession.fayad.app',            // right host, wrong scheme
  ]
  for (const origin of nearMisses) {
    const body = robotsBody(origin)
    assert.ok(lines(body).includes('Disallow: /'), `${origin} must get the closed body, not the production allow-list`)
  }
})

test('§3 both the allow-list body and the closed body start with a "User-agent: *" line', () => {
  assert.equal(lines(robotsBody(PRODUCTION_ORIGIN))[0], 'User-agent: *')
  assert.equal(lines(robotsBody(STAGING_ORIGIN))[0], 'User-agent: *')
})
