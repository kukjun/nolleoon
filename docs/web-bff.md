# 통합 Web BFF 계약 · MVP-07

BFF는 ‘화면이 필요한 데이터와 명령의 입구’다. 별도 서버를 추가하지 않고 Nest 앱 안에서 요청 검증·신원 확인·응답 조립을 한다. 도메인 판단을 React에 복사하지 않고, DB entity를 화면에 그대로 보내지 않는다.

## 지금 실제 동작하는 경로

React `requestSession` → 같은 origin `/api/session` → Nest SessionController → BrowserSessions use case → UnitOfWork/SQLite → 명시적 SessionSnapshot → React 상태.

GET 신원 확인·POST 발급/갱신은 실제 구현이다. command helper가 Origin/커스텀 헤더/JSON 형태를 검사하고 POST는 빈 객체만 허용한다. 인증 actor는 `requestActor`가 서버 쿠키를 검증한 결과에서 얻는다. query/body/header의 participantId·sessionId나 프론트의 actions는 신원 근거가 아니다. 세션 토큰은 Set-Cookie 외 JSON/로그/URL에 넣지 않는다.

공유 계약은 `packages/contracts`에 있고 web 클라이언트는 성공 payload 형태를 확인한다. 응답이 잘못되거나 오류 code가 알려져 있지 않으면 성공 표시를 하지 않는다. 서버 메시지 문자열을 그대로 화면에 반사하지 않고 공유된 고정 한국어 메시지를 사용한다.

## 게임 snapshot은 아직 계약이다

`GameStateView`는 서버가 구성해야 할 신뢰된 내부 조회 모델, `presentGame`은 명시적인 공개 필드만 만드는 presenter다. 합성 데이터로 계약을 시험하지만 **게임 snapshot endpoint, 방/게임 생성·투표 endpoint는 아직 없다**. 현재 테스트를 실제 다인 게임 완료로 해석하지 않는다.

| actor | 진행 게임 조회 | 역할/단계 action 힌트 |
|---|---|---|
| 방장=피고 | 현재 라운드 집계/타인 표/이유 비공개 | 관리·변론 가능, 투표 불가 |
| 방장=관전자 | 관전 범위 | 관리 가능, 투표/피고 변론 불가 |
| 자격 있는 일반 참가자 | 자신 역할과 공개 결과 | 해당 라운드 미제출일 때 투표 후보 |
| 후발 관전자 | 공개 진행/종료 결과 | 투표 불가 |
| 이탈한 기존 게임 참가자 | 기존 게임 기록 권한 유지 | 명령 불가 |
| 해당 게임 비참가자 | 거절 | 없음 |

같은 신원의 이전 이탈 멤버십과 새 관전자 멤버십이 함께 있으면 현재 활성 멤버십을 선택한다. 이전 투표 자격은 되살리지 않는다. 복수 활성 멤버십은 임의로 고르지 않고 STATE_CONFLICT로 거절한다. 실제 repository가 이 모델을 구성하는 방식은 후속 기능에서 연결한다.

## 공개 정책

- 진행 라운드의 counts/votes/reasons/제출자 식별자/닉네임/시각/token hash를 보내지 않는다.
- 1차 유효 동률로 이미 종료·공개한 집계와 익명 이유는 최후 변론 및 2차 진행 중에도 유지한다. 진행 중 2차 데이터는 숨긴다.
- 최종 결과는 종료된 양 라운드를 구분해 제공한다. 전원 기권 무판결에서도 실제 작성된 기권 이유는 공개하고 빈 이유를 만들어내지 않는다.
- 공개 이유는 choice/reason만 명시적으로 복사한다. 내부 투표 순서와 무관하게 내용 기준 정렬하며 voter ID·session·nickname·timestamp 같은 메타데이터는 제거한다. 이유 내용 자체로 신원을 추론할 수 없는 익명성을 보장하지 않는다.
- 방 종료로 중단되면 중단 상태와 사건 내용만 제공한다. 피고 퇴장 등 미확정 중단 공개 범위는 최소 중단 상태만 제공하는 보수적 기본값이며 최종 정책 확정이 아니다. 미정 필드를 공개 승인으로 해석하지 않는다. 비참가자에게는 이 최소 DTO도 제공하지 않는다.

## actions는 권한 증명이나 게임 엔진이 아니다

현재 `gameActions`/`assertGameAction`은 역할·단계·제출 여부·이탈·방 상태 및 선택적 version의 필요 조건만 검사한다. start-trial의 인원/벌칙 수락, 투표 deadline, 동시 명령 경합 등 **실제 명령 성공 조건을 전부 구현하지 않았다**. UI 후보 action이 있어도 실제 명령이 거절될 수 있다.

후속 명령 use case는 다음을 같은 transaction 안에서 수행해야 한다:
1. 쿠키로 검증된 actor만 받기.
2. DB에서 현재 게임/멤버십/version/마감 재조회.
3. 최신 상태로 역할·단계 권한을 다시 검사. 프론트가 제출한 actions나 과거 snapshot은 무시.
4. 개별 명령의 인원·최신 수락·동결 cohort·서버 now < deadline·멱등성 등을 추가 검사.
5. 조건부 저장/unique 제약과 원자적 정산 후, 허용 DTO만 반환.

이 transaction-time 엔진은 MVP-08 이후 각 기능에서 구현한다. #7만으로 실제 투표 마감/원자성까지 완성했다고 보고하지 않는다.

## 안전한 오류 계약

모든 실제 Nest API 오류는 `{error:{code,message}}`와 no-store를 사용한다. 원본 exception/SQL/stack/request body/URL을 JSON에 복사하지 않는다.

| code | HTTP | 의미 |
|---|---|---|
| SESSION_REQUIRED | 401 | 유효한 브라우저 신원 없음 |
| FORBIDDEN | 403 | 권한/변경 요청 출처 조건 불충족 |
| INVALID_INPUT | 400 | JSON/입력 계약 불일치 |
| NOT_FOUND | 404 | 없는 route/항목 |
| STATE_CONFLICT | 409 | 최신 상태/version/저장 제약 충돌 |
| DEADLINE_PASSED | 409 | 향후 마감 use case에서 사용할 코드 |
| TEMPORARILY_UNAVAILABLE | 503 | SQLite busy 등 일시 사용 불가 |
| INTERNAL_ERROR | 500 | 안전한 일반 실패 메시지 |

클라이언트만의 NETWORK_ERROR/INVALID_RESPONSE는 서버 오류 code와 구분한다. 자동 명령 재시도를 하지 않으며 응답 유실 시 조회·멱등성 확인 정책은 후속 기능에서 연결한다.

## 시험과 한계

합성 계약 시험: 피고/방장=피고/방장=관전자/비참가자, 이탈 이력과 재입장, stale actions/version, 진행 데이터 누출, 1차 공개 유지/양 라운드 결과/기권 이유, 미정 중단 최소 노출. 실제 API 시험: 고정 401/403/400/404 오류, malformed JSON, no-store와 원본 입력 비반사. 기존 실제 Chromium 세션 시험은 공유 web client→BFF→use case 경로를 회귀 검증한다.

최초 RED는 presenter 모듈 없는 상태의 import 실패였다. 추가로 ignored 빌드 파일에서 진행 라운드 공개, 이유 entity 전체 복사, 피고 투표 허용의 결함을 각각 넣었을 때 해당 계약 시험이 exit 1로 실패함을 확인하고 원복했다. 운영 데이터·실제 서비스에 결함을 주입하지 않았다.
