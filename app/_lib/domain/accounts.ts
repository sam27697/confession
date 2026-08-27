// Re-export point for builder A's src/accounts.ts (spec §4.2, frozen
// signatures).
export {
  findAccountByProvider,
  createAccountWithTerms,
  recordTermsReacceptance,
  getAccountById,
} from '../../../src/accounts.js'
