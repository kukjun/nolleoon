# TRAVEL-14 · 제비 미공개 10분 이탈 정책

목표: 영속 여행방용 순수 수명 정책과 공개 projection을 분리한다. legacy room/party 수명, 운영 DB 및 API는 변경하지 않는다.

확정: 사전 배정 자기 제비, 미공개 연결끊김 10분 도달 시 incomplete, 자동 공개/재배정 금지, 공개분만 이력, 새 판은 새 ID/배정. offline만으로 여행방 membership을 제거하지 않는다.

미정: 명시적 탈퇴/추방 시점은 정책결정 전 fail-closed. 순수 모듈은 해당 경우 blocked 반환, 임의 종료나 restart 허용을 하지 않는다.

검증: 9:59 복귀/10:00, deadline 선행 reveal 경계, 중복 timeout/여러 이탈, 완료/미완료 고정, 공개 projection allowlist. 실제 SQL 경합·HTTP/로그/HTML·새 ID 배정은 새 travel adapter 통합 후 별도 검증한다. 이 작업만으로 #131 완료 아님.

실행: 구현 전 import module missing RED. 구현 후 contracts/API build 및 policy5개+기존allocation2개=7/7 PASS. 첫 ESLint의 structuredClone 전역오류를 globalThis로 명시 후 대상 lint PASS. 이 경계 검사는 순수 입력 기반이며 실제 접속 복귀 업데이트보다 만료 판정을 먼저 적용하는 API/SQL transaction 검증은 다음 단계다.

## 실제 game engine 연결 준비
`TravelTeamEngine`/`TravelDrawEngine`는 공통 `TravelGameEngine` port를 구현한다. start에서 기존 배정 도메인을 재사용하고 state에만 private allocations를 둔다. project는 필드 allowlist와 persisted revealedIds로 공개값만 반환한다. 일반 결과의 현재 여행멤버 권한, 참가자 동결, 멱등 receipt, SQL transaction은 generic travel service 책임이다.

제비 command는 `{kind:'reveal'}`뿐이며 대상 membershipId를 받아 타인을 뒤집는 경로가 없다. generic service는 maintain을 요청 전 별도 커밋하여 deadline 도달이 실패한 flip rollback으로 취소되지 않도록 해야 한다. presence 갱신 전 timeout을 적용하고 missing/current:false 미공개 대상은 정책 미정 blocked로 처리한다. terminal maintain은 null이므로 기존 endedAt을 덮어쓰지 않는다.

engine4개+policy5개+기존allocation2개=11/11 PASS, API build 및 대상 ESLint PASS. 구현 전 engine module missing RED. foundation이 참조한 account-auth port 의존 두 커밋을 별도 수용해 빌드했고 auth 구현은 변경하지 않았다. 전체 API/DB/history race는 generic service 통합 후 아직 검증 필요.

입력 호환 수정: 500개 emoji가 JS UTF-16 .length 때문에 거절되는 unit RED를 확인했다. 기존 제비처럼 Unicode code point 수500 기준과 줄바꿈/CR/tab 제외 Cc/Cf 거절을 적용했다. unit engine5개 PASS. 실제 HTTP 팀/제비 검증은 별도 추가 중이며 generic pre-touch timeout 결함을 10분 복귀 GET에서 재현했다.

## 실제 HTTP / SQLite 검증
새 독립 fixture는 임시 파일 DB, 합성 account/session, 실제 Nest controller + TravelRuns + 실제 두 엔진을 사용한다. 공급자 OAuth 로그인을 검증하는 fixture가 아니며 외부 서비스·운영에는 접속하지 않는다.

신규 HTTP 3개 PASS(290ms): 팀 균형/동일 start request 동시 멱등/현재 미참가 멤버 조회/외부·퇴장403/DB재시작; 제비 9:59와10:00 복귀/실제 만료·종료후flip409/공개분 이력/멤버십4명유지/새runID와 새N배정; 동시다른flip1성공1CAS충돌/재시도 전원공개 정확N당첨/재시작결과 보존. API 응답에 allocations/winning 내부필드가 없음을 검사한다.

처음 실제HTTP timeout 시험은 b의10분복귀 GET에서 active 반환 RED였다. generic19f990b pre-touch 수정(선행4b9cd2e 포함) 반영 후 동일 시험 GREEN. 충돌시 임의 해결하지 않고 cherry abort 뒤 누락 선행을 적용했다. API build와 추가시험 scopedlint PASS. 전체 하네스·UI/HTML·로그의 exhaustive 누출검사는 이 단계에서 미실행이다.

독립리뷰 수정: 미시작 제비 draft 취소에서 `incomplete + 빈 allocations`를 실제 시작판처럼 검증하여 cancel409/rollback하는 HTTP RED를 재현했다. 미시작 취소의 빈 allocations/reveals/endedAt 상태만 안전한 빈 projection으로 허용한다. active 또는 공개표가 있는데 배정이 비어있는 상태는 계속 거절한다. 취소 뒤 새 판 생성·현재 미참가 멤버의 취소 이력 조회까지 실제HTTP GREEN. engine6+HTTP4=10/10 PASS, API build·대상lint PASS.
