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
