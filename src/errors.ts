// src/errors.ts
//
// Typed errors for the send path and the reveal state machine (spec §2:
// "each rejection is a distinct typed error"). Deliberately NOT used for the
// blocked-sender case in sendConfession: that path returns success and
// writes nothing, because a typed error there would tell a blocked sender
// he is blocked (spec §2 sendConfession).

export class LinkNotFoundError extends Error {
  constructor(slug: string) {
    super(`no link with slug ${JSON.stringify(slug)}`)
    this.name = 'LinkNotFoundError'
  }
}

export class LinkDisabledError extends Error {
  constructor(slug: string) {
    super(`link ${JSON.stringify(slug)} is disabled (terms clause 6)`)
    this.name = 'LinkDisabledError'
  }
}

export class SenderAccountDisabledError extends Error {
  constructor() {
    super('sender account is disabled (terms clause 4)')
    this.name = 'SenderAccountDisabledError'
  }
}

export class PerLinkRateLimitExceededError extends Error {
  constructor(limit: number) {
    super(`more than ${limit} sends to this link in the current hour`)
    this.name = 'PerLinkRateLimitExceededError'
  }
}

export class PerAccountRateLimitExceededError extends Error {
  constructor(limit: number) {
    super(`more than ${limit} sends by this account today`)
    this.name = 'PerAccountRateLimitExceededError'
  }
}

export class ViewerNotLinkOwnerError extends Error {
  constructor() {
    super('viewer does not own this link')
    this.name = 'ViewerNotLinkOwnerError'
  }
}

export class RevealOfferNotFoundError extends Error {
  constructor(offerId: string) {
    super(`no reveal offer ${offerId}`)
    this.name = 'RevealOfferNotFoundError'
  }
}

export class ConfessionNotFoundError extends Error {
  constructor(confessionId: string) {
    super(`no confession ${confessionId}`)
    this.name = 'ConfessionNotFoundError'
  }
}

// Raised when a caller acts on an offer/confession that is not theirs —
// e.g. accepting an offer whose confession's sender_account_id does not
// match the caller (spec §4.4 test 18: "Accepting an offer on someone
// else's confession raises").
export class NotYourConfessionError extends Error {
  constructor() {
    super('this confession does not belong to the caller')
    this.name = 'NotYourConfessionError'
  }
}

export class OfferNotPendingError extends Error {
  constructor(offerId: string) {
    super(`reveal offer ${offerId} is not pending`)
    this.name = 'OfferNotPendingError'
  }
}

// Terms clause 5 ("this service is for ages 18 and over") is not optional —
// createAccountWithTerms refuses to write anything for a caller who did not
// attest (spec §4.2).
export class AgeAttestationRequiredError extends Error {
  constructor() {
    super('age_attested_18 must be true — terms clause 5')
    this.name = 'AgeAttestationRequiredError'
  }
}
