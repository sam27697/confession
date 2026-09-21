# Close C1
## Summary (at most 10 lines)
Track C (Effort, Ergonomics & Cognitive Load) Cycle 1 eliminated confession composition data loss and mutual reveal friction.
Delivered scoped ephemeral draft auto-persistence in SubmitButton with automatic recovery on page reload or interruption.
Eliminated 100% of accidental draft loss during browser reloads or app switching.
Transformed passive prompt suggestion spans in RevealCard into 1-tap interactive button chips.
Eliminated 40 manual typing keystrokes per mutual reveal inception by directly populating question and stake fields.
Introduced instant status filter tabs in outbox (/sent) enabling one-tap scanning of pending and resolved confessions.
Implemented subtle live saved-state reassurance indicator with zero layout shift and polite screen reader announcements.
Conducted mobile Web Speech API wild spike and recorded an evidence-backed DROP verdict due to third-party privacy leakage.
All 16 acceptance checks and 290 total test suite checks pass cleanly with zero AI authorship tells.

## Metrics
| Metric | Baseline | Best before | Now | Ratchet | Evidence |
|---|---|---|---|---|---|
| Confession draft retention after interruption | 0% | 0% | 100% | PASS | .uxprogram/logs/20260916-213154-c1-t01-checks-after.log |
| Mutual reveal formulation keystrokes | 40 | 40 | 0 | PASS | .uxprogram/logs/20260916-214747-c1-t02-checks-after.log |
| Outbox status filter navigation | missing | missing | 3 status tabs (all/pending/resolved) | PASS | .uxprogram/logs/20260917-011131-c1-t03-checks-after.log |
| Compose live saved-state feedback | missing | missing | polite aria-live indicator | PASS | .uxprogram/logs/20260917-012010-c1-t04-checks-after.log |
| Total test suite pass count | 240 | 274 | 290 | PASS | .uxprogram/logs/20260917-012051-c1-t04-gate.log |
| User effort seconds (offer-mutual-reveal) | 13.60s | 13.60s | 4.25s | PASS | .uxprogram/logs/20260917-012530-c1-review-effort-calc.log |
| Project gate | PASS | PASS | PASS | PASS | .uxprogram/logs/20260917-012051-c1-t04-gate.log |

## Tasks shipped
- C1-T01: Scoped ephemeral draft auto-persistence with interruption recovery on confession compose (commit 076277c)
- C1-T02: 1-tap interactive prompt insertion chips with zero-keystroke population for mutual reveal (commit e1ff9ef)
- C1-T03: Client-side instant status filter tabs with zero-roundtrip pill navigation in outbox (commit 18c41ce)
- C1-T04: Subtle live saved-state reassurance indicator with zero layout shift (commit e62a001)

## Spikes and verdicts
- C1-T05: Spike Web Speech API Arabic voice dictation stream on mobile on branch ux/spike-C-c1-speech (commit 187534c). Verdict: DROP. Web Speech API implementations rely on remote vendor speech recognition servers (Google/Apple), transmitting raw voice audio across external network boundaries in direct violation of the zero-network recipient privacy covenant. Furthermore, mobile browser support is fragmented with 0% Firefox mobile support and permission instability on iOS Safari WebKit. 1-tap prompt chips provide immediate keystroke reduction with absolute zero-network privacy.

## Deferred notes and where they went
- none (0 deferred notes, 0 open notes)

## Decisions
- D-C01: Scoped draft persistence to confession slug in sessionStorage, ensuring private browsing compatibility and clean deletion on delivery.
- D-C02: Implemented 1-tap prompt chips with type="button" and delegated event listener to prevent form submission and preserve server component shells.
- D-C03: Maintained URL-searchParam state (?filter=...) for outbox status tabs to enable bookmarking and shareable filtered views.
- D-C04: Dropped Web Speech API due to external cloud audio transmission conflicting with core privacy invariants.

## Lessons
- Regex-based class coverage tests inspect string literals within JSX className expressions; assigning comparison results to dedicated boolean variables avoids unintended class token matches.
- Client island boundaries can be strictly respected by enhancing existing island components (SubmitButton) rather than proliferating new client components.

## Close gate logs
- Scope check: .uxprogram/logs/20260917-012511-c1-review-scope.log
- Authorship scan: .uxprogram/logs/20260917-012518-c1-review-authorship.log
- Negative space: .uxprogram/logs/20260917-012524-c1-review-negative.log
- Project gate: .uxprogram/logs/20260917-012051-c1-t04-gate.log
