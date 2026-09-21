# Test report A2 v1
TESTER: R4
FRESHNESS: .uxprogram/logs/20260917-070348-a2-freshness-check.log
PAIRWISE_GENERATOR: .uxprogram/logs/20260917-070426-a2-pairwise-generator.log

## Matrix
| Cell | Tier | Target | Condition | Status | Evidence | Note |
|---|---|---|---|---|---|---|
| T1-001 | T1 | /inbox | 390x844 mobile dark RTL | PASS | .uxprogram/logs/20260917-064827-a2-t01-checks-pass.log | |
| T1-002 | T1 | /sent | 390x844 mobile dark RTL | PASS | .uxprogram/logs/20260917-064827-a2-t01-checks-pass.log | |
| T1-003 | T1 | /offer/[offerId] | 768x1024 tablet dark RTL | PASS | .uxprogram/logs/20260917-065236-a2-t02-checks-pass.log | |
| T1-004 | T1 | / | 1440x900 desktop dark RTL | PASS | .uxprogram/logs/20260917-065504-a2-t03-checks-pass.log | |
| T1-005 | T1 | /c/[slug] | 390x844 mobile dark RTL | PASS | .uxprogram/logs/20260917-065829-a2-t04-checks-pass.log | |
| T2-001 | T2 | /inbox nav flow | fast touch first_time empty idle | PASS | .uxprogram/logs/20260917-064827-a2-t01-checks-pass.log | |
| T2-002 | T2 | /sent nav flow | fast touch returning typical success | PASS | .uxprogram/logs/20260917-064827-a2-t01-checks-pass.log | |
| T2-003 | T2 | /offer/[offerId] exit flow | fast touch returning typical idle | PASS | .uxprogram/logs/20260917-065236-a2-t02-checks-pass.log | |
| T2-004 | T2 | / discovery walk flow | fast touch first_time typical idle | PASS | .uxprogram/logs/20260917-065504-a2-t03-checks-pass.log | |
| T2-005 | T2 | /c/[slug] compose flow | fast touch first_time empty idle | PASS | .uxprogram/logs/20260917-065829-a2-t04-checks-pass.log | |
| T3-001 | T3 | /inbox app-nav active state | aria-current='page' and active token | PASS | .uxprogram/logs/20260917-064827-a2-t01-checks-pass.log | |
| T3-002 | T3 | /offer/[offerId] non-destructive back | anchor outside form blocks | PASS | .uxprogram/logs/20260917-065236-a2-t02-checks-pass.log | |
| T3-003 | T3 | / home discovery steps | step badges and Levantine copy | PASS | .uxprogram/logs/20260917-065504-a2-t03-checks-pass.log | |
| T3-004 | T3 | /c/[slug] compose constraint | minLength feedback and aria-live | PASS | .uxprogram/logs/20260917-065829-a2-t04-checks-pass.log | |
| T4-001 | T4 | Full test suite | 322 automated tests across all domain/web routes | PASS | .uxprogram/logs/20260917-070120-a2-t04-gate.log | |
| T4-002 | T4 | Negative space | negative_space.py against cycle base | PASS | .uxprogram/logs/20260917-070052-a2-step10-negative.log | |
| T4-003 | T4 | Authorship scan | authorship_scan.py against cycle base | PASS | .uxprogram/logs/20260917-070042-a2-step10-authorship.log | |
| T4-004 | T4 | Scope check | scope_check.py against cycle base | PASS | .uxprogram/logs/20260917-070034-a2-step10-scope.log | |
| T4-005 | T4 | Visual comfort and wayfinding | human checklist evaluation of app-nav and discovery | HUMAN | .uxprogram/human_checklist.md | human_checklist.md item HC-01 |

## Notes
| ID | Sev | Where | Finding | Measured | Evidence |
|---|---|---|---|---|---|

## Metrics after
| Metric | Baseline | Previous cycle | Now | Evidence |
|---|---|---|---|---|
| Navigation depth between inbox and outbox | infinity (missing link) | infinity | 1 tap (app-nav) | .uxprogram/logs/20260917-064827-a2-t01-checks-pass.log |
| Non-destructive offer exit path | absent (forced decision) | absent | 1 tap (الرجوع للمرسلة) | .uxprogram/logs/20260917-065236-a2-t02-checks-pass.log |
| Unauthenticated home value discovery | unstyled raw text | unstyled raw text | 3-step feature walk | .uxprogram/logs/20260917-065504-a2-t03-checks-pass.log |
| Proactive compose constraint guidance | absent | absent | live guidance pill | .uxprogram/logs/20260917-065829-a2-t04-checks-pass.log |
| Total automated test suite pass count | 240 | 306 | 322 | .uxprogram/logs/20260917-070120-a2-t04-gate.log |