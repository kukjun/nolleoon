# Kakao 연결 해제의 현재 권위 저장소

## 최소 운영 배치

앱 DB는 내부 디스크, 삭제 원장과 현재 unlink 권위 파일은 기존 외장 SSD의 전용 비공개 디렉터리에 둔다. 별도 클라우드 서비스나 새 비용은 필요하지 않다. 운영 경로는 공개 문서에 기록하지 않는다. DB 일일백업 디렉터리와 웹 정적 루트 밖이어야 한다.

환경 이름:
- `KAKAO_UNLINK_PENDING_PATH`: 현재 대기 subject 파일.
- `KAKAO_UNLINK_JOURNAL_PATH`: opaque operationId·시각·prepared/completed/expired 상태의 hash chain. subject 또는 subject hash는 **없다**.
- `KAKAO_UNLINK_CHECKPOINT_PATH`: chain sequence/digest.
- `DAILY_BACKUP_DIRECTORY`: authoritative 파일이 백업 디렉터리 안에 잘못 놓이지 않도록 검사할 경로.

초기 파일 생성은 운영자가 새 전용 경로임을 확인한 뒤 **한 번만** `node tools/storage/unlink-authority.mjs initialize-empty <pending> <journal> <checkpoint>`로 명시 실행한다. 파일 누락/손상 때 이 명령으로 빈 상태를 다시 만들면 안 된다. 기존 파일은 덮어쓰지 않는다. 새 파일은0600으로 생성하며 기존 OS/네트워크 권한은 변경하지 않는다. 이 개발 작업에서는 합성 파일만 초기화했다.

Kakao가 구성된 production은 큐가 없으면 기동을 거절한다. schema18의 필수 binding/known-prefix 검사는 이후 설정이 없어져도 local-only 삭제로 돌아가지 않게 한다. 외장 SSD 미연결/경로 변경/파일 누락/known prefix 후퇴는 중단하고 운영자에게 안전한 오류만 알린다. 자동 파일복구/빈 원장 생성/drive 재설정은 하지 않는다.

## 처리와 crash 경계

1. 현재 pending subject를 fsync/원자교체로 저장하고 subject 없는 prepared 이벤트를 durable 기록한다. 이후 앱의 account 삭제 ledger→SQL 삭제가 진행된다. 같은 operationId 재시도는 처음7일 기한을 유지한다.
2. 앱 worker는 account 삭제 ledger에 일치하는 operation/시각이 있는 작업만 전송한다. pending 저장 후 journal 기록 전 중단된 orphan은 보내지 않는다. 재시도 준비 또는 만료 정리만 가능하다.
3. claim은30초 lease, 재시도는 최대1시간 backoff다. HTTP provider는 앱 worker에서5초 제한하며 만료10초 전부터 새 claim을 허용하지 않는다. 운영은 동일 권위 저장소를 사용하는 단일 서비스 인스턴스 전제다.
4. 성공 또는7일 만료는 subject 없는 terminal 이벤트를 **먼저** fsync한 뒤 현재 파일에서 subject를 제거한다. 이전 pending 파일만 잘못 복원해도 terminal 이벤트를 읽어 subject를 제거하고 재전송하지 않는다. prepared 이벤트는 있는데 해당 pending이 없으면 failclosed한다.
5. pending 동안 같은 subject 재가입은 앱에서 차단한다. 성공/만료 뒤에는 차단하지 않는다. 초기화/매 시간기반 조회/worker/login에서 만료를 먼저 처리한다. production helper도 listen 전에 만료를 정리한다.

전체 큐+chain+anchor+DB를 함께 과거로 되돌리는 공격이나 모든 디스크의 손실을 로컬 파일만으로 탐지/복구할 수 있다고 주장하지 않는다. 이 권위 저장소는 DB 백업/복원 대상에서 제외하며, 복원은 현재 authority를 고정 검증하고 그 binding/prefix를 새DB에 기록한다. old DB restore를 위해 old pending을 복사하지 않는다. 권위 저장소 자체를 복원해야 하면 서비스를 공개하지 않은 상태에서 별도 검증이 필요하다.

## 비식별 감시와 보관 한계

`node tools/storage/unlink-authority.mjs health <pending> <journal> <checkpoint>`는 만료 정리 후 pending/expired/completed **총 개수만** 출력한다. 원문 subject/opID/경로는 출력하지 않는다. 감시 실행자는 expired 누적수가 증가했을 때 '연결 해제 재시도 기한 만료' 비식별 알림을 전달해야 한다. 누적수이므로 매 실행을 신규 실패로 오인하지 않는다. 읽기 전용 health와 달리 이 명령은 만료 subject 정리를 수행하므로 승인된 전용 authority에만 실행한다.

앱 worker의 주기 정리 외에 로그인/앱이 켜져 있는 상태에서 이 검사를 실행하는 운영 감시가 필요하다. Mac/디스크가 정지한 동안 정확히7일째 물리파일 삭제를 보장할 수 없다. 재기동 시 요청 수신과 remote 호출 전에 만료를 정리한다. 이전 디스크 블록/파일시스템 snapshot의 forensic 삭제도 보장하지 않으며 pending 파일을 일반 백업에 포함하지 않는다.

운영 설치는 별도 root 적용: 서비스 env 세 경로+현재원장, 하루1회 기존 `daily-backup.mjs --prune-managed`(최근7일 정책), 주기적 storage-health/authority-health와 실패 전달. DB 일일백업 정책이 현재authority를 과거로 덮는 절차를 포함하지 않는다. 이 작업은 LaunchAgent 설치/실DB삭제/실사용자 unlink를 실행하지 않았다.
