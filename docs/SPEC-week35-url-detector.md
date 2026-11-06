# Week 35: the body-warning tripwire knows the destructure and request-part shapes

Frozen 2026-11-06 22:0x, before the change to the script and before the
test was written.

## §0 What is wrong, measured

Week 34 added `scripts/patch-next-body-warning.mjs`, which runs as
`postbuild` over `.next/standalone`, rewrites the url out of Next's
`Request body exceeded` warning, and fails the build when a copy of that
warning still carries the url in a shape it does not know. Its second
review (week 34 spec §8) recorded that the detector passes a
rename-destructure and anything built from headers or `nextUrl`.

Re-measured tonight against `main` (`ede892c`), in a scratch directory, one
file per shape, each running the script and then `--check`:

| shape near the warning | patch | `--check` |
|---|---|---|
| `const {url: u} = readable` then `` ` for ${u}` `` | exit 0, "already patched" | exit 0 |
| `const {url} = readable` then `'... for ' + url` | exit 0, "already patched" | exit 0 |
| `req.nextUrl.pathname` into the warning | exit 0, "already patched" | exit 0 |
| `req.headers.host` into the warning | exit 0, "already patched" | exit 0 |

So a Next upgrade that rewrote the warning in any of these four ways would
ship the sender's path, query or host into the container log, and the build
would say all was well. Today's Next (15.5.24) does none of them; this is a
tripwire for the next upgrade, not a live leak.

## §1 The rule

`carriesUrl` (the window check, `WINDOW` = 400 characters either side of
every occurrence of `Request body exceeded`) flags a window when it contains
any of these, for any NAME in the list below:

1. **Member access:** `.NAME` or `?.NAME`, with no identifier character
   after NAME (week 34's form, wider list).
2. **Bracket access:** `['NAME']`, `["NAME"]` or `` [`NAME`] `` (week 34's
   form, wider list).
3. **Destructure or object key (new):** `{` or `,`, optional whitespace,
   NAME optionally in single or double quotes, optional whitespace, then one
   of `:`, `,`, `}`, or a `=` that is not followed by `=`. This catches
   `{url: u}`, `{ url }`, `{url, method}`, `{url = ''}`, `{'url': u}` and
   `, nextUrl }`.
4. **Bare template:** `${NAME}` with optional whitespace inside the braces
   (week 34's form, wider list).

NAME is one of: `url`, `originalUrl`, `nextUrl`, `href`, `pathname`,
`search`, `searchParams`, `query`, `headers`, `rawHeaders`. Matching is
case sensitive and whole-name: `urlInfo`, `hrefLang`, `searchTerm`,
`queryKey`, `headersSent` and `${urlInfo}` are not flagged.

Measured before freezing: over the three real copies of the warning in Next
15.5.24 (`dist/server/body-streams.js`, `dist/esm/server/body-streams.js`,
`dist/compiled/next-server/server.runtime.prod.js`), the only hits in any
window are the two `readable.url` (`e.url` minified) that the patch already
removes. So the wider list does not fail today's build.

Everything else about the script is unchanged: the known assignment is still
the only thing it rewrites, a target with no known assignment and a flagged
window still fails ("a form this script does not know"), the post-patch
check still refuses to write a file whose patched text is still flagged,
and `--check` still fails on any flagged window.

## §2 What this does not claim

- It is still a tripwire for shapes it knows. A url read 400 characters or
  more away from the warning text, a name outside the list (`req.socket`,
  `getHeader('host')` without `.headers`, a renamed variable assigned far
  away), or text assembled from a function call it cannot see would pass.
- The claim of week 34 is unchanged: three requests no longer write sender
  text into the log. This week widens the guard on one of them; it closes
  no new request.

## §3 Acceptance (written by a different author, from this spec only)

A new file `test/87-url-detector.test.ts`, in the style of
`test/85-body-warning.test.ts` (subprocess with `process.execPath`, explicit
env with no `CTL_*` names, scratch directories removed in a `finally`,
nothing written into the real `node_modules`):

1. For each NAME and each of shapes 1 to 4 of §1, a scratch target whose
   warning carries that shape within the window, with no known assignment:
   the patch run exits 1, names the file, and leaves the file byte-identical;
   `--check` on the same directory exits 1.
2. The four §0 shapes exactly as written in the table: patch exits 1 and
   `--check` exits 1, file unchanged.
3. The shapes sit on either side: one case with the flagged shape before the
   warning text, one after it.
4. A target with the known assignment plus a `{url: u}` destructure elsewhere
   in the window: patch exits 1 after patching in memory, and the file on
   disk is byte-identical to before.
5. Negative: a target with the known assignment and, within the window,
   `urlInfo`, `hrefLang`, `searchTerm`, `queryKey`, `headersSent` and
   `${urlInfo}`: patch exits 0 and rewrites the assignment; `--check` then
   exits 0.
6. Regression: a scratch copy of the three real files from the installed
   Next, patched, exits 0 and `--check` exits 0 (test/85 item 1 already
   covers this; this file repeats it once so that it stands on its own).

Every item must fail on `main` (`ede892c`) except 5 and 6, which must pass
there and keep passing.

## §4 Done means

`tsc --noEmit` 0, the whole suite green, `npm run build` passes (the
`postbuild` patch and check run on the real standalone output), and the
image builds on staging. The runtime code in the image is unchanged, so no
request behaves differently; staging and production are checked from
outside after the deploy as every week.
