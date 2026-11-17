# Party API v1 · 구현 계약

기존 `/api/rooms`·`RoomSnapshot` 필드를 변경하지 않는다. 아래는 별도 경로이며 쿠키 actor, Origin, JSON/custom header 정책을 그대로 사용한다. 모든 응답 no-store. 코드 타입은 `packages/contracts/src/party.ts`다.

- GET `/api/party/rooms/:code`: PartySnapshot
- PUT `/api/party/rooms/:code/selection`: `{expectedVersion,type,teamCount,winnerCount,penaltyText}` → PartySnapshot. 전체 키 필수. 방장·준비 상태에서만 CAS 저장.
- POST `/api/party/rooms/:code/start`: `{requestId,expectedSelectionVersion}` → `{snapshot,receipt}`. team/draw 전용. trial은 선택 저장 후 기존 설정/역할/수락/start endpoint를 사용한다.
- POST `/api/party/rooms/:code/runs/:runId/reveal`: `{requestId}` → `{snapshot,receipt}`. 자기 고정 제비만, URL run과 actor에 귀속한 멱등 접수.
- POST `/api/party/rooms/:code/next`: `{requestId,fromRunId,expectedSelectionVersion}` → `{snapshot,receipt}`.
- GET `/api/party/history?cursor=...`: 자기 실제 참여 이력, 최대20개. GET `/api/party/rooms/:code/runs/:runId`: 자기 참여 게임 PartyRun.

requestId는 16~100자 문자열이다. 일반 오류는 기존 FailureCode와 상태 코드를 사용한다. 요청 body로 session/member actor를 받지 않는다. 늦은 receipt 응답의 snapshot은 현재 방 상태이고 receipt.runId는 원래 요청 대상이다. UI는 둘을 혼동하지 않는다.

팀은 최소2명/팀수2~인원/인원차최대1, 제비는 최소2명/N1~인원이며 시작 당시 신선하게 연결된 멤버를 고정한다. 위 값은 위임받아 정한 구현 기본값이지 사용자 직접 인용이 아니다. 제비 시작 전 벌칙 전문·N·대상 인원을 보여주며 새 필수 동의 토글은 추가하지 않는다. 결과는 frozen eligible 참가자만, 후발 관전자는 진행 상태만 조회한다. 미공개 winning 값은 본인에게도 전달하지 않는다.

#101 미공개자 퇴장/방닫힘: 자동 공개·재배정·성공완료 처리 없음. 서버 원본 배정 보존, `blockedPolicy`로 미결정 상태 표시. 최종 전이 인수는 정책 확정 전 차단된다. 재판 공개는 기존 #33 보수 정책을 유지한다.
