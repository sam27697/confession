PROJECT_NAME: confession
PROJECT_TYPE: social
PLATFORMS: web
AUDIENCE: adults
LANGUAGES: ar, en
COPY_VOICE: plain, sincere, discreet Arabic and English; confidential and respectful
CORE_GOALS: send an anonymous confession; view received confessions in inbox; mutual reveal offer and response; share confession link on social media; onboarding and terms acceptance
FROZEN: business logic, API contracts, data models (src/schema.ts, drizzle/*), database constraints and triggers (drizzle/0001_constraints.sql), auth and privacy tripwires (test/02-tripwire-columns.test.ts, no surveillance columns, no sender identity exposure)
BRAND_LOCKS: confession — مصارحة, anonymous brand identity
APP_URL: http://localhost:3000
RUN_NOTES: Needs SESSION_SECRET; ALLOW_DEV_LOGIN=1 enables local dev/test login
TEST_ACCOUNTS: dev login test accounts (ALLOW_DEV_LOGIN=1)
DISPATCH: subagent
PARALLEL: no
PUSH: no
MAX_ROUNDS: 5
