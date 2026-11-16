# 상태 전이 설계

정책: [현재 규칙](00-current-rules.md). 구현 설계이며 미실행.

Room: OPEN → CLOSED. Game: DRAFT → DEFENSE → VOTING_1 → RESULT 또는 FINAL_DEFENSE → VOTING_2 → RESULT. 진행 상태에서 방 종료/피고 나감은 INTERRUPTED로 종결한다. INTERRUPTED를 타이머 정산이 RESULT로 덮어쓰지 않는다.

- DRAFT→DEFENSE: 현 방장, 접속 중 서로 다른 3명 이상, 피고 한 명, 최신 벌칙 수락을 트랜잭션에서 재검사. 역할/벌칙/연결된 피고 외 자격자 동결.
- DEFENSE→VOTING_1: 방장 명령, 변론 선택. 설정 기간을 고정하고 공통 deadline 생성.
- 라운드 정산: 전원 접수 또는 deadline, 미접수 기권. 0유효표 무판결, 다수 판결, 1차 유효 동률만 FINAL_DEFENSE.
- FINAL_DEFENSE→VOTING_2: 방장 명령, 선택 최후 변론. 동일 자격·기간, 별도 표·deadline. 2차 동률 무죄.
- 단절은 연결 상태이며 즉시 퇴장/중단이 아니다. 10분 만료나 명시적 나가기가 퇴장. 투표자 퇴장은 동결 집합 불변, 피고 퇴장만 중단.
- 방장 이양은 Room 권한 변경이며 게임 역할/투표 자격 불변. 연결 후보가 없고 유예자 있으면 권한 대기, 복귀 때 지정. 전원 나감 확정이면 방 종료.
- 다음 게임은 종결 뒤 생성, 새 역할/수락/자격/표, 시간 180초. 방 초안은 version 검사로 이전 방장의 늦은 저장을 거절한다.

명령 재시도·마감·복귀·이양·종료 경합은 DB 트랜잭션과 상태/version 조건으로 직렬화한다. 정확한 경계는 ADR와 기능 시험에서 고정한다.
