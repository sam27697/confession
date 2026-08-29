// src/admin-throttle.ts
//
// Process-local brute-force throttle for the admin login (spec §2.6), keyed
// on the username only -- never on a network address, a browser identifier
// or any other value read from the incoming request, per the build-enforced
// tripwire this project already has (spec §4.4). A login attempt is not an
// exception to that rule.
//
// Honest limitation: this is in-memory state on one process. It resets on a
// container restart and does not coordinate across replicas. There is one
// replica and no plan for a second. It raises the cost of an online guess
// against a strong password; it is not a defence against a distributed one,
// and scrypt is what actually carries that weight.

export const ADMIN_MAX_FAILURES = 5
export const ADMIN_LOCKOUT_MS = 15 * 60 * 1000

export type ThrottleState = Map<string, { failures: number; firstFailureMs: number; lockedUntilMs: number }>

export function createThrottle(): ThrottleState {
  return new Map()
}

export function isLockedOut(state: ThrottleState, username: string, nowMs: number = Date.now()): boolean {
  const entry = state.get(username)
  if (!entry) return false
  return nowMs < entry.lockedUntilMs
}

export function recordFailure(state: ThrottleState, username: string, nowMs: number = Date.now()): void {
  const entry = state.get(username) ?? { failures: 0, firstFailureMs: nowMs, lockedUntilMs: 0 }
  entry.failures += 1
  if (entry.failures >= ADMIN_MAX_FAILURES) {
    entry.lockedUntilMs = nowMs + ADMIN_LOCKOUT_MS
  }
  state.set(username, entry)
}

export function clearFailures(state: ThrottleState, username: string): void {
  state.delete(username)
}
