#!/usr/bin/env node
//
// scripts/check-origins.mjs
//
// Probes every origin in src/origins.ts against the live internet and prints
// one line per entry (spec docs/SPEC-week16-origin-contract.md section 1.2).
//
// Run it from the repository root:
//
//   node scripts/check-origins.mjs
//
// Exit 0 only when every entry passes. Exit 1 otherwise, after printing all of
// them: stopping at the first failure hides the second. Exit 2 on any
// argument, since it takes none (spec section 5.1).
//
// This script holds no judgement of its own. It collects DNS and HTTP facts
// and hands them to judgeProbe in src/origins.ts, so every rule it enforces is
// reachable from a unit test with no network. It reads no .env, sends no
// credential and prints no secret.

import { resolve4, resolve6 } from 'node:dns/promises'

// The contract lives in a TypeScript module and this script is plain node.
// tsx is already a devDependency here and is what `npm test` runs on, so the
// loader is not a new thing to install. Its own register() is used rather
// than node:module's: passing 'tsx/esm' to the latter is the deprecated
// --loader path and tsx refuses it outright.
const { register } = await import('tsx/esm/api')
register()

const { ORIGINS, judgeProbe } = await import('../src/origins.ts')

const TIMEOUT_MS = 15_000

// Every origin is probed at the root. The path flag this script used to take
// proved a retired host preserved the path through its redirect, and since
// spec section 5 no retired host redirects. Refused loudly rather than ignored,
// so anything still passing it finds out.
const PROBE_PATH = '/'
const args = process.argv.slice(2)
if (args.length > 0) {
  console.error(`check-origins: takes no arguments, got: ${args.join(' ')}`)
  console.error('usage: node scripts/check-origins.mjs')
  process.exit(2)
}

function hostOf(origin) {
  return new URL(origin).hostname
}

async function resolves(hostname) {
  // A name counts as resolving if it answers either family. Asking for both
  // and accepting either is deliberate: this server publishes A and AAAA, and
  // a name with only one of them is reachable, not broken.
  const answers = await Promise.allSettled([resolve4(hostname), resolve6(hostname)])
  return answers.some((a) => a.status === 'fulfilled' && a.value.length > 0)
}

async function probe(origin, probePath) {
  const hostname = hostOf(origin)

  if (!(await resolves(hostname))) {
    return { dnsResolved: false, probePath }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${origin}${probePath}`, {
      // Not followed on purpose. A followed redirect reports the destination's
      // 200 and throws away the only two facts this check is about: which
      // status the retired host answered, and where it pointed.
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'user-agent': 'masaraha-origin-check' },
    })
    return {
      dnsResolved: true,
      probePath,
      status: response.status,
      location: response.headers.get('location'),
    }
  } catch (error) {
    // The name resolved and the request still failed: a refused connection, a
    // TLS handshake the proxy would not complete, a timeout. That is a real
    // failure and it is reported as one, with no status to show for it.
    return {
      dnsResolved: true,
      probePath,
      status: undefined,
      location: null,
      transportError: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timer)
  }
}

console.log(`check-origins: probing ${ORIGINS.length} origins at ${PROBE_PATH}`)
console.log('')

let failures = 0

for (const entry of ORIGINS) {
  const result = await probe(entry.origin, PROBE_PATH)
  const verdict = judgeProbe(entry, result)
  const mark = verdict.ok ? 'ok  ' : 'FAIL'
  const tail = result.transportError ? ` (${result.transportError})` : ''
  console.log(`${mark} ${entry.kind.padEnd(8)} ${verdict.reason}${tail}`)
  if (!verdict.ok) failures += 1
}

console.log('')

if (failures > 0) {
  console.log(`check-origins: ${failures} of ${ORIGINS.length} origins are not keeping the contract.`)
  console.log('A live origin that fails is an outage. A retired origin that fails has come back in DNS.')
  console.log('Neither is repaired by deleting its row from src/origins.ts.')
  process.exit(1)
}

console.log(`check-origins: all ${ORIGINS.length} origins are keeping the contract.`)
