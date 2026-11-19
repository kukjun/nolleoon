# 로컬 실제 검증 runner 준비

- 목표: 별도 새 DB + loopback 한정, 실제 Kakao verifier를 사용할 수 있는 최소 read/create 서버. 실제 계정 로그인은 후속 작업.
- 범위: 독립 runner, 합성 loader/HTTP 회귀, runbook. 기존 합성 runner/앱/운영 서비스 변경 없음.
- TDD: 모듈 부재 RED 1 실패. 구현 후 단건 응답 식별자를 id로 잘못 읽은 시험 실패를 실제 roomId 계약으로 수정했다. app mismatch 오류는 기존 NativeAccountAuth의 TEMPORARILY_UNAVAILABLE(503) 계약으로 검증하며 401로 변경하지 않았다.
- 수용: 명시 실행, 고정 loopback, 안전 설정 읽기, exact route allowlist, 실제 provider 대신 fake fetch 검증, 저장소 종료 후 보존, 비밀 출력 없음.
- 미검증: 실제 설정/토큰/사용자 계정, 실제 provider 네트워크, 실제 모바일 연결, 운영 배포.

- 최종 targeted: API/contracts build PASS, 합성 시험 4/4 PASS, scoped ESLint/diff check PASS. 실제 설정 파일은 읽지 않았다.
