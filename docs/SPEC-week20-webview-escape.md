# Week 20 - every embedded browser Google refuses gets the way out

*Frozen 2026-10-02 21:3x +04 before any code. Every claim in §0 was measured
tonight against production or read off Google's own pages.*

## §0 What was measured

### §0.1 The product's only public door is Google, and Google refuses webviews

Facebook login is off in production on purpose until Meta publishes the app,
so `/auth/google/start` is the only way a stranger can get an account, and an
account is required to send (the identity model, `STACK.md`).

Google, Developers Blog, "Upcoming security changes to Google's OAuth 2.0
authorization endpoint in embedded webviews" (2021-06), read 2026-10-02:

> "Embedded webviews implementing or extending Android WebView do not comply
> with Google's secure browser policy"
>
> "Embedded webviews implementing or extending WKWebView, or the deprecated
> UIWebView, do not comply with Google's secure browser policy"
>
> "All embedded webviews will be blocked starting on September 30, 2021."
>
> "An implementation affected by the planned changes will see a
> `disallowed_useragent` error when loading Google's OAuth 2.0 Authorization
> Endpoint"

The rule is the engine, not the app's name. Any app that opens our link in its
own WebView or WKWebView sends the visitor to a Google error page.

### §0.2 What the product recognises today

`src/inapp.ts` decides by a list of twelve app names (`FBAN`, `FBAV`,
`FB_IAB`, `Instagram`, `Line/`, `MicroMessenger`, `TikTok`, `musical_ly`,
`Snapchat`, `Twitter`, `Pinterest`, `KAKAOTALK`). Driven on production tonight
with a headless browser at 390x844, `/?next=/c/zzzz`:

| user agent | way out shown | Google button shown |
|---|---|---|
| Instagram, Android | yes, `intent://...` | no |
| Facebook, iOS | yes, `x-safari-https://...` | no |
| LinkedIn, iOS (`[LinkedInApp]`, no `Safari/`) | **no** | yes |
| any Android app WebView not on the list (`; wv)`) | **no** | yes |
| Chrome, Android | no | yes |
| Safari, iOS | no | yes |

The two bold rows are visitors who press the Google button and land on
`disallowed_useragent`. That covers every app not on the list, including the
in-app browser Telegram has shipped on both platforms since 2024, which matters
for an Arabic-speaking audience that shares links in Telegram and WhatsApp
groups as much as in stories.

**Not measured, and said so:** a headless Chromium with a spoofed user agent
is still Chromium, so Google renders its sign-in page for every row above. The
refusal itself cannot be reproduced from this box; the blocked rows rest on
Google's quoted policy, not on a screenshot of the error.

### §0.3 The two engine signatures

- **Android WebView** carries the token `wv` as the last element of the
  parenthesised platform group: `(Linux; Android 14; SM-S918B Build/UP1A...; wv)`.
  Chrome, Samsung Internet, Firefox and Chrome Custom Tabs do not. The Android
  developer reference pages fetched tonight do not print the format; the
  token is taken from the user agents real Instagram and Facebook Android
  builds send.
- **iOS WKWebView** sends an iPhone/iPad/iPod user agent with `AppleWebKit`
  and **no `Safari/` token**. Safari, `SFSafariViewController` (which Google
  allows), Chrome (`CriOS`), Firefox (`FxiOS`), Edge (`EdgiOS`), DuckDuckGo and
  the Google app (`GSA`) all carry `Safari/`.

## §1 The change

`isInAppBrowser(userAgent)` in `src/inapp.ts` returns `true` when ANY of:

1. one of the existing named markers appears (unchanged);
2. the user agent contains the literal `; wv)` (Android WebView);
3. `detectPlatform(userAgent) === 'ios'`, the user agent contains
   `AppleWebKit`, and it does **not** contain `Safari/` (WKWebView).

Nothing else changes: `detectPlatform`, `escapeUrl` and `OpenInBrowser.tsx`
keep their behaviour, so a generic Android WebView gets the `intent://` escape
and a generic iOS WKWebView gets `x-safari-https://`, plus the copy-link button
and the "try here anyway" link that are already there.

## §2 Rejected alternatives

- **Add LinkedIn and Telegram to the name list.** Rejected: it fixes two rows
  and leaves the next app broken. Google blocks by engine, so the check should
  read the engine.
- **Detect on the server and hide the Google button there.** Rejected: the
  page would differ by user agent at render time, the escape needs
  `window.location.href`, and the component was deliberately written to decide
  in an effect (its header comment). Nothing about this slice needs the server.
- **Read `X-Requested-With` (Android WebView sends the host app's package
  name).** Rejected: it is a request header the client component cannot see,
  and reading it on the server would mean logging-adjacent handling of a
  per-visitor app identifier, which is the kind of data this product promised
  not to keep (`STACK.md`, week 18).
- **Match `iPad` desktop-mode WKWebView (`Macintosh` without `Safari/`).**
  Rejected for now: a Mac app's WKWebView looks the same, and a false positive
  tells someone who may already be in a browser to open a browser. That row
  stays a false negative and is named here.

## §3 Known false positives

- An iOS "Add to Home Screen" web clip opened in standalone mode can drop
  `Safari/`. This app sets no `apple-mobile-web-app-capable` meta and ships no
  manifest (checked tonight), so a home-screen icon opens in Safari. If that
  ever changes, the "try here anyway" link is the way through.

## §4 Acceptance (written by a different author, from this file alone)

New file `test/70-webview-escape.test.ts`. `test/65-share-and-inapp.test.ts`
is not edited.

1. Every fixture in `test/65` keeps its verdict (the suite proves this by
   running; item 1 needs no new code).
2. A generic Android WebView user agent with no named marker, of the shape in
   §0.3, is in-app.
3. LinkedIn on Android (`LinkedInApp` with `; wv)`) is in-app.
4. LinkedIn on iOS (`[LinkedInApp]`, no `Safari/`) is in-app.
5. A bare iPhone WKWebView user agent (`AppleWebKit/605.1.15 (KHTML, like
   Gecko) Mobile/15E148`, nothing after) is in-app; so is the iPad form.
6. None of these is in-app: Chrome Android, Samsung Internet, Firefox
   Android, Safari iOS, Chrome iOS (`CriOS`), Firefox iOS (`FxiOS`), Edge iOS
   (`EdgiOS`), DuckDuckGo iOS, the Google app on iOS (`GSA`, with `Safari/`),
   Safari on iPad in desktop mode (`Macintosh` with `Safari/`), desktop
   Chrome, desktop Safari, desktop Firefox, and the empty string.
7. A desktop Mac user agent with `AppleWebKit` and no `Safari/` is NOT
   in-app (§2, last bullet: the rule is iOS-only).
8. `wv` anywhere other than as `; wv)` does not count: an Android Chrome user
   agent whose model or build string contains the letters `wv` (for example
   `Build/QWV1.210` or a model `Xwv5`) is not in-app.
9. `Safari` without the slash does not count: an iPhone WKWebView user agent
   whose only mention of the word is an app token with no slash after it (for
   example ending in `MySafari 3`) stays in-app.
10. For the generic Android user agent of item 2, `detectPlatform` is
    `android` and `escapeUrl('https://masaraha.provefair.app/?next=/c/abc',
    'android')` starts with `intent://masaraha.provefair.app/`; for the iPhone
    user agent of item 5, `detectPlatform` is `ios` and the escape is
    `x-safari-https://masaraha.provefair.app/?next=/c/abc`.

## §5 Deploy and verification

Staging first, verified from outside with `bin/asam.sh check`, then production
from the same tarball. After deploy, the headless drive in §0.2 is repeated on
production and every row must show the way out exactly where §1 says. Logs on
both web containers are read after the drive: no user agent, no slug, no IP
beyond Next's own listen banner.
