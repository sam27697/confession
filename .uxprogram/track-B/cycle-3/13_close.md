# Close B3
## Summary (at most 10 lines)
Track B (UI visual and interaction design) cycle 3 gave the app one focus indicator, one luminous compose state, atmospheric empty states, and a class layer with no raw colour, blur or tap literal left in it.
Shipped the signature element as a single global :focus-visible rule: a 2px citron outline held 2px off the control over a --ground-deep separation band and an 8px glow, so every interactive element gained a visible focus at once instead of component by component.
Shipped the compose well on /c/[slug] answering focus with an inset citron border and a 16px inner wash, timed on --dur-hover and --ease-standard, with field-sizing untouched so nothing shifts.
Shipped citron radial vignettes on the empty states of /inbox and /sent with a codified hairline.
Shipped a token audit: 20 white-overlay literals, 14 backdrop blurs and 2 tap targets became 14 named tokens, in a :root block of this app's own below the design-of-record mirror, with every rendered value unchanged to the byte.
Spiked an interactive parallax stardust canvas and dropped it: 0.1211 ms of script per frame is affordable, but it would have made /sent a hydrating client route for a decoration and run a loop forever on the screen most likely to be left open.
Repaired two defects the earlier tasks left: five em-dashes the authorship gate bans outright, and the deleted comment carrying spec section 3.5's "No veil, no glow" for /sent.
The cycle had been left mid-flight on 2026-09-18 after T03's checks, with no task results and no documents from step 8 on; those are written here and marked as written after the fact.
All 22 acceptance checks of this cycle and all 415 in the suite pass, and the full project gate is green on all six checks.

## Metrics
| Metric | Baseline | Best before | Now | Ratchet | Evidence |
|---|---|---|---|---|---|
| Interactive elements with a high-contrast focus indicator | browser default | browser default | every one, from a single rule | PASS | .uxprogram/logs/20260917-211022-b3-t01-checks-pass.log.log |
| Raw white-overlay literals in the class layer | 20 | 20 | 0 | PASS | .uxprogram/logs/20260921-125732-b3-close-tokens-scan.log |
| Raw backdrop blur literals in the class layer | 14 | 14 | 0 | PASS | .uxprogram/logs/20260921-125732-b3-close-tokens-scan.log |
| Token adoption, cycle scanner | 47.9% | 48.1% | 50.3% | PASS | .uxprogram/logs/20260921-125732-b3-close-tokens-scan.log |
| Token adoption, test/27 ratio | - | 64.7% | 67.4% | PASS | .uxprogram/logs/20260921-125704-b3-gate.log |
| CSS variables defined | 153 | 153 | 167 | PASS | .uxprogram/logs/20260921-125732-b3-close-tokens-scan.log |
| Client components | 5 | 5 | 5 | PASS | .uxprogram/logs/20260921-125520-b3-t05-spike-measure.log |
| Effort, all five core flows | 13.60 / 2.55 / 4.25 / 3.05 / 3.05 s | same | unchanged | PASS | .uxprogram/logs/20260921-125728-b3-effort.log |
| Total automated test suite pass count | 240 | 388 | 415 | PASS | .uxprogram/logs/20260921-125704-b3-gate.log |
| Project gate status | PASS | PASS | PASS | PASS | .uxprogram/logs/20260921-125704-b3-gate.log |

## Tasks shipped
- B3-T01: Unified high-contrast double-ring focus halo with offset token (commit 82da559, Signature Element)
- B3-T02: Luminous compose well focus elevation with concentric inner glow on /c/[slug] (commit 0a7c3fb)
- B3-T03: Atmospheric citron-wash vignette framing on the empty states of /inbox and /sent (commit 0202f65, with fix 28324d4)
- B3-T04: Frost, blur and compact-tap literals codified as tokens (commit 64c588d)

## Spikes and verdicts
- B3-T05: Interactive parallax stardust starfield canvas, commit cad1c86, preserved as tag ux-spike-B-c3-stardust. Verdict: DROP. Measured against the identical page without the canvas: 0.1211 ms of script per frame, 0.73% duty cycle, 60.1 fps with no drops, JS heap delta below granularity. The frame cost is affordable. What is not is the bundle line: /sent carried no client component at all and this makes it a hydrating client route (160 B to 927 B, first load 103 kB to 104 kB) to carry a decoration, on the one screen whose entire message is that there is nothing here yet. The pure-CSS vignette from B3-T03 gives the same depth for no bytes and no frames, which is this task card's own DROP criterion.

## Deferred notes and where they went
- none. 0 open, 0 reopened, 0 deferred.

## Decisions
- D-010: Focus B3 on unified focus indicators, luminous compose well, and atmospheric empty-state depth, without expanding client JavaScript.
- D-011: The empty state of /sent keeps its citron vignette and the departure from spec section 3.5 is written above the rule and recorded, rather than left silent.

## Lessons
- authorship_scan.py bans the em-dash and any model-name or Co-Authored-By trailer, and it runs inside the project gate. Two tasks in this cycle shipped five em-dashes; the cycle could not have closed until they were repaired. Check the diff for the character before committing.
- A check that asserts a CSS value by searching app/globals.css for a literal string breaks the moment that value is tokenised, although nothing rendered changes. Four checks from three earlier cycles did. Assert `(?:44px|var\(--tap-compact\))`, the shape test/56 and test/58 already used.
- App-level tokens belong in a :root block below the `tokens/base.css` marker, annotated `@kind`. The five blocks above it are byte-identical to the design of record and test/62 now asserts that directly.
- A spike's real cost is not always the one its measurement plan names. The stardust canvas was to be judged on frame latency and battery, and it passed on both; it was dropped on a bundle line nobody had listed, because it would have turned a zero-JS route into a hydrating one.
- When a task bends a rule in the design of record, the comment carrying that rule is the last thing to delete. B3-T03 deleted it in the same edit that bent it, which is how the contradiction survived a checks-pass run.

## Close gate logs
- Scope check: .uxprogram/logs/20260921-125732-b3-close-scope.log
- Authorship scan: .uxprogram/logs/20260921-125704-b3-gate.log
- Negative space: .uxprogram/logs/20260921-125650-b3-close-negative.log
- Token scan: .uxprogram/logs/20260921-125732-b3-close-tokens-scan.log
- Effort: .uxprogram/logs/20260921-125728-b3-effort.log
- Project gate: .uxprogram/logs/20260921-125704-b3-gate.log
