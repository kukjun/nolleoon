# UI hierarchy v2 · #217–220

Status: implementation and local verification complete; draft review candidate. Base 7e5af66; separate worktrees preserve all existing login/production state.

## Approved scope
Participant-first lobby, one game-choice primary action, secondary invitation and overflow management/history; clearer game choice/setup hierarchy; one start action; result acknowledgment and local lobby navigation without mutating the game. Keep current web palette and semantic role permissions. Room administrator, run facilitator and defendant remain distinct.

## Verification
TDD and feature regression; 320×568/390×844 and text scale 1.6/2.0 with long valid synthetic Korean labels. Include cancel/back, stale state, repeated action, no unintended command on result navigation. Add facilitator/nonparticipant/transfer pre-vote tests where feasible. Accessibility guideline checks supplement rather than replace OS assistive-technology validation.

Use current Flutter/Node toolchain in isolated worktrees; no production database, Kakao console, credentials, signed-in app replacement or deployment. Findings outside UI scope become explicit follow-up issues, not silent rule changes.

## Evidence and publication
Draft PR stacked on #216. Independent exact-commit review and correction. Append new timestamped dataset and manifest, preserve prior records unchanged; captured-candidate is not user design approval. No copyrighted reference screenshots/assets in the public repo. Remote CI and physical-device results must be reported separately.

## Completion evidence

Implementation and independent source/visual review are complete as a review candidate in draft PR #221, not a production release or user design acceptance. #217–220 remain open pending the established PR review/merge workflow.

- Integrated Flutter suite: 291 tests passed; analyzer clean. Server build passed and the trial facilitator transfer HTTP integration test passed (1). Native visual comparison tool self-tests passed (5), including intentional pixel change detection and restored equality.
- Final independent review covered integrated source `d5cc511`, six actual PNGs, 6/6 image hashes, source/fixture equivalence and the unchanged prior #216 archive tree. No blocking findings.
- New append-only evidence: `docs/ui-snapshots/2026-11-19T15-48-56+0900/`. Six 390×844 synthetic widget scenes; prior web/before references are historical, not newly captured. Capture source `3f57d00` and integrated equivalent fixture commit `34115bc` are explicitly distinguishable.
- 320×568 / 390×844, text scales 1.6/2.0 and long synthetic Korean are widget/accessibility-test evidence, not additional screenshots or physical-device verification.
- Remote CI, actual mobile OS assistive technology and user visual approval remain unverified. Existing production, logged-in native app, credentials and database were not changed. Existing proposed golden files were not refreshed or made a required gate.
