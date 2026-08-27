// Re-export point for builder A's src/facebook.ts. Spec §3.1: "The scope
// string is public_profile and it appears in exactly one constant,
// FACEBOOK_SCOPE, in src/facebook.ts" and "Graph API version pinned in one
// constant." Nothing else is re-implemented here — the actual authorize /
// token / profile requests are made from the route handlers in
// app/auth/facebook/*, which is web-app scope, not domain scope.
export { FACEBOOK_SCOPE, GRAPH_API_VERSION } from '../../../src/facebook.js'
