import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Resolved relative to this file so the test works from any cwd, per §2:
// "A standalone script, because it has to be testable off the box."
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/check-deploy-pairing.sh')

function run(args: string[]): { status: number | null; stderr: string } {
  const result = spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8' })
  return { status: result.status, stderr: result.stderr ?? '' }
}

const STAGING = { stack: 'confession', port: '8182', origin: 'https://stg.confession.fayad.app' }
const PROD = { stack: 'confession-prod', port: '8082', origin: 'https://confession.fayad.app' }

// §1 — the two legal rows of the table

test('§1 the staging row (confession, 8182, stg origin, ALLOW_DEV_LOGIN=1) exits 0', () => {
  const { status } = run([STAGING.stack, STAGING.port, STAGING.origin, '1'])
  assert.equal(status, 0)
})

test('§1 the staging row (confession, 8182, stg origin, ALLOW_DEV_LOGIN="") exits 0', () => {
  const { status } = run([STAGING.stack, STAGING.port, STAGING.origin, ''])
  assert.equal(status, 0)
})

test('§1 the production row (confession-prod, 8082, production origin, ALLOW_DEV_LOGIN="") exits 0', () => {
  const { status } = run([PROD.stack, PROD.port, PROD.origin, ''])
  assert.equal(status, 0)
})

// §2 — the named refusals, each isolated to a single mismatched field

test('§2 confession-prod on the staging port (8182) is refused, naming the port', () => {
  const { status, stderr } = run([PROD.stack, STAGING.port, PROD.origin, ''])
  assert.notEqual(status, 0)
  assert.match(stderr, /host_port|port/i, 'stderr must name the mismatched field')
})

test('§2 confession on the production port (8082) is refused, naming the port', () => {
  const { status, stderr } = run([STAGING.stack, PROD.port, STAGING.origin, ''])
  assert.notEqual(status, 0)
  assert.match(stderr, /host_port|port/i, 'stderr must name the mismatched field')
})

test('§2 confession-prod with a stg. origin is refused, naming the origin', () => {
  const { status, stderr } = run([PROD.stack, PROD.port, STAGING.origin, ''])
  assert.notEqual(status, 0)
  assert.match(stderr, /app_origin|origin/i, 'stderr must name the mismatched field')
})

test('§2 confession with the production origin is refused, naming the origin', () => {
  const { status, stderr } = run([STAGING.stack, STAGING.port, PROD.origin, ''])
  assert.notEqual(status, 0)
  assert.match(stderr, /app_origin|origin/i, 'stderr must name the mismatched field')
})

test('§2 confession-prod with ALLOW_DEV_LOGIN=1 is refused, naming the field — belt and braces alongside src/env.ts', () => {
  const { status, stderr } = run([PROD.stack, PROD.port, PROD.origin, '1'])
  assert.notEqual(status, 0)
  assert.match(stderr, /allow_dev_login|dev_login/i, 'stderr must name the mismatched field')
})

test('§2 an unknown STACK_NAME is refused, naming the stack', () => {
  const { status, stderr } = run(['confession-staging', STAGING.port, STAGING.origin, ''])
  assert.notEqual(status, 0)
  assert.match(stderr, /stack_name|stack/i, 'stderr must name the mismatched field')
})

// §2 — "an empty or missing argument in any position". STACK_NAME, HOST_PORT
// and APP_ORIGIN may never be empty in any row of the §1 table, so these
// three positions are unambiguous. ALLOW_DEV_LOGIN is, per spec, "the one
// field allowed to be empty" (its own legal-empty rows are covered above),
// so it is deliberately not included in this group.

test('§2 zero arguments is refused', () => {
  const { status } = run([])
  assert.notEqual(status, 0)
})

test('§2 an empty STACK_NAME (first position) is refused', () => {
  const { status } = run(['', STAGING.port, STAGING.origin, ''])
  assert.notEqual(status, 0)
})

test('§2 an empty HOST_PORT (second position) is refused', () => {
  const { status } = run([STAGING.stack, '', STAGING.origin, ''])
  assert.notEqual(status, 0)
})

test('§2 an empty APP_ORIGIN (third position) is refused', () => {
  const { status } = run([STAGING.stack, STAGING.port, '', ''])
  assert.notEqual(status, 0)
})

test('§2 a partial argument list (missing HOST_PORT, APP_ORIGIN and ALLOW_DEV_LOGIN) is refused', () => {
  const { status } = run([STAGING.stack])
  assert.notEqual(status, 0)
})

test('§2 a failing case writes a non-empty explanation to stderr', () => {
  const { stderr } = run([PROD.stack, STAGING.port, PROD.origin, ''])
  assert.ok(stderr.trim().length > 0, 'a refusal must explain itself on stderr, not fail silently')
})
