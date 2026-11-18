# 삭제 원장 필수 상태와 운영 경로

schema17은 계정·방 원장별 필수 여부를 행 존재로 고정한다. 검증된 원장을 명시적으로 처음 제공했을 때만 행을 만들며 삭제 작업의 SQL transaction과 분리하여 저장한다. 한 번 고정된 DB는 그 원장 없이 시작하거나 요청을 처리할 수 없다. 기존 원장 미설정 DB는 자동으로 원장을 생성하지 않으며 계정/방 삭제 기능만 503으로 닫혀 있다.

- DB에는 원장 종류, 경로 binding 해시, 마지막 관찰한 sequence와 prefix digest만 저장한다. 원문 경로·쿠키·토큰·프로필·자유 입력은 넣지 않는다.
- 원장 자체 hash chain/checkpoint 검증 후, DB가 이미 관찰한 prefix가 같은지 검사한다. 더 짧은 원장+checkpoint 쌍이나 다른 체인은 거부한다. 검사에 실패하면 일반 조회도 503이며 시작 단계에서는 listen하지 않는다.
- 외부 파일의 canonical 경로를 binding에 사용한다. 복원 도구는 검증된 원장 lock을 유지한 상태에서 새 복원 DB에도 필수 상태를 기록해야 한다. 다른 경로로 이전하는 것을 이 코드가 자동 승인하지 않는다.
- 원장 append 후 SQL 실패 직후의 새 sequence가 아직 DB에 관찰되지 않았을 수 있다. DB latch만으로 외부 원장과 checkpoint를 함께 과거로 되돌리는 모든 경우를 탐지한다고 주장하지 않는다. 독립적인 최신 원장 checkpoint와 복원 시 최신성 검증이 여전히 필요하다.

운영 구성은 `DELETION_LEDGER_PATH`/`DELETION_LEDGER_CHECKPOINT`, `ROOM_DELETION_LEDGER_PATH`/`ROOM_DELETION_LEDGER_CHECKPOINT` 각각 명시 쌍이다. 파일은 미리 존재하는 일반 파일이어야 한다. DB·WAL·SHM·journal, 웹 정적 루트, 다른 원장/체크포인트와의 겹침 및 hardlink 중복을 거부한다. 초기화·경로 설정·스케줄 변경은 개발 작업에서 실행하지 않았다.

매 API 요청과 OAuth 교환/이미지 decode의 비동기 continuation 전에 원장 필수 상태 검사 → 방 replay → 계정 replay를 수행한다. 계정 프로필 이미지 실제 provider에도 이 callback이 연결된다. 운영 카카오 연결 해제 성공은 별도 gate다.
