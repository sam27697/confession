// Re-export point for src/views.ts. getInboxForRecipient and
// getPendingOfferForSender already existed in week 2. getSentForSender is
// the spec §4.2 extension builder A adds this week — its pending variant
// must never carry the recipient's staked answer (spec §4.2, §5.3).
export { getInboxForRecipient, getPendingOfferForSender, getSentForSender } from '../../../src/views.js'
export type { RecipientConfession, RecipientReveal, PendingOfferForSender, SentConfession } from '../../../src/views.js'
