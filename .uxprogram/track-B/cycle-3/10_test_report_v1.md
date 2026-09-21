# Test report B3 v1
TESTER: R4
FRESHNESS: .uxprogram/logs/20260917-205928-b3-freshness.log.log
GATE: .uxprogram/logs/20260921-125704-b3-gate.log

## Matrix
| Cell | Tier | Target | Condition | Status | Evidence | Note |
|---|---|---|---|---|---|---|
| T1-001 | T1 | every screen | 390x844 mobile dark RTL, keyboard focus on button, link, input and chip shows the citron double-ring halo | PASS | .uxprogram/logs/20260917-211022-b3-t01-checks-pass.log.log | |
| T1-002 | T1 | /c/[slug] | 390x844 mobile dark RTL, textarea focus lights the inner border and wash with no layout shift | PASS | .uxprogram/logs/20260918-044606-b3-t02-checks-pass.log.log | |
| T1-003 | T1 | /inbox | 390x844 mobile dark RTL, empty state carries the citron vignette | PASS | .uxprogram/logs/20260918-044833-b3-t03-checks-pass.log.log | pre-existing --veil-citron, preserved |
| T1-004 | T1 | /sent | 390x844 mobile dark RTL, empty state carries the citron vignette and the --line-strong hairline | PASS | .uxprogram/logs/20260918-044833-b3-t03-checks-pass.log.log | D-011 |
| T2-001 | T2 | :focus-visible contract | one global rule, outline plus offset plus separation band, not a per-component ring | PASS | .uxprogram/logs/20260917-211022-b3-t01-checks-pass.log.log | |
| T2-002 | T2 | pointer vs keyboard | a mouse click leaves no persistent halo | PASS | .uxprogram/logs/20260917-211022-b3-t01-checks-pass.log.log | :focus-visible semantics |
| T2-003 | T2 | compose well motion | transition rides --dur-hover and --ease-standard, not a literal duration | PASS | .uxprogram/logs/20260918-044606-b3-t02-checks-pass.log.log | |
| T2-004 | T2 | frost and blur scale | every white-overlay and backdrop-filter value in the class layer is a token | PASS | .uxprogram/logs/20260921-120744-b3-t04-full-suite.log | 20 and 14 literals, both to 0 |
| T2-005 | T2 | design-of-record mirror | the five token blocks above tokens/base.css are untouched | PASS | .uxprogram/logs/20260921-120744-b3-t04-full-suite.log | test/62 AC4 |
| T3-001 | T3 | touch targets | nav tabs and breadcrumb still render 44px, now through --tap-compact | PASS | .uxprogram/logs/20260921-120744-b3-t04-full-suite.log | test/62 pins the token |
| T3-002 | T3 | reduced motion | no new animation; T02's transition rides a token the clamp already pins to 1ms | PASS | .uxprogram/logs/20260921-125704-b3-gate.log | |
| T3-003 | T3 | outline clipping at 390px | offset 2px chosen so the halo does not clip on a narrow viewport | PASS | .uxprogram/logs/20260917-211022-b3-t01-checks-pass.log.log | plan note B3-E01 |
| T3-004 | T3 | stardust canvas spike | 0.1211 ms script per frame, 0.73% duty, 60.1 fps, /sent 160 B to 927 B | PASS | .uxprogram/logs/20260921-125520-b3-t05-spike-measure.log | verdict DROP |
| T4-001 | T4 | full test suite | 415 checks pass, 0 fail, 0 regressions | PASS | .uxprogram/logs/20260921-125704-b3-gate.log | 388 before this cycle |
| T4-002 | T4 | scope check | against cycle base e4a9505: 9 files, 571 lines | PASS | .uxprogram/logs/20260921-125732-b3-close-scope.log | |
| T4-003 | T4 | authorship scan | against base_rev, 0 tells | PASS | .uxprogram/logs/20260921-125704-b3-gate.log | after repair 6f48845 |
| T4-004 | T4 | negative space | 9 files, 571 changed lines, 0 warn | PASS | .uxprogram/logs/20260921-125650-b3-close-negative.log | |
| T4-005 | T4 | project gate | build, lint, tests, probe, authorship, negative space | PASS | .uxprogram/logs/20260921-125704-b3-gate.log | |
| T4-006 | T4 | effort ratchet | all five core flows unchanged from A3 | PASS | .uxprogram/logs/20260921-125728-b3-effort.log | |
| T4-007 | T4 | human checklist | HC-33, HC-34, HC-35, HC-36 | HUMAN | .uxprogram/human_checklist.md | four items open for a person |

## Notes
| ID | Sev | Where | Finding | Measured | Evidence |
|---|---|---|---|---|---|
| B3-TR01 | S1 | test/60, test/61, app/globals.css | five em-dashes, banned by authorship_scan.py | AUTHORSHIP: FAIL, 5 findings | .uxprogram/logs/20260921-124024-b3-t04-authorship.log |
| B3-TR02 | S1 | app/globals.css .sent-empty | veil on /sent against spec section 3.5, and the rule's comment deleted | 2 gradients, 1 comment line | .uxprogram/logs/20260921-125732-b3-close-scope.log |
| B3-TR03 | S2 | test/39, 45, 57, 58 | four checks matched the string "44px" rather than the guarantee | 4 failures on a no-op rendering change | .uxprogram/logs/20260921-120452-b3-t04-checks-pass.log |

All three fixed before this report; the run above is after the fixes.

## Metrics after
| Metric | Baseline | Previous cycle | Now | Evidence |
|---|---|---|---|---|
| Raw white-overlay literals in the class layer | 20 | 20 | 0 | .uxprogram/logs/20260921-125732-b3-close-tokens-scan.log |
| Raw backdrop blur literals in the class layer | 14 | 14 | 0 | .uxprogram/logs/20260921-125732-b3-close-tokens-scan.log |
| Token adoption, cycle scanner | 47.9% | 48.1% | 50.3% | .uxprogram/logs/20260921-125732-b3-close-tokens-scan.log |
| CSS variables defined | 153 | 153 | 167 | .uxprogram/logs/20260921-125732-b3-close-tokens-scan.log |
| Client components | 5 | 5 | 5 | .uxprogram/logs/20260921-125520-b3-t05-spike-measure.log |
| Total tests passing | 240 | 388 | 415 | .uxprogram/logs/20260921-125704-b3-gate.log |
| Project gate status | PASS | PASS | PASS | .uxprogram/logs/20260921-125704-b3-gate.log |
