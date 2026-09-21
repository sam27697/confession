# Test report C2 v1
TESTER: R4
FRESHNESS: .uxprogram/logs/20260917-115049-c2-freshness.log
PAIRWISE_GENERATOR: .uxprogram/logs/20260917-121020-c2-test-report.log.log

## Matrix
| Cell | Tier | Target | Condition | Status | Evidence | Note |
|---|---|---|---|---|---|---|
| T1-001 | T1 | /c/[slug] | 390x844 mobile dark RTL adaptive compose textarea auto-expansion | PASS | .uxprogram/logs/20260917-115957-c2-t01-checks-pass.log.log | |
| T1-002 | T1 | /c/[slug] | 390x844 mobile dark RTL 1-tap starter chips zero-keystroke population | PASS | .uxprogram/logs/20260917-120146-c2-t02-checks-pass.log.log | |
| T1-003 | T1 | /sent | 390x844 mobile dark RTL 1-tap outbox copy button with toast feedback | PASS | .uxprogram/logs/20260917-120356-c2-t03-checks-pass.log.log | |
| T1-004 | T1 | /offer/[offerId] | 390x844 mobile dark RTL contextual mutual reveal response starters | PASS | .uxprogram/logs/20260917-120545-c2-t04-checks-pass.log.log | |
| T2-001 | T2 | field-sizing CSS | field-sizing: content with min-height (120px) and max-height (480px) | PASS | .uxprogram/logs/20260917-115957-c2-t01-checks-pass.log.log | |
| T2-002 | T2 | Starter chip type="button" | Chips prevent accidental form submission inside compose form | PASS | .uxprogram/logs/20260917-120146-c2-t02-checks-pass.log.log | |
| T2-003 | T2 | Outbox clipboard write | Clipboard API write with fallback to execCommand copy | PASS | .uxprogram/logs/20260917-120356-c2-t03-checks-pass.log.log | |
| T2-004 | T2 | Offer answer population | Starter prompts populate senderAnswer without submitting form | PASS | .uxprogram/logs/20260917-120545-c2-t04-checks-pass.log.log | |
| T3-001 | T3 | Touch target sizing | Prompt chips and copy buttons respect >= 40px/44px touch targets | PASS | .uxprogram/logs/20260917-120146-c2-t02-checks-pass.log.log | |
| T3-002 | T3 | Responsive layout | Wrap flex containers prevent horizontal scroll on narrow mobile screens | PASS | .uxprogram/logs/20260917-120146-c2-t02-checks-pass.log.log | |
| T3-003 | T3 | Predictive Arabic spike | Spike measured at 0.022ms latency and 2.03KB size on dedicated branch | PASS | .uxprogram/logs/20260917-120640-c2-t05-spike-measure.log.log | |
| T4-001 | T4 | Full test suite pass | 353 automated tests pass with 0 regressions | PASS | .uxprogram/logs/20260917-121020-c2-test-report.log.log | |
| T4-002 | T4 | Scope check | scope_check.py against base 562662a passes (8 files, 417 lines) | PASS | .uxprogram/logs/20260917-122020-c2-close-scope.log.log | |
| T4-003 | T4 | Authorship scan | authorship_scan.py against base 562662a passes (0 AI tells) | PASS | .uxprogram/logs/20260917-122020-c2-close-authorship.log.log | |
| T4-004 | T4 | Negative space scan | negative_space.py against base 562662a passes (0 warn) | PASS | .uxprogram/logs/20260917-122021-c2-close-negative.log.log | |
| T4-005 | T4 | Project gate | Full gate (build, lint, tests, ux-checks, probe, authorship, negative) | PASS | .uxprogram/logs/20260917-121656-c2-gate.log.log | |
| T4-006 | T4 | Human checklist verification | HC-19, HC-20, HC-21, HC-22 evaluated | HUMAN | .uxprogram/human_checklist.md | HC-19..22 |

## Notes
| ID | Sev | Where | Finding | Measured | Evidence |
|---|---|---|---|---|---|

## Metrics after
| Metric | Baseline | Previous cycle | Now | Evidence |
|---|---|---|---|---|
| Confession compose keystrokes | 40 | 40 | 1 | .uxprogram/logs/20260917-120146-c2-t02-checks-pass.log.log |
| Confession compose effort (KLM) | 13.60s | 13.60s | 4.50s | .uxprogram/track-C/cycle-2/01_explore.md |
| Outbox message copy gestures | 3 (press-select-copy) | 3 | 1 tap | .uxprogram/logs/20260917-120356-c2-t03-checks-pass.log.log |
| Textarea inner vertical scroll on 100+ chars | 100% | 100% | 0% | .uxprogram/logs/20260917-115957-c2-t01-checks-pass.log.log |
| Total automated test suite pass count | 240 | 338 | 353 | .uxprogram/logs/20260917-121020-c2-test-report.log.log |
| Project gate status | PASS | PASS | PASS | .uxprogram/logs/20260917-121656-c2-gate.log.log |
