# SQLite 저장소 기반 · MVP-04

## 설치와 확인

공식 npm registry의 better-sqlite3 13.2.0을 API 의존성으로 고정했다. Mac mini에서 Node v24.14.1 / ABI 137 / darwin arm64로 설치·기동했고 실제 `SELECT sqlite_version()` 결과는 **3.54.1**이다. 다른 OS/ABI의 성공을 이 결과로 추정하지 않는다.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm rebuild better-sqlite3
npm run build
npm run test:database
```

`--ignore-scripts`로 전체 패키지 설치 스크립트를 차단한 뒤 선택한 공식 better-sqlite3의 네이티브 설치만 명시적으로 실행한다. 플랫폼에 맞는 prebuild가 없으면 Node 빌드 도구가 필요할 수 있으며 실제 오류를 해결하기 전 통과로 보고하지 않는다. 전체 하네스는 기존 Chromium 설치도 필요하다.

## 경계

`application/ports/storage.ts`는 순수 TypeScript record/repository/UnitOfWork 계약이다. SQLite/ORM 객체를 domain/application으로 전달하지 않는다. infrastructure의 `openSqlite`와 `SqliteUnitOfWork`가 어댑터다. MVP-05부터 API composition root는 명시한 DB_PATH를 열고 migration을 적용한다. 앱 시작에는 전용 경로를 지정해야 하며 테스트는 항상 임시 DB를 사용한다.

DB 열기는 절대 경로만 허용하고 부모 디렉터리는 호출자가 준비한다. 공개 정적 디렉터리 밖의 안전한 로컬 경로를 선택하는 것은 호출자의 책임이다. 현재 함수는 symlink/공개 디렉터리 containment 보안 경계를 구현하지 않는다. 향후 배포는 ignored `data/` 같은 전용 경로를 사용하고 실제 배포 경로를 확인한다. 모든 통합 시험은 임시 디렉터리의 합성 데이터만 사용하고 연결/파일을 정리한다.

연결별 foreign_keys=ON, journal_mode=WAL, busy_timeout 기본 1000ms를 설정한다. 시험에서는 20ms로 실제 두 연결 쓰기 락을 재현한다. busy/locked, constraint, 일반 SQLite 오류는 application StorageError로 번역하되 SQL/실제 입력값을 오류에 노출하지 않는다. 자동 재시도는 아직 없으며 상위 명령의 멱등성 정책과 함께 추가한다.

## 최소 스키마

- sessions: 불투명 토큰의 hash 저장 필드, raw credential 저장 없음. 인증·만료 로직은 후속 기능.
- rooms / room_members: 초대 식별자, 방 상태/version, 멤버십. 활성 멤버의 같은 세션·정규화 닉네임 중복 금지. 퇴장 후 새 멤버십은 가능하도록 partial unique index 사용.
- games / game_participants: 방과 게임 권한 분리, 교차 방 참여 FK 차단, 진행 게임 한 개, 피고 최대 한 명.
- rounds / votes: 게임·라운드별 구분. (게임, 라운드, 참가자) 표 한 개, 실제 참가자·라운드 FK. 다른 게임/다른 라운드에는 별도 표 저장 가능.
- drafts: 방별 설정 한 개와 version. 현재 save는 저장 원시 연산이며 방장 권한/낙관적 version 비교·수락 무효화는 후속 유스케이스에서 구현한다. 이 원시 연산을 외부 API로 직접 노출하지 않는다.

여기에 저장된 role/eligible 필드는 스냅샷을 위한 최소 기반이다. 투표권 동결, 피고 제외, 투표 이유 검증, 마감·판결·세션 인증·과거 기록 권한은 저장소 존재만으로 구현 완료가 아니다. 불변 vote repository는 insert/read만 제공한다.

## 마이그레이션·트랜잭션

1부터 연속된 전체 마이그레이션 정의를 제공한다. schema_migrations에 version/name/SQL SHA-256을 기록한다. 이미 적용한 정의의 변경·누락·알 수 없는 새 DB 버전은 거절한다. 기존 정의를 수정하지 말고 증분 버전을 추가한다. 새 upgrade 묶음과 이력 기록은 하나의 IMMEDIATE transaction이므로 중간 DDL/DML 실패 시 기존 스키마·이력을 보존한다. down migration은 구현하지 않았다.

UnitOfWork는 동기 콜백 안에서만 repository를 제공한다. 예외는 rollback, Promise 반환은 거절/rollback하며 callback 종료 뒤 저장소 핸들은 무효화한다. 긴 I/O/await를 DB transaction 안에서 하지 않는다. 단일 프로세스·짧은 쓰기 transaction 설계이며 무제한 다중 writer를 보장하지 않는다.

## 백업 호환성과 남은 시험

실제 파일을 같은 내장 SQLite 런타임의 두 번째 연결로 열어 저장값을 읽는 시험은 통과했다. 이것은 **백업 생성/복구 시험이 아니다**. 스키마의 STRICT table 및 기타 SQL 기능을 지원하는 SQLite와 해당 앱의 마이그레이션 이력이 함께 맞아야 한다. 임의 구버전 SQLite/구버전 앱 복원 호환을 보장하지 않는다.

WAL은 DB의 영속 상태 일부이므로 실행 중 메인 파일만 복사하거나 WAL을 삭제하면 안 된다. [SQLite WAL 문서](https://sqlite.org/wal.html) 운영 백업은 SQLite의 일관된 snapshot 방식(Online Backup API 등)을 사용하고 복원 검증까지 수행해야 한다. [SQLite Backup API](https://www.sqlite.org/backup.html) 구체 백업/복구 구현·운영 시험은 MVP-26에서 수행하며 아직 미실행이다.

`.gitignore`는 DB 본체와 -wal/-shm/-journal sidecar를 제외한다. DB·시험 산출물을 공개 저장소에 넣지 않는다.
