// Re-export point for src/google.ts, the twin of domain/facebook.ts. The
// scope string and the three endpoints each live in exactly one constant
// there; nothing is re-implemented here. The actual authorize / token /
// profile requests are made from the route handlers in app/auth/google/*,
// which is web-app scope, not domain scope.
export {
  GOOGLE_SCOPE,
  GOOGLE_AUTHORIZE_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
} from '../../../src/google.js'
