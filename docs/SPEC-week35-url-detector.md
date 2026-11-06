# Week 35: the body-warning tripwire knows the destructure and request-part shapes

Frozen 2026-11-06 21:4x, before the change to the script and before the
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

## §5 Independent review, pass 1, 2026-11-06 22:0x: FAIL, and the amendment

Reviewed at `780fdb8` by a separate reviewer, scratch fixtures only, no
server. No false positive on the real copies, no live leak, no regex
blow-up (`--check` 0.04 s on the real 204 KB runtime file, under 1 s on
5 MB synthetic files). It failed the slice on conformance:

1. **§1 shape 1 is narrower in code than in the spec.** The script required
   an identifier character, `)`, `]` or `?` before the dot, so
   `` `/p`.url ``, `"/p".url`, `{}.url` and `...url` passed both modes.
2. **Shapes that are neither flagged nor listed in §2:** a url passed as a
   positional argument (`console.warn('... for', url)`, a `(url)`
   parameter); a call on the name inside the template (`${url.slice(0,80)}`,
   `${decodeURI(u)}`); request parts outside the list (`host`, `hostname`,
   `origin`, `path`, `referrer`, `cookies`); a `.mjs` or `.cjs` copy (the
   walk read only `.js`); and the window ran from the start of the warning
   text, so the side after it was about 20 characters short.
3. **Tests that §1 states and nothing pins:** the double-quoted key, the
   window edge, "every occurrence", and case sensitivity.

### §5.1 The rule now (replaces §1's four shapes)

Within the window, **any whole-word occurrence of a NAME** is flagged:
the name not preceded and not followed by an identifier character
(`[A-Za-z0-9_$]`), case sensitive. The four shapes of §1 are special cases
of this, and it also catches positional arguments, parameters, calls on the
name, concatenation and comparisons. So `if (ok, url === b)`, which §1 left
alone, is now flagged: anything that names a request part next to the
warning stops the build and gets read by a person. That is the tripwire's
job; a false alarm costs a look, a miss costs the promise.

NAME is now: `url`, `originalUrl`, `nextUrl`, `href`, `pathname`, `search`,
`searchParams`, `query`, `headers`, `rawHeaders`, `host`, `hostname`,
`origin`, `referer`, `referrer`, `cookies`, `path`, `ip`, `socket`.

The window is `WINDOW` (400) characters before the start of the warning
text and `WINDOW` characters after its end, for every occurrence.

The walk reads `.js`, `.mjs` and `.cjs` files.

Measured before amending: with the known assignment rewritten, the three
real copies have **no** hit of any of the nineteen names in a 400 window.
At 800 the minified copy would trip (`url`, `headers`, `host`, `query` from
about 600 characters before), so `WINDOW` stays 400 and the margin is about
200 characters.

### §5.2 What this still does not claim (adds to §2)

A request part reached through a name not in the list or assigned more than
400 characters away; the whole request object passed on
(`JSON.stringify(readable)`, `${readable}`); a warning whose text is split
(`'Request body ' + 'exceeded'`) or reworded, which the walk does not find;
symlinked directories, which it does not follow. A run that patches one
file and then fails on another has already written the first; postbuild
stops the build either way, so nothing ships from it.

### §5.3 Acceptance, replacing §3 where they differ (same test author)

- Item 1 becomes every NAME of §5.1, whole word, in at least these
  positions: member, optional member, bracket in each quote, destructure
  with `:`, shorthand, default and double-quoted key, bare template,
  positional argument, parameter, call inside a template, concatenation.
- Item 5 keeps the whole-name negatives (`urlInfo`, `hrefLang`,
  `searchTerm`, `queryKey`, `headersSent`, `${urlInfo}`) and adds case:
  `URL`, `Headers`, `Host` are not flagged. The `==` / `===` cases that
  were negatives under §1 are now positives.
- New: the review's four §5 item 1 fixtures are flagged in both modes.
- New: a name 390 characters after the end of the warning text is
  flagged; one 420 characters after it is not; the same on the side before,
  measured from the start of the text.
- New: a file with two occurrences of the warning, the first clean and the
  second carrying a name, fails.
- New: a `.mjs` and a `.cjs` target are each found and judged like `.js`.

### §5.4 Clarification, 2026-11-06 22:3x: which text the distance is measured in

A distance in §5.1 and §5.3 is measured in the text being judged. For
`--check` that is the file as it is. For the patch run it is the text
after the known assignment is rewritten, because the post-patch check is
what decides. The first edge fixtures measured 420 in the unpatched text
with the assignment between the name and the warning; rewriting it shortens
the text by about 35 characters, so the name sat about 385 away and was
rightly flagged. The test is re-measured, the rule is unchanged.

## §6 Independent review, pass 2, 2026-11-06 22:4x: PASS

Reviewed the script at `9a7accb` (unchanged at `4f6c1c8`), read only,
scratch fixtures. The four pass-1 fixtures are flagged in both modes; the
pass-1 omissions are flagged (positional `url`, `${url.slice(0,80)}`,
`.host`, `.hostname`, `.origin`, `.path`, `.referrer`, `.cookies`,
`.socket`, `getHeader("host")` through the string, `.mjs` and `.cjs`) or
named in §5.2 (`${String(u)}`, `JSON.stringify(readable)`, `baseUrl`,
`uri`, `requestUrl`, `req.method`). No false positive on the three real
copies or on `.next/standalone`. Measured edges: flagged up to 395
characters after the end of the text and 397 before its start. Worst
timing found: 2.11 s on 5 MB of dense warnings each followed by a run of
`url`. Mutation: 39 mutants, 38 red.

Recorded, not closed:

- **`WINDOW = 420` survives.** The tests pin the window between about 390
  and 420, so a drift inside that band would pass. It errs toward flagging
  more.
- **Carried from §5.2 and the pass-2 brief:** `ASSIGNMENT` is quadratic on
  a long run of identifier characters (unchanged code; 150 KB of one
  identifier took 23 s; real minified files have no such runs); a run that
  patches one file and fails on another has written the first; a name cut
  by the window edge can read as a shorter listed name and is flagged.
