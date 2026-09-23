/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Nobody reading a response needs to know which framework built it.
  poweredByHeader: false,

  // Week 15 §1 item 5. Referrer-Policy is `same-origin` and deliberately not
  // `no-referrer`: under `no-referrer` a browser sends `Origin: null` on a
  // POST, and Next refuses a Server Action whose Origin does not match the
  // host, which would break every form in the app. `same-origin` still keeps
  // a /c/ or /offer/ path, and the fact that someone came from this app at
  // all, away from every other site. frame-ancestors 'none' keeps the send
  // form and the delete-account form out of anybody else's iframe.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },

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
