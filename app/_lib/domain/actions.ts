// Re-export point for src/actions.ts. sendConfession / openRevealOffer /
// acceptRevealOffer / declineRevealOffer already existed in week 2.
// blockSenderOfConfession / reportConfession / hideConfession are the spec
// §4.2 extension builder A adds this week.
export {
  sendConfession,
  openRevealOffer,
  acceptRevealOffer,
  declineRevealOffer,
  blockSenderOfConfession,
  reportConfession,
  hideConfession,
} from '../../../src/actions.js'
