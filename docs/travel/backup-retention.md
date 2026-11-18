# 일일 백업과 삭제 후 복원 경계

승인된 정책은 하루 한 번, 최근 7일의 백업 보관, RPO 최대 24시간이다. 여행방에는 자동 만료를 추가하지 않는다. 관리자 방 삭제의 7일 복구 유예는 별도 제품 흐름이며 백업 보관 기간과 혼동하지 않는다.

## 일일 도구

`node tools/storage/daily-backup.mjs <원본DB절대경로> <기존전용백업디렉터리>`는 UTC 날짜마다 한 번만 검증된 온라인 SQLite snapshot을 생성한다. 같은 날짜 재실행은 파일과 소유 manifest의 해시를 검증하고 재생성하지 않는다. 기본은 보관 기간이 지난 파일 **목록만** 반환하며 삭제하지 않는다. 명시적 `--prune-managed`는 이 도구의 manifest와 해시가 일치하는 관리 복사본만 지운다. 최근 7개 파일이 아니라 오늘을 포함한 UTC 7일 범위다. 실패한 백업일을 성공한 것으로 표시하지 않는다.

이 변경에서 cron/LaunchAgent를 설치하거나 실제 DB를 읽거나 실제 백업을 생성·삭제하지 않았다. 운영자의 경로/용량/권한 확인과 스케줄 배포는 별도 gate다. 하루를 건너뛴 실행은 과거 시점 백업을 만들어내지 못한다. RPO는 스케줄 정상 실행 감시까지 있어야 운영상 유지된다.

## 삭제 ledger

삭제 요청은 DB 변경보다 먼저 별도 ledger에 삭제 의도를 동기 append + fsync한다. 실패하면 SQL 삭제를 진행하지 않는다. SQL 실패 전에 ledger가 성공한 경우에도 의도는 남으며, 같은 operationId 재시도 또는 복원 시 멱등 적용한다. ledger 기록과 SQL 삭제가 한 저장소 트랜잭션이라고 주장하지 않는다.

각 행은 operationId/accountId/travel run IDs/명시 연결 legacy run IDs/요청시각만 갖는다. 이름·이메일·provider token·게임 본문은 기록하지 않는다. hash chain과 별도 checkpoint를 검증하며, 누락/절단/변조/알려진 최신 checkpoint보다 오래된 ledger는 거부한다. append 후 checkpoint 게시 전 중단은 복원을 차단하며, 동일 삭제 요청 재시도가 검증된 앞으로의 chain으로 checkpoint를 복구할 수 있다. 자동으로 빈 ledger를 생성하거나 지워서 복구하지 않는다.

별도 checkpoint도 같은 과거 상태로 함께 롤백되면 로컬 두 파일만으로 최신성을 증명할 수 없다. 운영 authoritative 저장 위치, 독립 최신성 확인, 외부 보관/암호화/접근권한은 아직 설정하지 않았다. 따라서 로컬 합성시험 통과를 운영 삭제 부활 방지 완료로 표현하지 않는다. 과거 바이너리나 일반 파일복사로 검증 경로를 우회해 공개 서비스를 시작하는 것도 이 도구가 차단하지 못하며, 복원 release 공개 전 검증이 필수다.

SQL UPDATE/DELETE는 서비스 조회에서 정보를 제거하는 논리 삭제다. 운영 DB의 freelist/WAL, 이전 snapshot과 저장 장치의 잔여 바이트가 즉시 forensic 삭제된다고 보장하지 않는다. 복원 경로는 새 비공개 복사본에 삭제를 적용한 뒤 VACUUM으로 live-page snapshot을 재구성하고 검증된 새 파일만 게시한다. 이는 원본 운영 DB에 VACUUM/보안 설정을 적용하는 작업과 다르며, 정리한 임시파일의 물리 복구 불가능성도 보장하지 않는다. 기존 백업의 7일 보관 정책과 논리적 부활 차단/물리적 삭제는 서로 별개의 요구다.

일일 도구의 DB 해시는 64KiB streaming chunk로 계산하여 전체 DB를 메모리에 적재하지 않는다. 신규 lock/manifest는 0600으로 생성한다. 백업 게시 성공 후 manifest 쓰기 실패가 발생하면 다음 실행은 관리 소유권을 자동 추정하지 않고 실패한다. 운영자는 DB 무결성과 일시·원본을 별도 검증한 뒤 복구 절차를 결정해야 하며, 도구가 해당 파일을 덮거나 삭제하지 않는다.

전용 백업 디렉터리는 원본 DB의 실제 경로와 device/inode에 고정된다(`.source-binding.json`, 0600). 다른 DB 또는 교체된 inode로 바뀌면 자동으로 성공/덮어쓰기 처리하지 않고 운영자 점검을 요구한다. 원본은 백업 디렉터리 밖의 파일이어야 하며, managed snapshot 자체나 그 symlink/hardlink alias를 원본으로 지정하는 것도 거부한다. 따라서 retention이 현재 입력 원본을 삭제하는 경로를 차단한다. 이 검증은 운영자가 디렉터리/파일을 동시에 악의적으로 바꾸지 않는 전용 경로 전제이며 OS 파일 권한을 변경하지 않는다.


## 검증된 복원 호출

`restoreDatabase(source,destination,{account:{journal,checkpoint},rooms:{journal,checkpoint}})`는 모든 지원 스키마에서 두 외부 journal을 요구한다. schema9/11도 나중에 계정에 연결해 삭제한 원본 재판을 담을 수 있어 예외가 아니다. 이전 2인자 호출은 fail closed한다. 합성 회귀에서만 명시적으로 빈 journal을 생성하여 삭제 이력이 없음을 모델링한다.

CLI는 `node tools/storage/backup.mjs restore <원본> <새대상> <control.json>`이다. control 파일은 account와 rooms 각각 `{path,checkpointPath,expected:{sequence,digest}}`를 갖는다. expected는 독립 확인한 최신 authoritative checkpoint여야 한다. CLI가 사용자 입력값만으로 최신성을 인증하는 것은 아니다. journal 누락, stale expected, 알려진 최신 anchor보다 짧거나 digest가 다른 chain은 복원을 중단한다.

복원은 account→room journal 순으로 파일 잠금을 보유한 상태에서 원본의 온라인 복사본을 별도 임시 경로에 만든다. 그 복사본을 최신 스키마로 올리고 room 이벤트를 순서대로 적용한 뒤 account 삭제를 마지막에 적용한다. 방 복구가 계정·사진·참여 정보 삭제를 되돌리지 않도록 한다. 이어 VACUUM 및 schema/integrity/FK 검증 후 기존 파일을 덮지 않는 게시를 한다. 복원 도중 새로운 삭제 요청은 journal 잠금 실패로 진행되지 않는다. 오래된 백업에서 진행 중인 게임은 삭제 replay로 중단되며 수치 요약은 백업 당시 자료 범위이지 소실된 최종 결과 복구가 아니다.


## 합성 검증 범위

새 restore 무증거 호출은 기존 구현에서 성공해 회귀 시험이 실패했고, 필수 journal gate 추가 후 거부됐다. 원본은 불변인 채 최신 삭제 의도로 이전 계정 사진/이름/provider 정보가 복원되지 않는 것, 방 restore/purge와 계정 삭제가 섞여도 계정이 부활하지 않는 것, schema9 진행 중 legacy 재판이 명시된 proof에 한해 중단·삭제되고 다른 게임은 보존되는 것을 실제 SQLite 새 복원본으로 확인했다. 재구성된 복원 파일에 합성 이름/사진 marker 바이트가 없는 것도 확인했지만 forensic 물리 삭제 증명은 아니다.

최종 해당 작업트리 검증: unit161/API143/nativeDB100, fail/skip 0; build/lint/layers 통과. 브라우저·운영 스케줄·실제 백업/삭제/복원·독립 외부 ledger 저장소는 실행하지 않았다. 기존 schema9/11 자료 비교와 hash 단언은 유지했고, 복원본은 삭제 적용을 위해 최신 스키마로 올라가므로 기존 복원본 version=9 단언만 최신 버전 기대값으로 바꿨다. 원본 schema9 불변 단언은 그대로다.

### 복원본의 필수 journal 잠금표시(schema17)

검증된 journal 파일이 임시 복원 디렉터리 밖에 있어도, 게시되는 DB에는 account/room 두 namespace의 **실제 authoritative 경로 binding hash와 확인한 prefix 길이/digest**를 기록한다. 복원 lock 안에서는 이미 검증한 entries 배열을 전달하고 native `entries()`를 다시 호출하지 않아 잠금 재진입을 피한다. 이후 기동 시 journal을 생략하거나 다른 경로/과거 prefix를 제출하면 실패한다. 빈 journal도 '선택 사항'이 아니라 길이 0인 필수 journal로 표시한다.

이 보강의 RED는 복원 후 journal 없는 `LedgerRequirements.check()`가 성공한 실제 회귀였다. 수정 후 누락/한쪽 누락/다른 binding/줄어든 prefix는 거부되고 원래 journal은 통과했다. 실제 production entry도 복원 DB에 journal env가 없으면 기동 실패, 올바른 env를 전달하면 기존 세션/방을 다시 조회했다. 합성 helper는 enclosing test 임시 디렉터리 수명 동안 journal을 유지하며, 두 번 복원에도 동일 binding을 재사용한다. 운영 경로나 env는 변경하지 않았다.
