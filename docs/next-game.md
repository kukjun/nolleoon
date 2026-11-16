# 같은 방에서 다음 게임 준비 (#23)

## 준비 세대와 불변 게임

방장은 결과 또는 중단 뒤 명시적으로 다음 준비를 연다. 방 링크·현재 멤버십은 그대로 두고 대기 역할을 모두 참가자로 바꾸며 피고는 다시 정한다. 새 초안은 사건/벌칙 빈 문자열, 기본 180초다. 실제 게임·투표 명단은 준비 시가 아니라 새 재판 시작 때 새 ID로 생성한다. 이전 게임의 사건·벌칙·명단·표·정산은 변경하지 않는다.

v9 migration의 `preparation_version`과 `prepared_after_game_id`가 명시적 다음 준비를 구분한다. draft.version, roleRevision, penaltyRevision은 증가하며 0으로 되돌리지 않는다. 기존 동의 record의 decisionVersion도 되돌리지 않고, 현재 역할/벌칙 revision과 일치하지 않게 만들어 같은 피고·같은 벌칙이라도 새 수락을 요구한다.

역할 변경/제외 명령은 expectedPreparationVersion을 검증한다. 이전 호환 형식의 버전 생략은 최초 세대 0으로만 해석되므로 다음 세대에는 실패한다. 현재 UI는 항상 명시적 세대 값을 전송한다. 설정은 증가한 draft CAS, 동의는 역할/벌칙/결정 revision, 시작은 초안/역할/동의 버전, 진행 명령은 gameId/round/version에 바인딩한다.

## 중복·지연 요청

`POST /api/rooms/:code/next-game`은 `{requestId,fromGameId,expectedPreparationVersion}`을 받는다. 현재 방장, 열린 방, 최근 완료/중단 게임, 현재 준비 버전을 검증한 뒤 한 transaction에서 초기화와 영속 receipt를 저장한다. 같은 원래 actor와 의도의 재시도는 기존 receipt만 재확인한다. 다른 키의 같은 이전 게임 재요청은 새 준비를 만들지 않는다. receipt는 immutable이며 방/이전게임 조합도 유일하다.

응답의 receipt는 원래 준비 세대를 식별하고 snapshot은 현재 방 상태다. 두 세대 뒤 옛 요청을 재시도해도 최신 초안을 지우지 않는다. UI는 receipt의 게임/세대와 현재 snapshot의 세대가 일치할 때만 해당 준비 성공을 적용한다. 다음 준비로 넘어갈 때 역할·설정·동의·시작 폼의 로컬 상태도 새 세대로 초기화한다.

옛 start/open/vote receipt 재확인은 접수 사실을 유지하지만 응답 snapshot에 옛 게임을 현재 게임처럼 넣지 않는다. 모든 명령은 현재 게임 snapshot을 반환하며 vote receipt만 원래 game/round를 가리킨다. 오래된 낮은 room.version 응답도 기존 클라이언트 guard로 무시한다.

## 이전 기록 연결

`GET /api/rooms/:code/games/:gameId`는 현재 RoomSnapshot과 별개의 게임 상세 DTO다. 실제 게임 참여 이력의 신원만 완료/중단 상세를 조회할 수 있고 UI는 별도 패널에서만 표시한다. 이 응답을 현재 방 state에 병합하지 않는다. 다음 준비와 진행 중에도 historyGameId는 허용된 이전 게임 진입점을 유지한다. 전체 개인 기록 목록은 #24에서 다룬다.

중단 다음 준비는 원래 중단 원인을 수정하지 않는다. 피고 퇴장/기존 private 중단은 내용 비공개 상태를 유지하며 #33의 미결정 공개 규칙을 넓히지 않는다. 닫힌 방에서는 새 준비를 만들 수 없다.

## 검증 경계

실제 endpoint 부재 RED(404, 기대201) 후 동일 멤버십 두 판·다른 피고·같은 벌칙 재수락·중복 요청·세 번째 준비 뒤 첫 receipt 재시도·옛 명령 격리·이전 기록 불변을 검사한다. SQLite 실패 rollback, 재개방 receipt 재확인, 불변 trigger도 검사한다. 브라우저 시나리오와 소요시간은 최종 작업 기록에 따로 기록한다. 이 단계는 전체 기록 UI나 외부 배포 완료를 뜻하지 않는다.

실제 Chromium 신규 3개는 32.5초에 통과했다. 연속 두 판 신규 시험은 처음 15초 전체 시험 제한에 걸려 연속 두 판 및 지연 open-vote 응답을 검증하는 두 신규 긴 시나리오의 실행 제한을 각각 30초로 설정했다. 기존 시험 제한과 개별 assertion 제한은 유지했다. 기존 전체 232.16초를 합산한 예산 근거는 harness-verification 문서에 기록한다.
