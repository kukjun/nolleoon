# 선택적 과거 기록 연결 · #134 서버 기반

로그인 callback은 가져오기를 하지 않는다. 현재 유효한 account cookie와 **현재 유효한 원래 anonymous cookie**가 함께 있는 사용자가 기록을 명시적으로 선택할 때만 연결한다. nickname/localStorage ID/초대 코드만으로 증명하지 않는다. 쿠키가 없어졌으면 이 경로에서 복구할 수 없다.

## 계약

- `GET /api/account/legacy/preview?cursor`: 두 신원 증명 후 완료/중단 기록의 runId/type/status/linkState만 미리보기. 20개 keyset 페이지이며 현재 진행 기록은 가져오기 대상에서 제외한다. 동일 브라우저 증명의 동일 기록이 다른 계정에 연결됐으면 unavailable이며 다른 계정 정보는 공개하지 않는다.
- `POST /api/account/legacy/import {runIds}`: 1–20개 고유 ID를 명시 선택. CSRF/Origin 검사, 모든 대상의 원래 참가 권한/종료 상태를 transaction 안 재검증. 한 대상이라도 무권한/충돌이면 전부 rollback. 이미 같은 계정에 연결됐으면 같은 link ID를 돌려준다.
- `GET /api/account/legacy?cursor`, `GET /api/account/legacy/:id`: 유효한 account session만으로 이미 연결한 기록을 조회한다. anonymous cookie 만료 뒤에도 명시 연결된 권한은 유지되지만 현재 계정은 활성 상태여야 한다. 타인 link ID/커서는 404.

schema13은 `account_legacy_links`만 추가한다. `(run_id, legacy_session_id)`가 유일하며 원래 증명을 바꾸는 UPDATE는 금지한다. 같은 판의 다른 정당한 참가자가 자기 기록을 자신의 계정에 연결하는 것은 허용한다. account 삭제/공동기록 보관 정책은 #138/#140이며 이 구현이 대신 확정하지 않는다.

## 기존 권한 보존

새 여행방·멤버십·판을 생성하지 않는다. 오래된 방 ID나 참가자 ID를 새 여행방 권한으로 바꾸지 않는다. 사진/프로필을 자동 복사하지 않는다. 상세는 저장한 legacy session의 원래 참가 권한으로 재검사하며 `PartyGames`/`Rooms`의 기존 projection을 재사용한다. 조회용 함수 추출은 lifecycle maintenance를 호출하지 않으므로 기록 읽기가 기존 방 상태나 완료 데이터에 쓰지 않는다.

원래 관전자는 결과 비공개를 유지한다. 중단 재판은 party projection=null이며 court adapter의 기존 #33 정책이 그대로 적용된다. defendant-left/legacy-private 사건·벌칙은 숨기며 room-closed 원인에서 기존에 허용한 사건만 허용한다. 새로운 account room 멤버라는 이유로 다른 사람의 legacy 기록을 볼 수 없다.

## 검증과 미완료

초기 모듈 부재 RED 후 구현. 실제 native SQLite 7개 및 실제 Nest HTTP 1개를 확인했다. 첫 DB 시험은 fixture table 이름 오타로 실패했으며 실제 schema 목록 기반 전체 legacy table 값 비교로 정정했다. 이 실패를 제품 결함 RED로 세지 않는다.

현재 source에서 build/lint/layers 통과, 전체 unit87/API121/DB70 통과(0 skip/todo). 기존 schema11 고정 시험 실패는 별도 schema 담당의 manifest 기반 검증/backup 보강을 통합하여 해소했다. 새 schema13에서도 schema9/schema11 원본 보존 회귀를 유지했다.

확인 범위: 선택/중복/타계정 선점/위조·소실·만료 cookie, 같은 판 다른 정당한 참가자, 원자적 실패, 닫힌 방 원본 table 값 동일, 재개방, 26개 pagination, 관전자 비공개, 세 가지 중단 원인, HTTP CSRF/401/404/409. 실제 브라우저 선택 UI와 두 기기 실서비스/카카오 연동은 이번 서버 작업에서 미실행이다. UI가 없다는 점을 숨기고 #134 전체 완료로 처리하지 않는다.

### 목록의 시작 일시

미리보기와 연결된 기록 목록의 각 항목에 `createdAt`(UTC epoch milliseconds)을 반환한다. 원본 `game_runs.created_at`을 그대로 읽으며, 연결한 시각이나 조회 시각으로 바꾸지 않는다. UI는 이를 **시작 일시**로 표시한다. 공통 원본에는 종료 시각이 저장되어 있지 않으므로 `finishedAt`을 만들어 내지 않는다. 기존 쿠키/계정 및 참가 권한 검증, 페이지 순서와 커서는 그대로이며 사건 제목·벌칙·다른 참가자 정보는 목록에 추가하지 않는다.

검증: 추가 native/HTTP 단언이 필드 미구현으로 실패한 뒤, 원본 시각 전달로 관련 native 8 + HTTP 1 시험이 통과했다. 원본 1234 → 연결 시각 5678 → DB 재개방 후에도 1234를 반환하며 목록 필드 allowlist와 비참가자 빈 목록을 확인했다.
