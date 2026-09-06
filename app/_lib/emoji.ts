// app/_lib/emoji.ts
//
// The app's entire emoji vocabulary, in one place.
//
// Spec section 0 banned emoji outright and acceptance item 7 enforced it.
// Section 9.9 reverses that on Sam's call: the audience is teenagers, and a
// state chip that reads «وصلت» in grey text is not the same product as one
// that reads «وصلت 📬». What does not change is the reason item 7 existed --
// an interface that accumulates a different glyph per edit ends up looking
// like a keyboard fell on it.
//
// So the rule moved rather than vanished: emoji are allowed, from THIS list
// and no other. Item 7 now reads the vocabulary out of this file and fails
// on any glyph under app/ that is not in it. Adding one is a deliberate edit
// here, which is the review step the old ban was standing in for.
//
// Two places stay clear of it, and item 7 still enforces both:
//   - src/*.ts, the domain layer. Business rules, database values and error
//     names are not decoration and are read by tests and logs.
//   - class names, form field names and element ids. An emoji in a `name=`
//     would change what the form submits, which spec section 0 forbids
//     outright and acceptance item 17 asserts against main.

/**
 * The state of a confession, as the recipient sees it in the inbox and the
 * sender sees it in /sent. One glyph per state of the machine, so the same
 * state always looks the same on both screens.
 */
export const STATE_EMOJI = {
  delivered: '📬',
  hidden: '🙈',
  reported: '🚩',
  pending: '⏳',
  resolved: '🔓',
  declined: '🙅',
  cancelled: '🚫',
} as const

/**
 * Actions. Only on the playful surfaces: sending, the mutual reveal, and
 * getting the link into circulation. Deliberately absent from
 * /account/delete and the admin screens, where spec section 3.7 says the
 * tone drops all playfulness and stays plain and factual.
 */
export const ACTION_EMOJI = {
  send: '🚀',
  reveal: '🔓',
  copyLink: '🔗',
  copied: '✅',
  storyCard: '✨',
} as const

/** Empty states and encouragement. */
export const MOOD_EMOJI = {
  emptyInbox: '💌',
  nothingSent: '🌱',
  sparkle: '✨',
  fire: '🔥',
  eyes: '👀',
  heart: '💜',
} as const
