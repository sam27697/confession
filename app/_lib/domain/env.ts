// Re-export point for builder A's src/env.ts (spec §2: "All configuration
// comes from environment variables, read once at startup through a single
// module src/env.ts that validates and throws on a missing required value.
// No process.env reads scattered through the app.") The web app never reads
// process.env directly anywhere else; every route imports `env` from here.
export { env } from '../../../src/env.js'
