// src/limits.ts
//
// Rate limiting is a plain per-account Postgres counter now that the
// HMAC/RAM-secret machinery is deleted, not ported (STACK.md, spec §1
// send_counters). Limits for v1, implemented as named constants, not magic
// numbers (spec §1 send_counters).

export const MAX_PER_LINK_PER_HOUR = 5
export const MAX_PER_ACCOUNT_PER_DAY = 30
