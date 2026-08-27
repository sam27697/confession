// Re-export point for builder A's src/terms.ts. Spec §3.4: "The terms text
// in src/terms.ts is copied verbatim from BRIEF.md's revised draft — all six
// clauses, Arabic and English. It is not re-worded, not summarised." and
// "TERMS_VERSION = '2026-08-25.1', one constant in src/terms.ts."
export { TERMS_VERSION, TERMS_TEXT_AR, TERMS_TEXT_EN } from '../../../src/terms.js'
