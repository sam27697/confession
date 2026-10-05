# Week 21 - a login can only send you back into this app

*Frozen 2026-10-05 21:3x +04 before any code. Every claim in §0 was measured
tonight against production, staging, Node's URL parser or the installed Next
source.*

## §0 What was measured

### §0.1 The guard

Every login path ends in one function, `sanitizeNextDestination` in
`app/_lib/login-flow.ts`:

```ts
destination.startsWith('/') &&
!destination.startsWith('//') &&
!destination.includes(':')
```

It is called when `?next=` is stored (`/auth/google/start`,
`/auth/facebook/start`, `/auth/dev`), when the stored cookie is read back
(`takeRememberedDestination`), and right before the returning-user redirect in
`resolveLoginAndRedirect`. Fixing it fixes all of them.

### §0.2 Production accepts a backslash and a tab

```
GET https://masaraha.provefair.app/auth/google/start?next=/%5Cevil.example
302, set-cookie: after_login=%2F%5Cevil.example

GET https://masaraha.provefair.app/auth/google/start?next=/%09/evil.example
302, set-cookie: after_login=%2F%09%2Fevil.example
```

Both values passed the guard. Staging, the same through `/auth/dev` and the
terms screen: the server action answered
`x-action-redirect: /\evil.example;push`.

### §0.3 Where those values go

WHATWG URL parsing, which is what a browser does with a relative `Location`,
read in Node 22 tonight against `https://masaraha.provefair.app`:

| value | resolves to |
|---|---|
| `/\evil.example` | `https://evil.example/` |
| `/\/evil.example` | `https://evil.example/` |
| `/<TAB>/evil.example` | `https://evil.example/` |
| `/<LF>/evil.example` | `https://evil.example/` |
| `/c/abc` | `https://masaraha.provefair.app/c/abc` |

A browser treats `\` as `/` in an http(s) URL and strips tab, CR and LF before
parsing, so `/\x` and `/<TAB>/x` are `//x`, the protocol-relative form the
guard was written to refuse.

### §0.4 Which path actually leaves the site

- **Returning user (the live hole).** `resolveLoginAndRedirect` runs inside
  the OAuth callback, a GET route handler, and calls `redirect(target)`.
  Next 15.5.24, `node_modules/next/dist/server/route-modules/app-route/module.js`
  around line 426, turns that into `new Headers({ Location: url })` with the
  string unchanged. The browser follows it. So a person who already has an
  account and taps
  `https://masaraha.provefair.app/auth/google/start?next=/%5Cevil.example`
  goes to Google's real consent screen on our real domain, comes back signed
  in, and is then sent to a host of the sender's choosing. That is the
  textbook phishing shape: the link is ours, the login is real, the page after
  it is not.
- **New user, through the terms screen.** Not exploitable tonight, and the
  reason is not ours. Driven on staging with a headless browser: the server
  action sent `/\evil.example`, Next's client router landed on `/` and then
  `/inbox`, and no request left for `evil.example`. That is framework
  behaviour this app does not control and the guard must not rely on it.
- Not reproduced end to end: the returning-user hop needs a real Google
  account with a real account row on production, and no session here holds
  one. That hop rests on the Next source quoted above plus the parser table
  in §0.3, both read tonight.

### §0.5 A second, smaller defect in the same function

`new Headers({ Location })` throws on a value with CR, LF or any character
above U+00FF. A returning user whose `next` carried one of those would get a
500 from the callback instead of a login. Measured in Node: `/\n/x` and a
value containing U+3000 both throw; `/\u000b/x` and `/ /x` do not.

### §0.6 Dot segments

Parsing a path also resolves `.` and `..`, and that can manufacture the very
prefix the guard refuses:

| value | parsed pathname |
|---|---|
| `/.//evil.example` | `//evil.example` |
| `/%2e//evil.example` | `//evil.example` |
| `/c/..//evil.example` | `//evil.example` |

So any fix that parses and then returns the parsed path has to check the
result again, not only the input.

## §1 The change

1. `src/destination.ts`, framework-free (no `next/*`, no `env`), exports
   `DEFAULT_DESTINATION = '/inbox'` and `sanitizeNextDestination(value)`.
2. The rules, in order. Anything that fails one returns `/inbox`.
   1. The value is a string.
   2. It starts with `/` and not with `//`.
   3. It contains no `:` (kept from the old guard, unchanged).
   4. It contains no `\` and no character in U+0000..U+001F or U+007F.
   5. Parsed with `new URL(value, <a fixed sentinel origin>)` it does not
      throw, and its origin is the sentinel origin.
   6. The returned value is the parsed `pathname + search + hash`, which is
      ASCII by construction (the parser percent-encodes everything else).
   7. That returned value itself starts with `/` and not with `//`.
3. `app/_lib/login-flow.ts` imports `sanitizeNextDestination` from
   `src/destination.ts`, re-exports it under the same name, and every call
   site keeps calling it by that name. Nothing else in the login flow changes:
   no route, cookie name, cookie option, redirect target or detour.
4. Destinations that worked before keep working byte for byte: `/c/<slug>`,
   `/c/<slug>?x=1`, `/inbox`, `/sent`, `/offer/<id>`.

## §2 Rejected alternatives

- **Add `\` to the old `includes` list and stop there.** Closes tonight's two
  values and leaves the next one: the guard would still be a list of strings
  that happen to be dangerous, checked against a parser it does not run.
- **Allowlist the destinations (`/c/*`, `/inbox`, `/sent`).** Safest on paper.
  Rejected because `next` is also how a person comes back to an offer or the
  account page, and each new screen would have to remember to add itself; a
  forgotten entry fails silently into `/inbox`, which is the exact defect
  week 15 §2.3 was written to remove.
- **Return an absolute URL on `env.appOrigin`.** Correct, but it pulls `env`
  into the function and every test of it, and it changes the stored cookie
  format for anyone mid-login during the deploy. The sentinel-origin parse
  gives the same guarantee with no configuration.
- **Rely on Next's client router**, which already lands on `/` for the new
  user path (§0.4). It does nothing for the GET route handler, and it is not
  ours to keep.

## §3 What this does not do

- It does not touch `/auth/*/callback` beyond what the shared function
  already does, and it does not change OAuth `state` handling.
- It does not log anything new. The rejected value is not written anywhere.

## §4 Acceptance (written by a different author, from this file alone)

Tests live in `test/71-next-destination.test.ts` and import
`sanitizeNextDestination` from `src/destination.ts`. Each test name starts
with the item it proves.

1. `/\evil.example` returns `/inbox`.
2. `/\/evil.example` and `\\evil.example` return `/inbox`.
3. Tab, CR, LF, NUL and DEL anywhere in the value return `/inbox` (at least
   `/<TAB>/evil.example`, `/<LF>/evil.example`, `/<CR>/evil.example`,
   `/c/a<NUL>b`, `/c/a<DEL>b`).
4. The dot-segment rows of §0.6 return `/inbox`, not `//evil.example`.
5. The old refusals still hold: `https://evil.example/x`, `//evil.example`,
   `javascript:alert(1)`, `/c/a:b`, `''`, `null`, `undefined`, a number.
6. Destinations that worked before return unchanged: `/c/abc`,
   `/c/abc?x=1#y`, `/inbox`, `/sent`, `/offer/123`, `/account/delete`.
7. Every value the function returns, across all inputs in this file, passes
   `new Headers({ Location: value })` without throwing, and
   `new URL(value, 'https://masaraha.provefair.app').origin` equals
   `https://masaraha.provefair.app`.
8. A path with a non-ASCII character (`/c/abc?q=` followed by Arabic text)
   returns a percent-encoded, same-origin value and not `/inbox`.
9. `src/destination.ts` imports nothing from `next/*` and nothing that reads
   the environment.
10. `app/_lib/login-flow.ts` still exports `sanitizeNextDestination`, imports
    it from `src/destination`, and no longer defines its own.
11. `test/23-navigation-continuity.test.ts` and
    `test/64-service-softening.test.ts` run unchanged and pass.

Each of items 1 to 4 must be red against `main` at `2577948`.

## §5 Deploy and verification

Staging first, then production from the same tarball. From outside, on both:
`/auth/google/start?next=/%5Cevil.example` and `?next=/%09/evil.example` must
set no `after_login` cookie (the default needs none), `?next=/c/abc` must
still set `after_login=%2Fc%2Fabc`, and the routes week 20 listed keep their
codes. Logs re-measured after the drive.
