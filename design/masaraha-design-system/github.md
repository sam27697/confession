repo: sam27697/confession
branch: main

## Last sync

date: 2026-09-01T20:00:00Z

### Updated in this project

- Built the full design system from the repo's copy, data model and safety rules (first import).
- Token set replaces the placeholder plum/amber palette with warm charcoal + acid citron + dusty rose.
- Mobile UI kit covers every route in `app/`, including states the repo has no page for yet.
- Admin kit mirrors the 8-character written-reason gate on `/admin/reveal`.

## Screen map

| Project screen | Repo files |
| --- | --- |
| `ui_kits/masaraha_app` Landing | `app/page.tsx`, `app/layout.tsx` |
| `ui_kits/masaraha_app` Onboarding | `app/onboarding/page.tsx`, `src/terms.ts` |
| `ui_kits/masaraha_app` Inbox + offer composer | `app/inbox/page.tsx`, `app/inbox/actions.ts`, `src/views.ts` |
| `ui_kits/masaraha_app` Send page | `app/c/[slug]/page.tsx`, `src/limits.ts`, `src/errors.ts`, `src/slug.ts` |
| `ui_kits/masaraha_app` Sent list | `app/sent/page.tsx`, `src/views.ts` |
| `ui_kits/masaraha_app` Reveal exchange | `app/offer/[offerId]/page.tsx`, `src/views.ts` |
| `ui_kits/masaraha_app` Terms / Privacy | `src/terms.ts`, `app/privacy/page.tsx` |
| `ui_kits/masaraha_app` Account deletion | no repo route yet — brief + `src/terms.ts` clause 6 |
| `ui_kits/masaraha_admin` Login | `app/admin/login/page.tsx` |
| `ui_kits/masaraha_admin` Queue / Reports / Reveal | `app/admin/page.tsx`, `app/admin/reports/page.tsx`, `app/admin/reveal/route.ts`, `src/admin.ts` |
| `brand/share-card.card.html` | `src/share-card.ts` |
| `tokens/*.css` | `app/globals.css` (reference values only — palette replaced) |
