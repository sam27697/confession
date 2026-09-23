PROGRAM_STATUS: DONE
SCHEDULE_ROW: -
ROUND: -
TRACK: -
CYCLE: -
STEP: -
SUBSTEP: -
NEXT_ACTION: none. The program is closed and .uxprogram/ is retired from the repository.
WAITING_FOR: none
BRANCH: none
CYCLE_BASE: -
UPDATED: 2026-09-23T12:00:00Z

## Schedule
| Row | Round | Track | Cycle | Status | Closed | Tag |
|---|---|---|---|---|---|---|
| 1 | 1 | A | 1 | CLOSED | 2026-09-16 | ux-A-c1 |
| 2 | 1 | B | 1 | CLOSED | 2026-09-17 | ux-B-c1 |
| 3 | 1 | C | 1 | CLOSED | 2026-09-17 | ux-C-c1 |
| 4 | 1 | D | 1 | CLOSED | 2026-09-17 | ux-D-c1 |
| 5 | 2 | A | 2 | CLOSED | 2026-09-17 | ux-A-c2 |
| 6 | 2 | B | 2 | CLOSED | 2026-09-17 | ux-B-c2 |
| 7 | 2 | C | 2 | CLOSED | 2026-09-17 | ux-C-c2 |
| 8 | 2 | D | 2 | CLOSED | 2026-09-17 | ux-D-c2 |
| 9 | 3 | A | 3 | CLOSED | 2026-09-17 | ux-A-c3 |
| 10 | 3 | B | 3 | CLOSED | 2026-09-21 | ux-B-c3 |
| 11 | 3 | C | 3 | NOT-NEEDED | 2026-09-23 | - |
| 12 | 3 | D | 3 | NOT-NEEDED | 2026-09-23 | - |
| F | F | ALL | F | NOT-NEEDED | 2026-09-23 | - |

Status values: TODO, IN-PROGRESS, CLOSED, NOT-NEEDED, ESCALATED.

## Open notes (latest review of the current cycle)
S0: 0 | S1: 0 | S2: 0 | S3: 0

## Escalations
none

## Note on row 10
B3 was left mid-flight on 2026-09-18 with T01 to T03 committed and no cycle
documents. It was finished and closed on 2026-09-21: T04 implemented, T05
spiked and dropped, two defects in the earlier tasks repaired (5 em-dashes that
the authorship gate bans, and the deleted /sent no-veil comment), and the step
8 to 13 records written. See 13_close.md.

## Program close, 2026-09-23
Closed by the owner's decision after row 10. Rows 11, 12 and F were never
started and are marked NOT-NEEDED, not failed. The weak area row 11 was meant
for (effort on the compose path) and the integration concerns row F was meant
for were taken up outside the program by docs/SPEC-week15-service-softening.md,
which also found and fixed a regression the program's own gates did not catch:
the week 12 spotlight overlay buried every focused field that was not inside a
.card. The 16 dispatch files left PENDING, and the 2 B3 dispatch files that
never had a status, are marked CLOSED; their cycles closed without the dispatch
record being updated.

What the repository keeps: tokens.md and human_checklist.md move to docs/, the
authorship check moves to scripts/, and everything else in this directory is
removed in the next commit. The full record stays reachable in git history and
through the ux-* tags, e.g. `git show ux-B-c3:.uxprogram/decisions.md`.
