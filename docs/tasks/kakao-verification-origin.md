# Registered-ID verification origin/storage mode

상태: 검증

## 목표와 범위
Explicit debug-only Kakao verification mode for registered application ID, loopback API only, and separate production/synthetic/verification secure-store keys. Scope: Dart shared origin policy and tests. Platform parser/ID guards are a separate worker's change. No real SDK login, private credential-file reads, or deployment.

## 미결정과 가정
Actual platform + server + provider flow is a later handoff. Library policy alone does not prove Kakao setup. Ordinary builds/auth defaults remain unchanged.

## 합격 기준
Modes mutually exclusive; absent/invalid local destination never falls back; verification origin cannot be public; release/profile cannot use it. All three storage namespaces remain independent and clear does not affect another namespace.

## 실행과 증거
RED: verificationBuild constructor absent (2 test files failed compilation).
GREEN: focused 4 tests include actual host-loopback sockets and namespace isolation. Compile-time verification mode exercises real host-socket auth/rooms/avatar paths with synthetic values only; conflicting flags fail closed. Final suite results below.

## 회고
Using the registered package ID must not imply permission to reuse its production secure storage. The credential namespace is independently bound to verification mode and origin.

Final: full Flutter **275 passed**, zero failures (17s); analyze no issues (2s). Additional compile-time verification socket test **1 passed** and conflicting-flags test **1 passed**. No actual provider/network credential test was run. `git diff --check` clean.

### Verification UI safety follow-up
- Permanent verification-mode banner explicitly identifies local test scope and unsupported account deletion/unlink.
- Account-deletion entry is hidden; AuthGate rejects entry; repository rejects execution before generating/persisting a receipt or issuing a request. This avoids a forbidden server response leaving a real-account verification session stuck with pending deletion state.
- Widget regression RED (banner absent) → GREEN with signed-in entry absent plus direct repository call receipt writes=0/network calls=0.
- Final full Flutter **276 passed**, analyze clean. Dedicated verification-build UI test **1 passed**. Production/default deletion entry remains tested and unchanged. No real login or deletion attempted.

### Verification banner width fix
- Actual screenshot report reproduced by widget geometry: expected viewport width800, banner actual400.75 (RED).
- Builder Column now stretches both banner and app child; banner is a semantic header/container. Existing readable warning text retained.
- Verification-mode widget GREEN includes full width at800/320/390 and no layout exceptions, no deletion entry/write/network; analyze clean. Actual private-key build and screenshot remain coordinator-owned; no credential file read here.
