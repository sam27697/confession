# Test report B1 v1
TESTER: R4
FRESHNESS: .uxprogram/logs/20260916-210140-b1-freshness-check.log
PAIRWISE_GENERATOR: .uxprogram/logs/20260916-210331-b1-pairwise-generator.log

## Matrix
| Cell | Tier | Target | Condition | Status | Evidence | Note |
|---|---|---|---|---|---|---|
| T1-001 | T1 | /inbox | 390x844 mobile dark RTL | PASS | .uxprogram/logs/20260916-202529-b1-t02-checks-after.log | |
| T1-002 | T1 | /c/[slug] | 390x844 mobile dark RTL | PASS | .uxprogram/logs/20260916-205358-b1-t04-checks-after.log | |
| T1-003 | T1 | /offer/[offerId] | 768x1024 tablet dark RTL | PASS | .uxprogram/logs/20260916-202529-b1-t02-checks-after.log | |
| T1-004 | T1 | /sent | 1440x900 desktop dark RTL | PASS | .uxprogram/logs/20260916-202529-b1-t02-checks-after.log | |
| T2-001 | T2 | Design tokens adoption | 7 token categories codified in tokens.md | PASS | .uxprogram/logs/20260916-201404-b1-t01-checks-after.log | |
| T2-002 | T2 | Card surface hierarchy | Layered depth across inbox and outbox | PASS | .uxprogram/logs/20260916-202529-b1-t02-checks-after.log | |
| T2-003 | T2 | Button press scale | Tactile press-scale transform with --press-scale | PASS | .uxprogram/logs/20260916-203917-b1-t03-checks-after.log | |
| T2-004 | T2 | High-contrast focus rings | 4px citron focus ring --ring-focus on active controls | PASS | .uxprogram/logs/20260916-203917-b1-t03-checks-after.log | |
| T2-005 | T2 | Arabic typographic rhythm | Tuned 1.75 line-height --lh-body and speech notch | PASS | .uxprogram/logs/20260916-205358-b1-t04-checks-after.log | |
| T3-001 | T3 | Reduced motion accessibility | --press-scale clamped to 1 under reduced motion | PASS | .uxprogram/logs/20260916-203917-b1-t03-checks-after.log | |
| T3-002 | T3 | Zero external network fonts | System Arabic font with zero remote assets | PASS | .uxprogram/logs/20260916-201404-b1-t01-checks-after.log | |
| T3-003 | T3 | Haptic vibration fallback | Graceful degradation without throw on iOS Safari | PASS | .uxprogram/logs/20260916-205917-b1-t05-spike-measure.log | |
| T3-004 | T3 | Compose form contracts | Zero em-dashes and preserved field name 'body' | PASS | .uxprogram/logs/20260916-205358-b1-t04-checks-after.log | |
| T4-001 | T4 | Full test suite | 274 automated tests across all domain and UI layers | PASS | .uxprogram/logs/20260916-205404-b1-t04-gate.log | |
| T4-002 | T4 | Project gate pipeline | gate.ps1 full verification pipeline | PASS | .uxprogram/logs/20260916-205404-b1-t04-gate.log | |
| T4-003 | T4 | Negative space scan | negative_space.py against cycle base | PASS | .uxprogram/logs/20260916-205751-b1-t04-negative-verify.log | |
| T4-004 | T4 | Authorship scan | authorship_scan.py against cycle base | PASS | .uxprogram/logs/20260916-205757-b1-t04-authorship-verify.log | |
| T4-005 | T4 | Physical feel and contrast | Visual depth and focus indicators on OLED devices | HUMAN | .uxprogram/human_checklist.md | human_checklist.md item HC-07 |

## Notes
| ID | Sev | Where | Finding | Measured | Evidence |
|---|---|---|---|---|---|

## Metrics after
| Metric | Baseline | Previous cycle | Now | Evidence |
|---|---|---|---|---|
| Design tokens contract documentation | missing | missing | codified v1 (7 categories) | .uxprogram/logs/20260916-201404-b1-t01-checks-after.log |
| Card surface elevation consistency | partial | partial | 100% unified token depth | .uxprogram/logs/20260916-202529-b1-t02-checks-after.log |
| Button tactile active micro-states | 0% | 0% | 100% (--press-scale .97) | .uxprogram/logs/20260916-203917-b1-t03-checks-after.log |
| High-contrast accessible focus rings | 0% | 0% | 100% (--ring-focus 4px) | .uxprogram/logs/20260916-203917-b1-t03-checks-after.log |
| Arabic typographic line-height compliance | 1.65-1.70 | 1.65-1.70 | 1.75 (--lh-body) | .uxprogram/logs/20260916-205358-b1-t04-checks-after.log |
