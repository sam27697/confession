// Re-export point for src/errors.ts. Used only for `instanceof` checks so a
// route can tell a rate-limit rejection from a not-found from a generic
// failure — never to read `.message`, which can embed a link slug or an
// offer id (spec §1 rule 3).
export {
  LinkNotFoundError,
  LinkDisabledError,
  SenderAccountDisabledError,
  PerLinkRateLimitExceededError,
  PerAccountRateLimitExceededError,
  ViewerNotLinkOwnerError,
  RevealOfferNotFoundError,
  ConfessionNotFoundError,
  NotYourConfessionError,
  OfferNotPendingError,
  AccountNotFoundError,
  AccountAlreadyDeletedError,
} from '../../../src/errors.js'
