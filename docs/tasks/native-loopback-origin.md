# Debug test origin and credential namespace isolation

상태: 검증

## 목표와 범위
Explicit debug-only loopback origin for all native JSON/auth/avatar flows; preserve production destination and secure storage keys. No platform permissions/network settings, actual provider credentials, backend deployment, or production changes.

## 미결정과 가정
Actual Android/iOS local-network capability is not proven. Platform test package isolation is a separate worker's change. No automatic adb reverse or ATS/cleartext bypass.

## 합격 기준
Strict build configuration and literal loopback allowlist; independent transport destination validation; no redirects or production fallback; session/receipt origin namespaces never read/delete production or another port's data. Existing Flutter regression suite preserved.

## 실행과 증거
- RED: new origin/constructor contract absent; storage origin constructor absent.
- GREEN: 3 focused socket/namespace tests; compile-time configured auth/room/avatar test 1; missing-origin fail-closed test 1.
- Analyze clean before final full suite. Exact final results appended below.
- Tests use synthetic bearer/receipt values and host HttpServer; no real Kakao or OS secure-store read.

## 회고
API origin DI alone is insufficient: persisted production bearer and deletion receipts must be independently namespaced before any local endpoint is used.

### Final verification
- Full Flutter test suite: **271 passed**, zero failures (18s), final source.
- Separate build-define executions: configured loopback socket **1 passed**; test mode missing origin **1 passed**; malformed flag **1 passed**. Default mode is also included in the 271 suite.
- Final `flutter analyze`: no issues. `git diff --check`: clean.
- This proves host Dart I/O and secure-storage test namespace behavior, not device cleartext/ATS access or real Kakao readiness.
