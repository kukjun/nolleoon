# #162 네이티브 BFF 인증 어댑터

상태: 진행

## 목표와 범위
Flutter가 별도 Bearer 세션으로 기존 계정·여행 유즈케이스를 사용한다. `/api/native` 고정 경로는 cookie 인증을 사용하지 않는다. 기존 웹 Origin/CSRF, 게임 규칙, 익명 기록 연결 조건을 유지한다. 실제 제공자 인증·운영 설정·배포는 범위 밖이다.

## 합격 기준
실제 Nest+임시 SQLite HTTP로 native 인증, 웹/앱 credential 충돌, DTO 동일성, payload/CAS, 사진 ACL과 decode 후 폐기, 삭제 재시도, 공유 account 요청 제한을 검증한다. 여행 핸들러는 공통 route base를 재사용하고 native에서 익명 기록 preview/import를 추가하지 않는다.

## 실행과 증거
#161 application/저장소는 별도 담당자의 완료 commit을 통합한다. 테스트용 Kakao verifier는 실제 외부 인증 증거가 아니다. 최종 실행 결과를 이후 기재한다.

## 검증 결과
- 최초 실제 Nest HTTP RED: `/api/native/travel-rooms` 기대 401, 실제 404 (1/1 실패). 어댑터 등록 후 초기 3/3 통과.
- #161 `e049d11`, shared principal `2e0b8ce`, receipt 회귀 `42f0edd` 통합. 본 작업은 presentation/composition/bootstrap만 변경하며 해당 application 구현은 별도 담당 변경이다.
- 최종 3 workspace build 통과. 실제 Nest/임시 SQLite native HTTP 10개 + parser 1개 11/11 통과(9.8초). 이후 bootstrap 사전검증 회귀 추가하여 unit 2/2 통과(1.1초). 신규 시험 합계 HTTP 10 + unit 2.
- lint, typecheck, layer checker 통과. 전체 API/DB/browser/harness는 동시 실행 부하를 피하도록 coordinator 최종 통합 단계에 남겼으며 이 작업에서 전체 성공을 주장하지 않는다.
- HTTP 시험: credential 혼합/누락, payload, 웹 CSRF, 계정/방 DTO, 상속 route params, native 실제 팀 게임 완료/재시도, 요청 제한 180회, 실제 Sharp 사진 정규화/ACL, native 탈퇴/다른 기기 폐기/receipt 재시도, 미설정 verifier/authority, 외부검증 대기 중 authority 실패.
- 사진 decode 중 logout 회귀는 명시적 지연 processor fixture를 사용하며, 별도 정상 사진 HTTP 시험은 실제 Sharp를 사용한다. 제공자 verifier는 합성이고 실제 카카오/기기/운영 인증 검증이 아니다.
- shared controller 변경: `TravelRoomRoutes`, `AccountAvatarRoutes`의 Nest route 상속을 실제 HTTP로 확인. 웹 인증 정책은 concrete web subclass에 그대로 보존.
- production bootstrap에는 선택적 KAKAO_APP_ID 검증/배선만 추가. 운영 환경파일·서비스·계정 설정은 변경하지 않았다.
