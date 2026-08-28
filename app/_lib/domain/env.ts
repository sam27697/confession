// Re-export point for builder A's src/env.ts (spec §2: "All configuration
// comes from environment variables, read once at startup through a single
// module src/env.ts that validates and throws on a missing required value.
// No process.env reads scattered through the app.") The web app never reads
// process.env directly anywhere else; every route imports `env` from here.
//
// It is a lazy view over getEnv() rather than `export const env = getEnv()`,
// because a module-scope call would run during `next build`, where none of
// the required variables exist yet and a validation throw would fail the
// image build instead of the boot it is meant to guard.
import { getEnv, type Env } from '../../../src/env.js'

export const env: Env = new Proxy({} as Env, {
  get(_target, property: string | symbol) {
    return getEnv()[property as keyof Env]
  },
})

export { loadEnv, type Env } from '../../../src/env.js'
