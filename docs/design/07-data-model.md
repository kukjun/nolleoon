# 데이터 모델 설계

[규칙](00-current-rules.md) · [ADR](../decisions/0002-mvp-architecture.md). 아래는 구현 대상이며 아직 DB가 만들어진 것은 아니다.

| 엔터티 | 핵심 필드·불변식 |
|---|---|
| BrowserSession | opaque token hash, 생성/만료. 닉네임을 credential로 사용하지 않음 |
| Room | id, 난수 초대 식별자, status, hostMemberId nullable, version |
| RoomMember | roomId, sessionId, nickname, presence, disconnectedAt, leftAt. 나감 이후 재입장은 새 멤버십 |
| Game | roomId, 상태, 사건/벌칙/설정 version, defendantId, acceptanceVersion, duration, 결과/중단 사유 |
| GameParticipant | gameId, sessionId/memberId, 역할, 관전/이력 자격. 방 권한과 분리 |
| VoterEligibility | gameId+participantId unique. 재판 시작에 동결, 이후 삭제/추가 금지 |
| Round | gameId+number unique, startsAt, deadline, closedAt, 집계. 최대 두 개 |
| Vote | roundId+participantId unique, choice, reason, requestId. 제출 뒤 불변 |
| Defense | gameId+stage, 작성자 피고, 텍스트/skip. 마감 뒤 변경 거절 |

외래키·unique·check·version 조건은 저장소에서도 검증한다. 초안은 서버 저장, 기존 수락은 벌칙/피고 revision과 결합한다. deadline과 disconnect 기준 시각은 서버 UTC epoch로 저장한다. SQLite 파일은 공개 정적 디렉터리 밖에 두고 비밀값/실제 표를 테스트 fixture로 쓰지 않는다.

조회 모델은 UI 목적별 allowlist다. 종료 뒤 새 방 멤버십은 과거 GameParticipant를 만들지 않는다. 진행 중 입장은 관전 참여 기록만 만들고 VoterEligibility는 변경하지 않는다. 피고 퇴장 중단 이력 필드는 #33 결정 전 공개하지 않는 보수적 제안이다.
