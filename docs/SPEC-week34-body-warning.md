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
