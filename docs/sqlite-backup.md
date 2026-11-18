# SQLite 온라인 백업과 별도 경로 복원

## 실행

빌드된 현재 버전으로 수동 실행한다. 두 경로는 절대 경로이며 대상 파일은 없어야 한다.

```sh
npm run build --workspace @trip-court/api
node tools/storage/backup.mjs backup /private-data/game.sqlite /private-backups/game-001.sqlite
node tools/storage/backup.mjs restore /private-backups/game-001.sqlite /private-data/restored-001.sqlite
node --test tests/database/backup.test.mjs
```

위 경로는 예시다. 운영 DB에 자동 실행하거나 서버의 DB 경로를 변경하지 않는다. 복원본 검증 후 서버를 중지하고 사용할 DB 경로를 선택하는 운영 전환은 별도 작업이다. 기존 파일을 덮어쓰는 restore 옵션은 없다.

## 일관성과 검증

설치된 better-sqlite3 13.2.0의 `Database#backup()` 온라인 백업 API를 사용한다. 원본 연결은 `readonly: true`, `fileMustExist: true`다. 실행 중인 WAL DB를 파일 복사하지 않는다. 커밋된 WAL 데이터는 포함하고 다른 연결의 미커밋 변경은 포함하지 않는다. 백업 이후 커밋은 복원본에 있다고 보장하지 않는다.

원본과 생성한 스냅샷 각각에 `integrity_check`, `foreign_key_check`, 현재 배포 코드의 모든 migration 번호·이름·SQL SHA-256 manifest 일치를 검사한다. 명시적으로 지원하는 과거 배포 schema 9/11 및 현재 최신 schema만 허용한다. 그 외 부족하거나 더 새로운 버전, 변경된 checksum, 손상된 파일은 거부한다. 신뢰하는 현재 migration으로 별도 메모리 DB를 구성해 `sqlite_schema`의 type/name/tbl_name/sql도 비교한다. manifest만 복사하고 실제 table/index/trigger를 누락한 DB도 거절한다. 입력 파일에 migrate를 실행하지 않는다. 이것은 임의의 악성 SQLite 파일의 안전성 인증이나 모든 업무 데이터의 의미 검증이 아니다.

대상 디렉터리 내부의 고유 임시 디렉터리에 생성하고, 검증·파일 sync 후 같은 파일시스템 hard link로 원자적으로 게시한다. 기존 대상이나 경쟁 실행이 먼저 만든 대상은 절대 교체하지 않는다. 완료/실패 시 이 실행이 만든 임시 디렉터리만 정리한다. 게시 성공 뒤 정리만 실패하면 새 대상이 이미 생성됐음을 구분해 알린다. 대상의 최종 symlink(끊어진 링크 포함)와 원본 파일 symlink는 거절한다. 상위 디렉터리 symlink는 realpath로 정규화한다. 신뢰할 수 있는 운영자만 디렉터리를 변경하는 환경을 전제하며 악의적인 동시 디렉터리 교체 방어를 보장하지 않는다.

## 운영 한계와 실패 안내

- 백업에는 세션 해시와 비공개 사건·투표 데이터가 포함된다. 정적 웹 공개 경로에 두지 않는다. 접근·보관·삭제는 운영자 책임이며 도구가 권한을 변경하지 않는다.
- 읽기 전용 SQLite 연결도 WAL 읽기 과정에서 SHM 파일을 사용하거나 생성할 수 있다. DB 논리 데이터와 migration을 수정하지 않는다는 뜻이지 원본 디렉터리의 모든 보조 파일이 바이트 단위로 불변이라는 뜻은 아니다.
- 완전한 스냅샷을 담을 여유 공간과 기존 백업을 보관할 공간이 필요하다. 공간 부족/권한/호환성/무결성 오류는 경로나 SQL 내용을 노출하지 않는 일반 오류로 종료한다. 디스크 공간을 실제로 소진하는 시험은 하지 않았다.
- 스케줄·보관 기간·암호화·외부 저장·재해 복구는 설정하지 않았다. 영구 보관, 무손실 복구 또는 전원 손실 중 디렉터리 메타데이터 내구성은 보장하지 않는다.
- 프로세스 강제 종료 시 미게시 임시 디렉터리가 남을 수 있다. 자동으로 다른 실행의 임시 디렉터리를 삭제하지 않는다.

## 이번 실행 근거

최초 테스트는 미구현 `backup.js` import의 `ERR_MODULE_NOT_FOUND`로 1개 파일 실패(RED)했다. 구현 후 실제 임시 DB 시험은 WAL writer의 최신 커밋/미커밋 rollback 경계, 별도 복원, 경쟁 게시 한 번만 성공, 기존 대상 불변, 손상·잘림·빈 파일·불완전/미래 manifest·checksum·외래키 실패, symlink 정책을 검증한다. 실제 사용자 DB에는 실행하지 않았다.

추가 회귀에서 manifest가 온전한 table/index 누락 DB가 거절되지 않아 2개 실패(RED)를 관찰했다. 메모리 참조 스키마 대조 후 trigger 누락과 실제 CLI 성공/실패·출력 비식별 시험도 추가했다.
