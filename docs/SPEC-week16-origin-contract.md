# Week 16 - the origin contract

*Frozen 2026-09-23 21:5x +04 before any code. Every measurement in §0 was taken
against the live internet from the build session, not against a local build and
not read off a source file.*

## §0 What was measured

### §0.1 Finding A - the two retired origins do not exist in DNS

Commit `a3a47e4` ("move to masaraha.provefair.app, and a Facebook story tile",
2026-09-23 02:42) says this in its own message:

> confession.fayad.app and its staging twin are NOT deleted. They answer 301
> with the path preserved, permanently: every story card already posted has the
> old host drawn into the picture, and the person who shared it must not lose
> their inbox because the brand moved. Removing those two blocks is how you
> break links you can no longer reach.

That is the correct commitment and it is not being kept. Measured against two
independent public resolvers:

```
$ dig @1.1.1.1 confession.fayad.app A      -> status: NXDOMAIN
$ dig @1.1.1.1 stg.confession.fayad.app A  -> status: NXDOMAIN
$ dig @8.8.8.8 confession.fayad.app A      -> (empty)
$ dig @8.8.8.8 fayad.app A                 -> 2.28.66.137     (the parent zone is fine)
```

NXDOMAIN, not NODATA: the names are absent from the zone altogether, so this is
a deleted record and not a record of the wrong type. The parent zone answers
normally from the same resolver, which is the control that makes the two
NXDOMAINs a finding rather than a broken lookup path.

The proxy half is missing too, and that was measured separately by forcing the
name onto the server's address so DNS could not mask the answer:

```
$ curl --resolve confession.fayad.app:443:2.28.66.137 https://confession.fayad.app/c/testslug
  curl: (35) TLS connect error: tlsv1 alert internal error
$ curl --resolve nope.fayad.app:443:2.28.66.137 https://nope.fayad.app/          (control: a name nobody serves)
  curl: (35) TLS connect error: tlsv1 alert internal error
$ curl --resolve fayad.app:443:2.28.66.137 https://fayad.app/                    (control: a name that is served)
  200
```

The retired host behaves exactly like a hostname the reverse proxy has never
heard of. Port 80 answers 308 to https for it, but so does the unknown-name
control, because that redirect is global and proves nothing about either name.

**What it costs.** `app/_components/StoryCard.tsx` draws the link onto the
story image from `window.location.origin`, so every card posted before
2026-09-23 02:36 has `confession.fayad.app/c/<slug>` painted into the picture.
Those are the cards the product is distributed by. They now fail at DNS, which
is the worst of the available failures: no redirect, no error page, no way for
the person holding the link to discover where the app went.

**Whose it is.** Not this session's, and the rules are quoted rather than
guessed. `bin/asam.sh help`: *"/srv/caddy (the reverse proxy, the ACME account,
every certificate) is root-owned and unreadable from here. Hostnames and TLS
are root policy."* `bin/asam.sh ports`: *"You cannot edit the Caddyfile and you
should not try."* For DNS: the zone is on Cloudflare (`ariadne.ns.cloudflare.com`,
`yichun.ns.cloudflare.com`), and this account holds no Cloudflare credential of
any kind, measured rather than assumed: no `CF_*` or `CLOUDFLARE_*` variable in
the environment, no `~/.cloudflared`, and nothing under `/secrets-deploy` except
the ssh key and its `known_hosts`. So the repair is one Cloudflare edit plus one
Caddy block, and it goes to Sam as a request.

### §0.2 Finding B - nothing in this repository checks an origin at all

Fourteen weeks of this project verified deploys from outside by hand, one curl
at a time, on the hostname the session happened to have in mind. That is why
finding A survived about nineteen hours with the suite green: **468 tests pass
and not one of them knows what hostname this product is served on.** The origin
appears in `src/robots.ts` as `PRODUCTION_ORIGIN`, in two `.env` files as
`APP_ORIGIN`, in `scripts/check-deploy-pairing.sh` as a table, and in eleven
test files as a literal, and no rule ties those five places together or says
what a retired origin must still do.

A document that names the old hosts is not a check. The commitment in `a3a47e4`
was written into a commit message, which is the one place that can never fail.

### §0.3 Finding C - production serves the app from the current tree

Recorded so §0.1 is not mistaken for a stale deploy. `confession-prod-web` runs
`confession-web:faa5022`, which is `main`. `https://masaraha.provefair.app` and
`https://stg.masaraha.provefair.app` both answer 200 over the real certificate,
`/terms`, `/privacy` and `/robots.txt` are 200 on production, and no live page
on either origin contains the string `fayad.app`. The move itself worked. It is
only the retired half that is broken.

### §0.4 Finding D - Facebook login is off in production, on purpose, and nowhere written down

`GET https://masaraha.provefair.app/auth/facebook/start` answers **503**, which
is `app/auth/facebook/start/route.ts` refusing because `env.facebookAppId` is
unset. On staging the same path answers 302 to Facebook's real dialog. The
production `.env` has no `FACEBOOK_APP_ID` and no `FACEBOOK_APP_SECRET`; the
staging one has both.

It was a deliberate act, not a slip. The server keeps the previous file as
`/srv/apps/confession-prod/.env.bak-fbhide-20260923-001553`, and its key names
include both Facebook keys, so at 2026-09-23 00:15 someone removed them from
production and kept staging. The likely reason is sound and is recorded in
`work/confession-app/META-STATUS.md`: the Meta app is still غير منشور pending
business verification, so a Facebook button on production would fail for every
real user.

**No code in this slice touches it.** It is named here because the decision
exists only as the name of a backup file on a server, and this spec is the
first place that says it out loud. Turning it back on is a judgement about
Meta's review state, not a deploy, and it is not made at the end of a session.

### §0.5 Finding E - the Meta dashboard points at the dead host

From `work/confession-app/META-STATUS.md`, measured in the dashboard on
2026-09-05: the app's *Data deletion instructions URL* is
`https://confession.fayad.app/account/delete`, and "App domains, privacy URL,
terms URL, contact email and icon are all correct alongside it" - correct as of
that date, all on `confession.fayad.app`. Every one of those URLs is NXDOMAIN
as of tonight, while the app sits under review. A reviewer who opens the privacy
policy link gets a DNS failure.

That is Sam's dashboard and his account. It goes in the ask, not in the code.

---

## §1 What this slice ships

One idea: **the set of origins this product has ever advertised is data in the
repository, and it is checkable from outside.**

### §1.1 `src/origins.ts` - the contract, as data

A framework-free module, no `env` import, importable by plain `node:test`, in
the same discipline as `src/robots.ts`.

It exports `ORIGINS`, an ordered, frozen list. Each entry is one of two kinds:

- `kind: 'live'` - an origin that must answer 200 at `/`. Fields: `origin`,
  `role` (`'production' | 'staging'`), `since` (ISO date), `why`.
- `kind: 'retired'` - an origin that must answer a permanent redirect to a
  named successor, with the path preserved. Fields: `origin`, `redirectsTo`,
  `retired` (ISO date), `why`.

The initial table, and its rows are not editable without §3 item 5 firing:

| kind | origin | expects |
|---|---|---|
| live | `https://masaraha.provefair.app` | 200 |
| live | `https://stg.masaraha.provefair.app` | 200 |
| retired | `https://confession.fayad.app` | 301 to `https://masaraha.provefair.app`, path preserved |
| retired | `https://stg.confession.fayad.app` | 301 to `https://stg.masaraha.provefair.app`, path preserved |

It also exports two pure functions, so the checker script holds no logic of its
own that a test cannot reach:

- `expectedRedirect(entry, probePath)` - the exact absolute URL a retired
  origin must send a visitor to. Path preserved means path preserved: query and
  fragment are not in scope and are not claimed.
- `judgeProbe(entry, probe)` - takes a plain result record (`dnsResolved`,
  `status`, `location`) and returns `{ ok: boolean, reason: string }`. This is
  the whole verdict, and it is a pure function of data so it can be tested
  without a network.

`judgeProbe` distinguishes the failures rather than flattening them, because
tonight's failure mode was invisible precisely when flattened:

- `dnsResolved === false` gives `reason` starting `NXDOMAIN`. This ranks
  ahead of every other check, since an unresolvable name has no status.
- a live entry with a status other than 200 names the status.
- a retired entry with a non-3xx status names it as "not redirecting".
- a retired entry with a 3xx and a wrong `location` prints both the expected
  and the received URL.
- a retired entry answering 302 rather than 301 fails, and says so. The
  commitment is *permanently*, and a temporary redirect is a different promise.

### §1.2 `scripts/check-origins.mjs` - the same contract, against the internet

Run as `node scripts/check-origins.mjs [--path /c/example]`. For each entry:

1. Resolve the name with `node:dns/promises` `resolve4` + `resolve6`. A name
   that answers neither is `dnsResolved: false` and the HTTP probe is skipped.
2. Fetch `origin + probePath` with redirects **not** followed, a 15 second
   timeout, and no cookies.
3. Hand the record to `judgeProbe` and print one line per entry.

Exit 0 only when every entry passes. Exit 1 otherwise, after printing all of
them, because stopping at the first failure hides the second.

The script prints no secret, sends no credential and reads no `.env`.

### §1.3 `test/67-origin-contract.test.ts`

Written from this spec by a different author than the implementation, in its own
worktree, without reading `src/origins.ts` or the script. Items in §3.

---

## §2 Rejected alternatives

1. **Put the retired hosts in a markdown document and move on.** Refused: that
   is what `a3a47e4` did, in a commit message, and the commitment was false
   nineteen hours later with nothing to say so.
2. **Make the checker part of `npm test`.** Refused: the suite must stay
   runnable with no network, and a test that fails because someone's wifi
   dropped is a test that gets skipped. The pure judgement is unit-tested with
   no network; the network run is a script a human or a deploy invokes.
3. **Have the check assert against `env.appOrigin` at runtime.** Refused: the
   app would then have to be reachable to tell you that it is not, and a
   retired origin has no app behind it at all by definition.
4. **Fix it by deleting the two retired rows, since they fail.** Named here as
   the failure mode this slice must resist, which is why §3 item 5 exists: the
   table may gain rows and may never lose one. A red check is the finding.
5. **Teach the script to repair DNS or the Caddyfile.** Refused, and not on
   taste: this account has neither credential, and the rules quoted in §0.1
   say hostnames and TLS are root policy.
6. **Wait for Sam to fix DNS and ship the checker afterwards.** Refused. The
   checker is worth more red than green: it is the artefact that turns tonight's
   measurement into something he can re-run in one command after the edit,
   instead of taking this session's word for it.

---

## §3 Acceptance - what a different author proves

1. **Shape.** `src/origins.ts` exports `ORIGINS` as an array; every entry has a
   `kind` of `'live'` or `'retired'`; every `origin` is an absolute `https://`
   URL with no trailing slash and no path.
2. **Both live origins present.** `https://masaraha.provefair.app` with
   `role: 'production'` and `https://stg.masaraha.provefair.app` with
   `role: 'staging'`.
3. **Both retired origins present**, each with a `redirectsTo` that is itself
   the `origin` of a `live` entry in the same table. A retired host may not
   point at another retired host, and may not point somewhere absent from the
   table.
4. **Staging retires to staging.** `stg.confession.fayad.app` redirects to the
   staging origin and not to production. Sending a staging link to production
   would hand a test visitor the real site.
5. **The table may not shrink.** The four origins above are pinned by literal
   string in the test file itself, so removing a row from `src/origins.ts` to
   quiet a failing check turns the suite red. The reason is carried in the
   assertion message.
6. **`expectedRedirect` preserves the path**: `/c/abc` under the production
   retirement gives exactly `https://masaraha.provefair.app/c/abc`; `/` gives
   `https://masaraha.provefair.app/`; a path is never doubled and a slash is
   never dropped or duplicated.
7. **`judgeProbe` ranks DNS first**: an entry with `dnsResolved: false` fails
   with a reason beginning `NXDOMAIN`, even when a `status` of 200 is also
   supplied in the same record.
8. **A live entry** passes on 200 and fails on 301, 404, 500 and 503, each
   naming the status it received.
9. **A retired entry** passes on 301 with the exactly-correct `location`, and
   fails on: 200, 404, a 301 with the successor's origin but a dropped path, a
   301 to the old host itself, and **302 with an otherwise correct location**.
10. **No secret surface.** `scripts/check-origins.mjs` contains no `.env` read,
    no `process.env` secret access, and no `Authorization` header.
11. **The script exits non-zero when any entry fails**, proved by running its
    judgement over a fabricated result set rather than over the network.
12. **No network in the test file.** The test performs no DNS lookup and no
    `fetch`; it is pure over fabricated records.

No existing test is edited by this slice. If one turns red, the fix is in this
slice's code.

---

## §4 Found while building, after the freeze

Recorded here rather than folded back into §1, so the frozen text still says
what was known before any code.

### §4.1 The probe record has to carry the path it was taken at

§1.1 lists the probe record as `dnsResolved`, `status` and `location`, and §3
item 9 requires a 301 that carries the successor's origin with the path dropped
to FAIL. Those two cannot both hold: with only a `location` to look at, a
redirect to `https://masaraha.provefair.app/` is indistinguishable from a
correct redirect of a probe taken at `/`. The verdict needs to know what was
asked for.

So the record is `{ dnsResolved, probePath, status?, location? }`, and
`probePath` defaults to `/` when it is absent. This is a correction to the
spec's own contract, made before the code was written rather than after a test
went red, and §3 item 9 is unchanged: it was always the stricter and the
correct requirement, and §1.1 was the half that was wrong.

### §4.2 `--path` belongs to the retired rows only

Found by running it. `node scripts/check-origins.mjs --path /c/example` turned
all four rows red: the two retired origins on NXDOMAIN, which is the finding,
and the two live origins on a 404, which is the correct answer for a slug
nobody owns. A check that goes red on correct behaviour is a check that gets
ignored, and that is the failure mode this whole slice exists to prevent.

`--path` exists to prove a retired origin preserves the path, because the path
is what carries somebody's already-posted link. A live origin is probed at `/`
and always at `/`. Section §1.2's step 2 is amended to that; the judgement in
§1.1 is unchanged and so is every item of §3.

Measured after the change, verbatim:

```
check-origins: probing 4 origins at /c/example

ok   live     200 at https://masaraha.provefair.app
ok   live     200 at https://stg.masaraha.provefair.app
FAIL retired  NXDOMAIN: https://confession.fayad.app resolves to no A and no AAAA record, so nothing after DNS was measured
FAIL retired  NXDOMAIN: https://stg.confession.fayad.app resolves to no A and no AAAA record, so nothing after DNS was measured

check-origins: 2 of 4 origins are not keeping the contract.
```

### §4.3 Two things confirmed on the way past, so they are not re-litigated

- **Week 15's dead ends are live.** `https://masaraha.provefair.app/c/example`
  answers 404 with «ما لقينا هالصفحة» and a «رجوع» link, not Next's built-in
  English page. Finding D of week 15 is closed on production.
- **The working tree at `repos/confession` is not writable by this account.**
  `src/`, `test/`, `app/` and the repository root are owned by uid 1006 with
  mode 755, so `src/origins.ts` could not be created there at all. Both halves
  of this slice were therefore built in fresh worktrees, which is the isolation
  week 7 §9 asked for anyway. Recorded because the next session will hit it.

---

## §5 Amended 2026-09-25: the owner retired the old names, and no redirect is owed

Everything above §5 was frozen on the premise that `a3a47e4`'s promise stood:
the two `fayad.app` names would keep answering a permanent redirect. The owner
answered that premise the other way on 2026-09-24 00:50, recorded verbatim in
`work/confession-app/BRIEF.md` (workspace repository), "Sam's word,
2026-09-24":

> انا بدلت الدومين صار masaraha.provefair.app

and four minutes later, the reason, which is now a requirement of the product:

> غيرته لانو مابدي اسمي يظهر ضمن ال url تبع تطبيق مصارحة

So NXDOMAIN on `confession.fayad.app` and `stg.confession.fayad.app` is the
intended state, not a finding. A redirect from either name would put his name
in front of this app's URL, which is the thing he moved the domain to stop.
Findings A and E in §0 stand as measurements of 2026-09-23; their conclusion
("it goes to Sam as a request") is withdrawn. Finding E's dashboard URLs are his
and are tracked outside this repository.

### §5.1 What changes

A `retired` origin now means **absent**: the name must not resolve at all.

- `RetiredOrigin` loses `redirectsTo` and gains `expects: 'absent'`. It keeps
  `origin`, `retired` (ISO date, now `2026-09-24`, the day the owner retired
  it) and `why`.
- `expectedRedirect` is removed. Nothing owes a redirect any more, and a helper
  that computes one invites someone to build one.
- `judgeProbe` on a retired entry:
  - `dnsResolved: false` passes, with a `reason` that still begins `NXDOMAIN`.
    DNS keeps ranking first for both kinds; only the verdict differs.
  - `dnsResolved: true` fails, whatever else the record carries (a status, a
    redirect to a live origin, or no HTTP response at all). The reason names
    what it answered and says the owner retired the name so it would not appear
    in the app's URL. A name that resolves again is a change to his DNS that
    somebody has to explain, and a 301 to the new host is the most likely
    shape of it, so that case is named in the reason rather than folded in.
- A live entry is judged exactly as before.
- `scripts/check-origins.mjs` loses `--path`. It existed only to prove the path
  was preserved through a redirect (§4.2). Every origin is probed at `/`. An
  unknown argument exits 2 with a usage line rather than being ignored, so a
  deploy script still passing `--path` finds out.

### §5.2 What does not change

The table still has four rows and still may not shrink (§3 item 5). The two
`fayad.app` rows stay, with the new expectation: removing them would delete the
only check that goes red if the owner's name comes back in front of this app.

### §5.3 Acceptance, replacing §3 items 3, 4, 6 and 9

Items 1, 2, 5, 7, 8, 10, 11 and 12 stand. Item 7 now holds for both kinds: the
reason begins `NXDOMAIN` whenever `dnsResolved` is false, even with a `status`
supplied.

- **3'.** Both retired origins are present, each with `expects: 'absent'` and
  **no `redirectsTo` property** at all.
- **4'.** `src/origins.ts` exports no `expectedRedirect`.
- **6'.** A retired entry with `dnsResolved: false` passes, even when a
  `status` of 301 and a `location` on a live origin are also supplied.
- **9'.** A retired entry with `dnsResolved: true` fails on each of: 200, 404,
  a 301 to `https://masaraha.provefair.app/`, a 302 to the same, and a record
  with no `status` at all. Each reason names the retired origin.
- **13.** The live rows are not weakened by the change: a live entry with
  `dnsResolved: false` still fails, with a reason beginning `NXDOMAIN`.
- **14.** `scripts/check-origins.mjs`, read as inert text, contains no
  `--path`.

Rejected: keeping `redirectsTo` as an optional field "in case he changes his
mind". He can change his mind, and that is one row edited on the day he does.
A field that describes a promise nobody is keeping is how §0.1 happened.
