# Handoff after A2, 2026-09-17
NEXT: row 6, track B, cycle 2

## What changed (one line per task, with its commit)
- A2-T01: Persistent sub-navigation tab bar linking inbox and outbox views (commit 1df8ad5)
- A2-T02: Safe non-destructive return exit and clear danger phrasing on reveal offer (commit 139b3a5)
- A2-T03: 3-step feature discovery walk and value illustration on unauthenticated home (commit 3756745)
- A2-T04: Proactive minimum length guidance pill and dynamic feedback on compose screen (commit aae1775)
- A2-T05: Spike sandboxed guest confession playground simulator (commit e123d4a on ux/spike-A-c2-playground, verdict: DROP)

## Metrics now against baseline and best
| Metric | Baseline | Best | Now |
|---|---|---|---|
| Core view dual-tab wayfinding | 0% | 0% | 100% |
| Offer response non-destructive exit | 0 | 0 | 1 |
| Unauthenticated home onboarding steps | 0 | 0 | 3 steps |
| Compose length feedback indicator | none | none | proactive pill |
| Total automated test suite pass count | 240 | 306 | 322 |
| User effort seconds (send-confession) | 13.60s | 13.60s | 13.60s |

## Weak areas that remain
- Track B (Cycle 2): Screen-level visual craft and motion on core screens; dark mode quality; higher token adoption across the new sub-nav bar, home discovery walk, and compose constraint pill.
- Token adoption is at 60.1%; the new sub-nav bar CSS classes introduced in A2-T01 and compose pill in A2-T04 should be audited against the token system.
- Typography scale on the 3-step discovery cards (A2-T03) uses inline sizes; aligning to the token type scale is deferred to B2.

## Ideas carried forward (top 5 from backlog_ideas.md by score)
- Static CSS Variable Reference Sheet (Score: 3.95) | runner-up for design-tokens B1
- Standard Hover and Focus Outline Styling (Score: 3.75) | runner-up for component-microstates B1
- Flat Border Outlines on Cards (Score: 3.75) | runner-up for card-surface-hierarchy B1
- Standard Rounded Rectangles with Default Line Height (Score: 3.75) | runner-up for arabic-typography-notch B1
- Unified Segmented Control with Real-Time Activity Badge Counters on Inbox and Outbox Tabs | Bold concept from A2 backlog

## Traps: what failed and why
- Playground simulator (A2-T05 spike) violates client component island whitelist in spec 9; test/21-design-system.test.ts item 10b fails on any new client component under app/_components/ without explicit whitelist authorization.
- CSS property declarations inside class rules in app/globals.css must always have matching closing braces to avoid unintended nesting affecting subsequent class definitions.
- Class coverage parity (test/21-design-system.test.ts item 5) requires strict two-way parity: every class in JSX must be in app/globals.css, and every class in app/globals.css must be used in some .tsx file.
- PowerShell Out-File adds a UTF-8 BOM; always use [System.IO.File]::WriteAllText to write .md files without BOM when Python scripts need to parse headings from line 1.

## Claims to verify next session (at least 3, each checkable in the running app)
1. Navigating to /inbox or /sent renders a persistent dual-tab navigation bar with Arabic labels showing the active tab with aria-current=page and an active highlight token.
2. Opening /offer/[offerId] as a logged-in recipient displays a permanent back link to /sent outside the response form, plus a clearly styled danger decline button with irreversible wording.
3. Opening the root path / as an unauthenticated visitor renders exactly 3 numbered discovery steps before the login form, each with a step badge and a distinct mechanic explanation.
