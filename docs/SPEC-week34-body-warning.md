# Week 34: a body over 10 MB no longer puts its URL in the log

Frozen 2026-11-04, before the change to `package.json` and the new script
were written and before the test was written.

## §0 What is wrong, measured

Week 33 §6.1: any POST that reaches the middleware with a body over 10 MB
makes Next write

    Request body exceeded 10MB for <path and query>. Only the first 10MB ...

to the container log. The sender chooses the path and the query, so the
sender chooses text in our log, and the line carries a timestamp. Pointed at
`/c/<slug>` it pairs a recipient's link with a time. Week 18's promise that
nobody on the internet can write text of their choosing into this product's
log has been false for that case since 2026-09-28.

Re-measured tonight, before any change:

- **Staging, from outside, 2026-11-04 21:4x:** `POST
  https://stg.masaraha.provefair.app/?w34canary-cap`, `Next-Action: zz`,
  11 000 000 bytes of `text/plain`. Answer 404. `docker logs --since 10m
  confession-web` holds
  `Request body exceeded 10MB for /?w34canary-cap. Only the first 10MB ...`.
  The same request with 2 MB left no line.
- **Locally, `main` (`22b0af7`) built and run from `.next/standalone`:** the
  same 11 MB request to `/?w34canary-local0` writes the same line with the
  canary in it.

Where it comes from: `getCloneableBody().cloneBodyStream()` in
`next/dist/server/body-streams.js`, which copies the body for the middleware.
When the copy passes the limit it builds
``const urlInfo = readable.url ? ` for ${readable.url}` : ''`` and puts it in
a `console.warn`. That runs before middleware code, so no middleware change
reaches it (week 33 §6.1). The same text exists in two more copies in the
package: `dist/esm/server/body-streams.js` and the bundled
`dist/compiled/next-server/server.runtime.prod.js`. The standalone output
traces only `dist/server/body-streams.js`.

Other Next warnings that carry `req.url` (`API resolved without sending a
response`, `API response ... exceeds`, the revalidate messages in
`render.js`) belong to the pages router and to `pages/api`. This app has no
`pages/` directory; `.next/server/pages-manifest.json` lists only `/_app`,
`/_error` and `/_document`. None of them is reachable by a request here.

## §1 The change

### §1.1 `scripts/patch-next-body-warning.mjs`

Run with no argument, it patches the installed Next under
`node_modules/next/dist`:

1. Every `.js` file under that directory (not `.map`) whose text contains
   `Request body exceeded` is a target.
2. In each target the url part is replaced: an assignment of the form
   ``<name> = <obj>.url ? ` for ${<obj>.url}` : ''`` (either quote style,
   any spacing, the minified form included) becomes `<name> = ''`. The rest
   of the warning stays: the line still says the body was over the limit,
   so the event is not hidden, it only stops carrying the URL.
3. A target with exactly one such assignment is patched and written back.
   A target with none that already reads as patched (the warning text is
   there and no ``${<obj>.url}`` template sits in the same statement) is left
   as it is, so a second run changes nothing and exits 0.
4. Anything else fails the run with exit 1 and names the file: no target at
   all, more than one assignment in a target, or a target whose warning
   still carries a url some other way. A Next upgrade that rewrites this
   code must stop the build, not ship the old leak quietly.
5. It prints one line per target, `patched` or `already patched`, and a
   count.

Run as `--check <dir>`, it changes nothing. It walks `<dir>` (following
nothing outside it), finds every `.js` file containing
`Request body exceeded`, and fails with exit 1, naming the file, if any of
them still has the url form from §1.1 item 2. It also fails if it finds no
such file at all, since a check that inspected nothing proves nothing. Exit
0 prints the count it inspected.

### §1.2 `package.json`

- `"prebuild": "node scripts/patch-next-body-warning.mjs"`
- `"postbuild": "node scripts/patch-next-body-warning.mjs --check .next/standalone"`

npm runs both around `npm run build`, which is what the `Dockerfile`'s build
stage already calls. A failure in either fails the image build, and
`deploy.sh` stops before anything is swapped (week 32's order). The
`Dockerfile` itself does not change.

### §1.3 What stays

- The 10 MB limit, the truncation, and the rest of Next's behaviour for a
  large body are unchanged. Only the text of one warning changes.
- `next` stays at the version in `package-lock.json`. No new dependency.

## §2 Rejected

- **Raise `experimental.middlewareClientMaxBodySize`.** Moves the threshold
  and buffers more per request; the line still comes with the URL above it.
- **Skip the middleware for a large `Content-Length` with a matcher
  `missing` entry.** A chunked body has no `Content-Length`, so the sender
  picks whether the skip applies, and the skipped request also skips week 18
  and week 33's gate.
- **Filter the container's stderr in the entrypoint.** Puts a pipe between
  the server and its log, changes PID 1 and signal handling, and a filter
  that drops lines by pattern is a filter that can drop a real error.
- **`patch-package` or a fork of Next.** A new dependency for one line, and
  a patch file fails less loudly on a version change than §1.1 item 4.
- **Wait for the reverse proxy cap only.** It is still wanted (§3) and it is
  root's. The log promise is this product's, and it can be kept from inside
  the image tonight.

## §3 Residuals, stated

- **A body cap at the reverse proxy is still wanted.** Without it a client
  can still send a body of any size; Next reads up to 10 MB of it into the
  middleware copy and the rest is streamed and dropped. That is a memory and
  bandwidth question, not a log one, and it is root's change on the proxy.
- **The warning line still exists, without the URL.** Its time tells a
  reader that someone sent a large body at that minute. It carries nothing
  the sender chose.
- **The `esm` and `compiled` copies are patched although nothing traced
  into the image loads them.** They are patched so that a change in which
  copy Next loads does not bring the url back.

## §4 What must still work, measured on staging after deploy

- The 11 MB request of §0 answers as before (404) and the log line, if it
  appears, has no path and no query in it.
- A 2 MB request leaves no line, as before.
- Week 33's 36-request malformed sweep still answers 400 on every row.
- Dev login, terms, a send with JS on and off, the inbox and the link switch,
  as week 33's drive.

## §5 Acceptance (written by a different author, from this spec only)

A new test file under `test/` that, without network and without a database:

1. Runs the patch script against a scratch copy shaped like
   `node_modules/next/dist` (made from the real installed files, read only)
   and shows each of the three real copies patched exactly once, the rest of
   each file byte-identical, and the warning text still present.
2. Runs it a second time on the result: exit 0, nothing changed.
3. Shows exit 1, with the file named, for: no target; a target with two url
   assignments; a target whose warning carries the url by another form.
4. Shows `--check` exit 1 on an unpatched copy, exit 1 on a directory with no
   target, exit 0 on a patched one.
5. Shows `prebuild` and `postbuild` in `package.json` are exactly §1.2.
6. Loads the patched `body-streams.js` from the scratch copy, feeds
   `cloneBodyStream()` a stream with a `url` carrying a canary and more than
   the limit, captures `console.warn`, and shows one line, with the warning
   text, without the canary.

## §6 Amendment, 2026-11-04 22:3x, after the first test run

**What was wrong with §1.2.** `prebuild` patched `node_modules/next/dist` in
place. After any local `npm run build`, the installed Next is no longer the
one `package-lock.json` describes, and §5's tests, which copy "the real
installed files" as the unpatched original, went red on 5 of 15 (1, 4a, 4d,
4e, 6; test 6's own control said `the unpatched copy should carry the
canary`). The tests were right: the installed tree had been changed under
them. Measured: the same file passes 15 of 15 in the test author's tree,
where no build ran, against the same script.

**The change.** Nothing touches `node_modules`. The patch runs on the copy
that ships, after the build:

- The script takes an optional directory: `patch-next-body-warning.mjs
  <dir>` patches every target under `<dir>` by §1.1's rules; with no
  argument it patches `node_modules/next/dist` as before (§1.1 is otherwise
  unchanged, and §5's tests of it stand).
- `package.json`: no `prebuild`.
  `"postbuild": "node scripts/patch-next-body-warning.mjs .next/standalone && node scripts/patch-next-body-warning.mjs --check .next/standalone"`.
  The standalone tree holds copies made by the trace, not links (measured:
  different inodes), so this leaves `node_modules` byte-identical to the
  lockfile's package.
- §3's third residual changes: only the copies the trace put into
  `.next/standalone` are patched (tonight, `dist/server/body-streams.js`).
  If a later Next loads another copy, the trace carries that one in, and
  the patch either rewrites it or fails the build on it.

**Acceptance, added to §5 (same author):** item 5 becomes this section's
strings; a new item shows `<dir>` mode patches a scratch tree laid out like
`.next/standalone` and leaves a sibling `node_modules/next/dist` untouched.

## §7 Amendment, 2026-11-04 22:5x, after the independent review (FAIL)

The review measured the patched build and confirmed §1 to §6 on the
artifact: the standalone server loads exactly one `body-streams.js`, the
patched one, and three 11 MB requests (plain, multipart, chunked, canaries in
path, query and a header) leave the bare warning and no canary. It failed
the slice on two things this spec had implied and not measured: that the
log promise of week 18 is restored. It is not, and two more requests break
it. Re-measured by the build on a local standalone build before this
section was written:

- **F1, `/_next/image`.** The app uses no `next/image` and sets no `images`
  config, so Next's optimizer endpoint is live. `GET
  /_next/image?url=%2Fc%2Fw34canary-img1%0AFORGED&w=640&q=75` answered 400
  and wrote `The requested resource isn't a valid image for /c/w34canary-img1`
  followed by a second line `FORGED received null`: the sender chose the
  text and, through `%0A`, forged a line. The optimizer also fetched
  `/c/<slug>` internally, which rendered the page (with the database down
  locally, the failed query printed the slug as a parameter).
- **F2, a foreign `Origin` on an action.** `POST /c/abc` with a well-formed
  `Next-Action`, `Content-Type: text/plain;charset=UTF-8`, body `[]` and
  `Origin: http://w34canary-origin2.example/c/x` answered 500 and wrote
  `` `x-forwarded-host` header with value `127.0.0.1:3934` does not match
  `origin` header with value `w34canary-origin2.example` ... `` Next's
  `limitUntrustedHeaderValueForLogs` caps the length; the host part of a
  parsed URL cannot hold a newline. No account or real action id is needed.

### §7.1 Changes

1. **`next.config.mjs`: `images: { unoptimized: true }`.** Next then answers
   `/_next/image` with its 404 page (`next-server.js`
   `handleNextImageRequest`: `loader !== 'default' || unoptimized` renders
   404) and never fetches or names the url. Nothing in `app/` or `src/` uses
   `next/image`.
2. **`src/origin-gate.ts`, called first in `middleware.ts`.** For a request
   the middleware sees (an action, or a multipart body) with method `POST`
   and an `Origin` header: parse it with `new URL`; if that throws, or its
   `host` differs from the expected host, answer a bare **403** before Next's
   action handler runs. The expected host is Next's own rule
   (`action-handler.js` `parseHostHeader`): the first comma-separated value
   of `x-forwarded-host`, trimmed, else `host`. No `Origin` header passes
   through unchanged (Next's own warning for that case is a fixed string).
   The comparison is exact and case-sensitive, as Next's is; the app sets no
   `serverActions.allowedOrigins`, so no other origin is acceptable to Next
   either. The 403 writes nothing.
3. **`scripts/patch-next-body-warning.mjs`, F3 of the review.** The url
   detector also catches `?.url`, `.originalUrl`, `['url']` and a bare
   `${url}` template within the window, so those shapes fail the build
   instead of being reported as already patched. It stays a tripwire for
   the shapes it knows: a future warning that interpolates a header value
   would pass it. That is stated, not claimed away.

### §7.2 Residuals

- **Not every Next log line is closed by this slice.** The claim this slice
  makes is narrow: the three requests measured above (a body over 10 MB, the
  image endpoint, a foreign Origin) no longer write sender text. Week 18's
  wider sentence remains a promise to keep measuring, not a proven property.
- **A page render that fails on the database logs the query parameters**
  (review F6), slug included. It needs the database to be down; it is not a
  request a sender can cause on a healthy server.
- **The 10 MB proxy cap** (§3) is still wanted for memory and bandwidth.

### §7.3 Acceptance, added to §5 (same author)

7. With `next.config.mjs` loaded, `images.unoptimized` is `true`; no file
   under `app/` or `src/` imports `next/image`.
8. `src/origin-gate.ts` as a unit: a matching Origin passes; a mismatched
   one, an unparseable one (`null`, `garbage`) and a mismatched port are
   refused; no Origin passes; the expected host comes from the first
   `x-forwarded-host` value (with `a.example, b.example` only `a.example`
   matches), else `host`; a GET is never refused.
9. `middleware()` called directly answers 403 with an empty body for a
   foreign Origin on a well-formed action, before the body gate, and passes
   a same-origin one through to the body gate as before.
10. Item 3 extended: a target whose warning uses `?.url`, `['url']` or a
    destructured `${url}` makes the patch exit 1; and a target with one
    known assignment plus a second url elsewhere in the window exits 1 after
    the patch (the post-patch check).

### §7.4 Amendment, 2026-11-04 23:1x: the expected host comes from APP_ORIGIN

§7.1 item 2 as first built read `x-forwarded-host` and `host` off the
request. The suite then failed `test/14`'s header-read tripwire (§6.9 of
week 6, amended week 19), on `src/origin-gate.ts` lines 5 and 18. The
tripwire is right to fire: the gate does not need to read where the request
says it is going, because the app knows its own origin. The tripwire is not
changed.

**The rule now.** `originAllowed(headers, method, appOrigin)`: for a `POST`
with an `Origin` header, allow only when both `Origin` and `appOrigin`
parse with `new URL` and their `host` values are equal (port included,
exact). An `Origin` that does not parse, a missing or unparseable
`appOrigin`, or a different host is refused. No `Origin`, or any method but
`POST`, is allowed. The only header read is `origin`. `middleware.ts` passes
`process.env.APP_ORIGIN`.

**Measured on a local standalone build**, built with the Dockerfile's
placeholder `APP_ORIGIN=http://localhost:3000` and run with
`APP_ORIGIN=http://127.0.0.1:3934`: Origin `http://127.0.0.1:3934` passes
to Next (404, the unknown action); `http://localhost:3000`,
`http://w34canary-o.example` and `null` get 403; no Origin passes (404). So
the middleware reads the run-time value, not the build-time one.

**What this buys over Next's rule.** Whatever Next later logs about an
Origin can only be this app's own host. Where the two rules differ (a
request whose `x-forwarded-host` is not the public name, which behind the
proxy only a request made on the server itself can produce) Next's own
check still runs after ours.

**Acceptance, items 8 and 9 re-aimed (same author):** item 8's cases are
expressed against `appOrigin` (matching, mismatched host, mismatched port,
unparseable Origin, unparseable or missing `appOrigin`, no Origin, GET); the
`x-forwarded-host` cases become: a request whose `x-forwarded-host` or
`host` equals the Origin while `appOrigin` differs is refused, so the
request's own headers cannot talk the gate round. Item 9 sets
`process.env.APP_ORIGIN` for the call (and restores it).

### §7.5 Amendment, 2026-11-04 23:3x: the image cache directory

Measured on staging after the §7.4 deploy (`ee5a7fc`), one request at a
time with the container's EACCES count read between them: `GET /`, `GET
/c/abc`, a same-origin and a foreign-origin action left it unchanged; `GET
/_next/image?url=%2Fog%2Fdefault.png&w=640&q=75` added an `EACCES:
permission denied, mkdir '/app/.next/cache'` block and an
`unhandledRejection` block. Fixed text, nothing from the request, but any
visitor can write it.

Cause, read in `next/dist/server/next-server.js` and `image-optimizer.js`:
`handleNextImageRequest` constructs `ImageOptimizerCache` **before** it
checks `unoptimized`, and the constructor starts a disk LRU under
`.next/cache/images` unless `images.maximumDiskCacheSize` is `0`. The image
leaves `/app/.next` unwritable to the container user on purpose (week 32).
So this predates tonight: any `/_next/image` request has done it since the
image became read-only; §7.1 only made every such request end there.

**Change:** `images: { unoptimized: true, maximumDiskCacheSize: 0 }`. The
directory stays unwritable; Next no longer tries to create it.

**Acceptance, added to item 7 (same author):** `images.maximumDiskCacheSize`
is `0`.

## §8 Independent review, second pass, 2026-11-05 00:0x: PASS

Reviewed at `1890a85`, measured on staging (`005e0df`, same runtime code).
Real forms driven in Chromium with JS on and off: dev login, terms, a send
(fetch action and no-JS multipart), the link switch, report, hide, block,
the reveal offer, logout, account deletion; every one 303 or its normal
page, the log unchanged. About 55 probes with canaries through the three
closed paths and their neighbours (the 1 MB action limit, router and RSC
headers, React reply references, auth and admin routes): zero canary lines
in the container log. Notes, recorded rather than closed:

- **A well-formed unknown action id is still logged** (`Failed to find
  Server Action "<42 hex>"`). Week 18 §3 row 2, unchanged: 42 hex
  characters, no newline, about 21 bytes a request.
- **The url detector still passes `const {url: u} = readable`**, a
  rename-destructure, and anything built from headers or `nextUrl`. §7.1
  item 3 already says it is a tripwire for known shapes; the rename form is
  a known shape it misses. Next slice, with its test.
- **The middleware does not see urlencoded POSTs** (matcher: `next-action`
  or multipart). Measured: they log nothing.
- **The proxy replaces `Referrer-Policy`.** Both public origins answer
  `strict-origin-when-cross-origin` (measured from outside, `via: 1.1
  Caddy`); the app sends `same-origin` (week 15). Paths still do not leave
  the site, but an outbound link now tells the other site that the visitor
  came from this app, which week 15 chose to hide. Nothing in the privacy
  copy promises otherwise. The proxy is root's.
