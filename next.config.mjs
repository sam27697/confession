/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Every import in this codebase writes the extension — `./session.js` for
  // `session.ts` — because src/ is also loaded directly by node through tsx
  // for the tests, with no bundler in the way. TypeScript resolves that
  // pairing on its own; webpack does not, and a build that typechecks clean
  // was still failing with "Can't resolve ./session.js". This teaches the
  // bundler the same pairing rather than dropping the extensions and making
  // the test path the odd one out.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    }
    return config
  },
}

export default nextConfig
