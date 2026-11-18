# Travel deletion and redacted-history UI

## Scope and boundaries
Implement the approved distinct account-deletion and room-trash flows. Account removal permanently removes all authors' free text in games the account participated in, plus its identity/photo/authentication. Room deletion immediately denies access, with administrator recovery for seven days. Persistent rooms do not auto-delete for inactivity. No production destructive requests, credentials, deployments, or unresolved active-game/last-admin exceptions are implemented by the UI.

## Acceptance
Explicit warnings and confirmation before mutation; server errors never imply success; deleted-room revision bound to restore request; safe numeric-only redacted cards; abort stale requests/identity loss; mobile readability and keyboard-operable controls.

## Evidence
Synthetic mocked-HTTP browser RED 3 tests before implementation; after implementation 3/3 passed on isolated 4190. A StrictMode cancelled first-load race was found and fixed by generation-aware pending state. Typecheck and scoped lint passed. 320px restore screen captured and visually inspected, with horizontal overflow assertion. API contracts agreed with account/room workers; no real account/room deletion was invoked. Full real API integration remains coordinator's separate verification gate.

## Numeric-only redaction
Unified travel game projection `{kind,redacted:true,summary}` displays only participant count, numeric team sizes, reveal counts, round counts, or response count. It bypasses all old game renderers and never displays identities, avatars, menu names, case/penalty/defense text, or reasons. Null facilitator and empty participant list are accepted only for validated terminal redacted runs. Linked legacy detail uses `redacted` with `party`/`court` null; malformed mixed payloads fail closed.

Validation: positive redacted envelope unit initially failed RED; after implementation scoped UI unit 15/15 passed and mocked browser 30/30 passed, including all four games, hostile old fields, legacy detail, and deletion/restore. Typecheck/scoped lint passed. An overly broad `travel-*` unit glob attempted backend tests before API dist was built and failed on missing compiled modules; not reported as a passed suite. No production deletion requests or push/deploy performed.

## Final self-audit follow-up
- Real integration reported result-from-history returning to history despite its lobby label. Reproduced with UI RED; return now clears playing/history/setup state and reloads the actual lobby.
- Hardened numeric redacted DTO with exact key allowlists at top-level, summary, team/reveal/round rows. Unknown identity/text fields now reject the response rather than merely ignoring them. Numeric happy-path fixture no longer contains intentionally invalid extras; explicit validator tests cover hostile extras.
- Self-audit (not an independent review of my own code): completed-history back flow, account cancel clears typed consent without mutation, pending confirmation disabled/one request, server failure retains signed-in state, room cancel/restore path. 31 mocked browser cases passed, then an additional pending-confirmation case passed separately; unit redaction 3/3, web typecheck and scoped lint passed. Initial fresh unit invocation lacked compiled contracts; built contracts before valid RED rerun. No real destructive request.

## Approved account-deletion policy update
Updated the warning to distinguish other-member administrator transfer from a solo remaining administrator, whose room enters seven-day deletion pending with immediate access denial. Ongoing games no longer blanket-block account deletion: they become incomplete, retain already-public numeric results only, and never reveal unopened draws. The deleted account cannot log back in or recover its room; no automatic membership restoration is promised. Account-specific conflict copy no longer claims ongoing games prohibit deletion; room-deletion guards remain unchanged. All-author free-text erasure and creator-owned cancelled-draft wording are retained.

TDD: new warning assertion failed before change, then all eight deletion-flow mocked browser tests passed on isolated 4190. Web typecheck and scoped lint passed. 320px full-page capture inspected and no-horizontal-overflow assertion passed. Destructive API contracts unchanged; no real account/room mutation or deployment performed.
