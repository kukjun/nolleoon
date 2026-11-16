# 검증 하네스 실행 근거

## v0에서 유지한 발견

- Node 시험 안의 자식 러너는 NODE_TEST_CONTEXT를 제거해야 독립 TAP을 출력한다.
- 빈 파일도 Node가 암묵적 파일 시험으로 집계하므로 단순 testCount > 0으로 합격시키지 않는다.
- 하네스/출력 검사는 샌드박스나 제품 전체 인수의 대체물이 아니다.

## MVP-03 RED와 변경

기존 runner에 실행불가 blocked, TODO/skip 개수, Playwright JSON 정규화 시험을 추가했을 때 12개 중 3개가 실패했다(종료 코드 1). fake 대역 파일 없는 상태의 단위 시험도 ERR_MODULE_NOT_FOUND로 실패했다. 이후 상태·개수 어댑터와 대역을 구현했다.

기존 v0의 skip·누락 파일 모두 failed 판정을 각각 incomplete·blocked로 구분하도록 시험 기대값을 변경했다. 두 상태 모두 필수 검사의 합격이 아니므로 전체 check는 실패한다. 검증을 성공으로 완화한 것이 아니다.

범위: GetHealth 단위, 실제 Nest HTTP 헬스/404 통합, Chromium에서 React 초기 화면 렌더. SQLite/게임 기능/다인 E2E/실기기/외부 접속은 아직 미구성이다.

정확한 실행별 최종 개수·명령·환경·소스 상태·원격 CI 여부는 작업 이슈/PR과 ignored artifacts/harness 보고서에 기록한다. 문서는 고정된 예전 시험 수를 최신 성공처럼 재사용하지 않는다. 원격 CI는 로컬 결과로 추정하지 않는다.
