# Test report A1 v1
TESTER: R4
FRESHNESS: .uxprogram/logs/20260916-192915-a1-freshness-check.log
PAIRWISE_GENERATOR: .uxprogram/logs/20260916-192854-a1-pairwise-generator.log

## Matrix
| Cell | Tier | Target | Condition | Status | Evidence | Note |
|---|---|---|---|---|---|---|
| T1-001 | T1 | /inbox | 390x844 mobile dark RTL | PASS | .uxprogram/logs/20260916-161624-a1-t02-checks-verified-clean.log | |
| T1-002 | T1 | /c/[slug] | 390x844 mobile dark RTL | PASS | .uxprogram/logs/20260916-191157-a1-t04-checks-verified-clean.log | |
| T1-003 | T1 | /offer/[offerId] | 768x1024 tablet dark RTL | PASS | .uxprogram/logs/20260916-165504-a1-t03-checks-verified-clean.log | |
| T1-004 | T1 | /sent | 1440x900 desktop dark RTL | PASS | .uxprogram/logs/20260916-153047-a1-t01-checks-pass-clean.log | |
| T2-001 | T2 | /inbox flow | fast touch first_time empty idle | PASS | .uxprogram/logs/20260916-161624-a1-t02-checks-verified-clean.log | |
| T2-002 | T2 | /c/[slug] flow | fast touch first_time typical success | PASS | .uxprogram/logs/20260916-191157-a1-t04-checks-verified-clean.log | |
| T2-003 | T2 | /c/[slug] validation | fast keyboard first_time empty error | PASS | .uxprogram/logs/20260916-191157-a1-t04-checks-verified-clean.log | |
| T2-004 | T2 | /offer/[offerId] flow | fast touch returning typical success | PASS | .uxprogram/logs/20260916-165504-a1-t03-checks-verified-clean.log | |
| T2-005 | T2 | /inbox share flow | offline touch first_time empty fallback | PASS | .uxprogram/logs/20260916-161624-a1-t02-checks-verified-clean.log | |
| T3-001 | T3 | /auth/dev redirection | external protocol injection sanitization | PASS | .uxprogram/logs/20260916-153047-a1-t01-checks-pass-clean.log | |
| T3-002 | T3 | /c/[slug] accessibility | aria-describedby and role=alert focus trap | PASS | .uxprogram/logs/20260916-191157-a1-t04-checks-verified-clean.log | |
| T3-003 | T3 | /inbox share button | clipboard permission denied fallback text | PASS | .uxprogram/logs/20260916-161624-a1-t02-checks-verified-clean.log | |
| T3-004 | T3 | /offer/[offerId] reveal | form action signatures and field name freeze | PASS | .uxprogram/logs/20260916-165504-a1-t03-checks-verified-clean.log | |
| T4-001 | T4 | Full test suite | 259 automated tests across all domain/web routes | PASS | .uxprogram/logs/20260916-190004-a1-t04-full-suite.log | |
| T4-002 | T4 | Project gate | gate.ps1 full verification pipeline | PASS | .uxprogram/logs/20260916-190540-a1-t04-gate.log | |
| T4-003 | T4 | Negative space | negative_space.py against cycle base | PASS | .uxprogram/logs/20260916-191106-a1-t04-negative-verify-clean.log | |
| T4-004 | T4 | Authorship scan | authorship_scan.py against cycle base | PASS | .uxprogram/logs/20260916-191134-a1-t04-authorship-verify-clean.log | |
| T4-005 | T4 | Screen reader announcements | live error and constraint breaches | HUMAN | .uxprogram/human_checklist.md | human_checklist.md item HC-04 |

## Notes
| ID | Sev | Where | Finding | Measured | Evidence |
|---|---|---|---|---|---|

## Metrics after
| Metric | Baseline | Previous cycle | Now | Evidence |
|---|---|---|---|---|
| Unauthenticated sign-in bounce rate | 100% | - | 0% (preserved next param) | .uxprogram/logs/20260916-153047-a1-t01-checks-pass-clean.log |
| First-run link share action steps | 4 clicks | - | 1 tap (Web Share API) | .uxprogram/logs/20260916-161624-a1-t02-checks-verified-clean.log |
| Mutual reveal prompt clarity & commitment | 0 prompts | - | 4 structured prompts | .uxprogram/logs/20260916-165504-a1-t03-checks-verified-clean.log |
| WCAG 3.3.1 error recovery compliance | FAIL | - | PASS | .uxprogram/logs/20260916-191157-a1-t04-checks-verified-clean.log |
