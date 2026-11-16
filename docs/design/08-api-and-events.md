# API와 동기화 설계

[규칙](00-current-rules.md) · [ADR](../decisions/0002-mvp-architecture.md). 경로/DTO는 다음 티켓에서 계약 시험과 함께 확정할 설계다.

| 명령/조회 | 서버 검사 |
|---|---|
| createRoom / joinRoom | 유효 세션·닉네임, 열린 방. 진행 중이면 관전, 종료 게임 소급 참여 금지 |
| getRoomSnapshot / heartbeat | 멤버십·연결 상태·공통 serverNow/deadline/version. 본인 접수만 표시 |
| saveGameDraft / startTrial | 현 방장, version, 열린 방. 시작 시 3명/피고/수락과 자격 고정 |
| selectRole / acceptPenalty | 본인 역할, DRAFT, 피고 단일성, 현재 penalty revision |
| submitDefense / startVote | 피고/현 방장 권한 각각, 해당 phase, 2차 동일 cohort/기간 |
| submitVote | 세션·game·round·자격, 미마감, 불변 표. 동일 request 재전송은 기존 접수 반환 |
| leaveRoom / closeRoom | 본인 나감/현 방장 종료, 원자적 이양/중단 |
| getResult / getHistory | 게임별 참여권한, 공개된 round만. 신원·내부 식별자 제외 |

폴링으로 snapshot을 받고 focus/online 복귀 시 즉시 재동기화한다. 중복/오래된 응답은 version으로 무시한다. UI 카운트다운은 serverNow와 deadline의 차이를 표시할 뿐 서버 판결을 대신하지 않는다.

권한 실패, 상태 충돌, 기한 초과, 입력 오류를 구분한 안정적 error code와 한국어 UI를 제공한다. 명령별 idempotency key와 roundId를 고정해 오래된 1차 요청을 2차 표로 넣지 않는다. 실제 HTTP 상태/DTO 버전은 계약 티켓에서 고정한다.

진행 라운드의 타인 표/이유는 서버 응답 자체에서 제외한다. 1차 동률 공개 후에는 1차 집계·익명 이유만 계속 제공한다. 최종 양 라운드 이유를 구분하며 방 종료 중단 기록은 사건+중단만 제공한다. undefined 공개 필드를 기본 허용하지 않는다.
