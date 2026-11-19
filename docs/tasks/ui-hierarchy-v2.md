# UI hierarchy v2 · #217–220

Status: implementing. Base 7e5af66; separate worktrees preserve all existing login/production state.

## Approved scope
Participant-first lobby, one game-choice primary action, secondary invitation and overflow management/history; clearer game choice/setup hierarchy; one start action; result acknowledgment and local lobby navigation without mutating the game. Keep current web palette and semantic role permissions. Room administrator, run facilitator and defendant remain distinct.

## Verification
TDD and feature regression; 320×568/390×844 and text scale 1.6/2.0 with long valid synthetic Korean labels. Include cancel/back, stale state, repeated action, no unintended command on result navigation. Add facilitator/nonparticipant/transfer pre-vote tests where feasible. Accessibility guideline checks supplement rather than replace OS assistive-technology validation.

Use current Flutter/Node toolchain in isolated worktrees; no production database, Kakao console, credentials, signed-in app replacement or deployment. Findings outside UI scope become explicit follow-up issues, not silent rule changes.

## Evidence and publication
Draft PR stacked on #216. Independent exact-commit review and correction. Append new timestamped dataset and manifest, preserve prior records unchanged; captured-candidate is not user design approval. No copyrighted reference screenshots/assets in the public repo. Remote CI and physical-device results must be reported separately.
