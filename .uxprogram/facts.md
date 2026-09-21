PROJECT_ROOT: C:\odoo_projects\confession
DEFAULT_BRANCH: main
BASE_REV: 5148cecb501994cc5c78305d42307ee0753dacdd
PYTHON: python
NODE: v24.19.0
STACK: Next.js 15 (App Router), React 19, TypeScript 5.9, Drizzle ORM, PGlite (WASM Postgres for tests) / Postgres 17, CSS / Tailwind
PLATFORMS: web
BUILD: npm run build
RUN: npm run dev (http://localhost:3000)
LINT: npm run typecheck
TEST: npm test
TEST_TOOLING_ADDED: playwright 1.63.0 (D-001)
GIT_IDENTITY: sam27697 <mohamad.fayad.27697@gmail.com>
CORE_GOALS: send an anonymous confession (/c/[slug]); view received confessions in inbox (/inbox); mutual reveal offer and response (/offer/[offerId]); share confession link on social media; onboarding and terms acceptance (/onboarding, /terms)

## Capability probe
| Capability | Result | Evidence |
|---|---|---|
| Shell commands run | YES | .uxprogram/logs/20260916-125241-probe-shell.log |
| Python (python) | YES | .uxprogram/logs/20260916-125246-probe-python.log |
| Node (v24.19.0) | YES | .uxprogram/logs/20260916-125247-probe-node.log |
| npm (11.6.2) | YES | .uxprogram/logs/20260916-125252-probe-npm.log |
| Human git identity | YES | .uxprogram/logs/20260916-125256-probe-git-identity.log, .uxprogram/logs/20260916-125257-probe-git-email.log |
| App builds clean | YES | .uxprogram/logs/20260916-125324-probe-build.log |
| Web probe (Playwright) | YES | .uxprogram/logs/20260916-125308-probe-playwright.log, .uxprogram/logs/20260916-125540-setup-selftest-full.log |
| Web access | YES | .uxprogram/logs/20260916-125302-probe-web-access.log |
| Image viewing | YES | Antigravity multimodal artifact image inspection |
| Subagent tool | YES | Antigravity invoke_subagent |

## Detected config values
| Key | Value | Source |
|---|---|---|
| PROJECT_NAME | confession | package.json |
| PROJECT_TYPE | social | README.md, docs/SPEC-week3-web.md |
| PLATFORMS | web | package.json (Next.js 15, React 19) |
| AUDIENCE | adults | README.md, terms |
| LANGUAGES | ar, en | app/layout.tsx, src/terms.ts, globals.css |
| COPY_VOICE | plain, sincere, discreet Arabic and English | README.md, terms.ts |
| CORE_GOALS | send confession; inbox; mutual reveal; share link; onboarding | routes inventory under app/ |
| APP_URL | http://localhost:3000 | Next.js default port |
