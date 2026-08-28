# SPEC — week 5: promotion to production

*Frozen 2026-08-28, before any code. Written by the session that plans, not by
the agent that implements. Nothing outside this document changes.*

The app runs on staging (`stg.confession.fayad.app`, port 8182) and has since
week 4. This slice puts it on production (`confession.fayad.app`, port 8082)
**alongside** staging, not instead of it.

## 0. The problem this slice actually solves

The week-4 deploy assets cannot run twice on one box. Three collisions:

1. `docker-compose.yml` pins `container_name: confession-web` and
   `confession-db`. Container names are global to a Docker daemon, so the
   second stack fails to start. (It fails loudly rather than silently — that
   part is fine — but it means there is no production.)
2. `deploy.sh` hardcodes `confession-web` in its `docker inspect` health poll,
   so it would poll the wrong stack's container.
3. The compose project name is inferred from `--project-directory`'s basename.
   Inference is not a contract; a rename would silently orphan the Postgres
   volume, which on production is the confessions themselves.

And one hazard that only exists once there are two stacks: **a production
`.env` with the wrong `HOST_PORT` publishes production on 8182, where the
proxy routes `stg.` traffic.** That would put real confessions behind the
hostname advertised as a test instance, and nothing in the current tree stops
it. This slice adds the check that does.

## 1. `STACK_NAME` — one variable, two stacks

`.env` gains `STACK_NAME`. Exactly two values are legal:

| `STACK_NAME` | `HOST_PORT` | `APP_ORIGIN` | `ALLOW_DEV_LOGIN` | directory |
|---|---|---|---|---|
| `confession` | `8182` | `https://stg.confession.fayad.app` | may be `1` | `/srv/apps/confession` |
| `confession-prod` | `8082` | `https://confession.fayad.app` | must be absent or empty | `/srv/apps/confession-prod` |

Staging keeps `STACK_NAME=confession` deliberately: its compose project is
already named `confession` and its volume is already
`confession_confession-pgdata`. Any other value renames the project, and a
renamed project does not find the existing volume. **The staging database must
survive this deploy.**

### 1.1 `docker-compose.yml`

- `container_name` on both services becomes `${STACK_NAME:?...}-web` and
  `${STACK_NAME:?...}-db`. Use the `:?` form so an unset value stops the
  deploy instead of producing a container called `-web`.
- **The service keys stay `confession-web` and `confession-db`.** The
  `DATABASE_URL` in this file resolves `confession-db` over the compose
  network, and each project gets its own network, so the same hostname means
  the right database in each stack. Do not parameterise the service keys.
- The volume stays `confession-pgdata`. Compose namespaces volumes by project
  name, which is what keeps the two databases apart.
- Nothing else in this file changes. In particular the Postgres logging flags,
  the absent `ports:` on the database, and the `127.0.0.1` bind on the web
  container are privacy and firewall decisions from week 4 and are not
  touched.

### 1.2 `deploy.sh`

- Require `STACK_NAME` alongside the existing `HOST_PORT`.
- Pass `-p "$STACK_NAME"` to **every** `docker compose` invocation, so the
  project name is stated rather than inferred.
- Poll `"${STACK_NAME}-web"` in the `docker inspect` health loop, and use it in
  the failure-path `logs` call.
- Call the pairing guard (§2) **before** the build. A deploy that is going to
  be refused should be refused before it spends four minutes compiling.
- Everything else — the `DEPLOY_VERSION` requirement, the health poll, the
  local `/healthz` check, and the closing note that a local check proves
  nothing about DNS or TLS — stays exactly as it is.

## 1.3 CORRECTION, made at deploy time — `APP_DIR`

**This section is a defect in the frozen spec above, found by running it, and
recorded rather than quietly patched.**

§1.2 said "everything else stays exactly as it is" and never mentioned
`deploy.sh`'s `APP_DIR=/srv/apps/confession`, while §1's table gives production
a different directory. Followed literally, the production deploy `cd`s into the
**staging** directory, reads **staging's** `.env`, and redeploys staging — and
it exits 0 while doing it. That is exactly what happened on the first
production deploy attempt: the script printed
`local health check on 127.0.0.1:8182`, the staging port, and no
`confession-prod` container was ever created.

The pairing guard did not catch it, and could not have: it validates the four
fields **inside** a `.env` for mutual consistency, and staging's `.env` is a
perfectly legal row. Nothing checked **which** `.env` had been read.

Two changes close it:

- `APP_DIR` is derived from the script's own location — the script always lives
  at `$APP_DIR/repo/deploy.sh` — instead of being a constant. A deploy script
  that only works in one directory has no business being copied into two.
- The **directory becomes the fifth field of the guard's table** (§2). §1's
  table always had a directory column; the guard just ignored it. An invariant
  that is written down in a table and not checked by the code that reads the
  table is a comment, not a guard.

## 2. `scripts/check-deploy-pairing.sh` — fail closed

A standalone script, because it has to be testable off the box.

```
scripts/check-deploy-pairing.sh <stack_name> <host_port> <app_origin> <allow_dev_login> <app_dir>
```

`app_dir` is the fifth and last argument, added by the §1.3 correction. It is
the absolute path of the deploy directory, and it must equal the `directory`
column of the row matched by `stack_name`: `/srv/apps/confession` for
`confession`, `/srv/apps/confession-prod` for `confession-prod`. A trailing
slash is accepted and stripped before comparison; nothing else is normalised.
It must not be empty.

Exit `0` only if the four arguments match one full row of the table in §1.
Exit `1` on anything else, printing to stderr which field mismatched and what
was expected. Specifically it must refuse:

- an unknown `STACK_NAME`;
- `confession-prod` on port `8182`, or `confession` on `8082`;
- `confession-prod` with a `stg.` origin, or `confession` with the production
  origin;
- `confession-prod` with `ALLOW_DEV_LOGIN=1` (belt and braces — `src/env.ts`
  already refuses this at boot, and both checks stay);
- a `stack_name` whose `app_dir` belongs to the other row — in particular
  `confession-prod` run from `/srv/apps/confession`, which is the exact
  failure §1.3 records;
- an empty or missing argument in any position, **except** `allow_dev_login`
  as carved out below.

`ALLOW_DEV_LOGIN` is the one field allowed to be empty, and only for
`confession`, where both `1` and empty are legal.

The guard is a table, not a chain of heuristics. Do not write it as
"if origin contains stg" — that logic is how a fourth hostname added later
silently becomes production.

## 3. Environment-aware `robots.txt`

`public/robots.txt` today ships one body to both hosts, and it does not
disallow crawling at the root. So `stg.confession.fayad.app` is indexable: a
test instance of a confession product, with a dev login on it, offered to
search engines. That is a real defect, found while reading for this slice.

- **Delete `public/robots.txt`.** A file in `public/` shadows a route of the
  same path, so it cannot merely be left behind.
- **Add `src/robots.ts`** exporting one pure function:
  `robotsBody(appOrigin: string): string`. Framework-free, no `env` import, so
  it is testable with plain `node:test` — the same discipline as
  `src/session.ts`.
  - For exactly `https://confession.fayad.app` it returns the production body:
    the current allow-list, unchanged, `User-agent: *` followed by `Disallow:`
    lines for `/c/`, `/inbox`, `/sent`, `/offer/`, `/onboarding`, `/auth/`.
  - For **every other origin** it returns `User-agent: *` and `Disallow: /`.
  - The production origin is matched **exactly**, not by prefix or substring.
    Default-deny: an origin nobody anticipated gets the closed answer.
- **Add `app/robots.txt/route.ts`** — a thin `GET` returning
  `robotsBody(env.appOrigin)` as `text/plain; charset=utf-8`. It must set
  `export const dynamic = 'force-dynamic'`.
  - This is the load-bearing line. `APP_ORIGIN` at image-build time is the
    placeholder `http://localhost:3000` from the Dockerfile. If Next evaluates
    this route at build time it bakes `Disallow: /` into the production image
    and de-lists the real site. It must be evaluated per request.

## 4. Out of scope, explicitly

- No schema change, no migration, no new table or column.
- No new user-facing surface, no copy change, no styling.
- Facebook Login is **not** switched on. The App ID and Secret have not
  arrived. Production ships with `FACEBOOK_APP_ID` absent, which the landing
  page already handles: it renders «تسجيل الدخول بفيسبوك مش متاح هلق» and
  `/auth/facebook/start` answers 503. That is the honest state of the product
  and it ships as-is rather than being hidden.
- Nothing is rented and no spend is incurred. The server already exists.

## 5. What proves this slice

Not a report — these, run and pasted:

1. `npm test` green, at or above the 58-test week-4 baseline.
2. `npm run typecheck` clean.
3. Staging redeployed on the new tree, `asam.sh check stg.confession.fayad.app`
   → 200, and its existing database still holding the week-4 rows.
4. `asam.sh check confession.fayad.app` → 200.
5. On production, from outside: `POST /auth/dev` → 404, `/auth/facebook/start`
   → 503, `/terms` → 200, `/privacy` → 200, `/robots.txt` → the allow-list body.
6. On staging, from outside: `/robots.txt` → `Disallow: /`.
7. The two databases are separate: a row that exists in one is absent in the
   other.
8. What the running production stack logs, measured on the box, not asserted.
