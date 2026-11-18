# 현재 unlink 권위 저장소와 복원 latch

## 목표/경계

승인된 앱 즉시 탈퇴, 실패 unlink subject 최대7일 재시도, 성공/만료 제거, pending 재가입 차단을 앱 worker와 durable authority로 연결한다. 이 작업은 storage/runtime/restore 담당이며 domain/provider worker는 별도 변경이다. 실제 사용자/Kakao 호출/운영파일/스케줄/권한 변경은 없다.

## 구현

mutable pending(subject)+subject/hash없는 append-only prepared/terminal chain+checkpoint. canonical 재시도 기한, lease/backoff, 멱등 cleanup, orphan send차단, known prefix/witness와schema18복원필수표시, production 경로/alias/webroot/backup 경계. 비식별 집계 health와 명시 empty initializer만 제공하고 자동초기화하지 않는다.

## RED/GREEN와 한계

초기 adapter는 모듈없음 RED에서 시작했다. restore latch는 실제 큐누락검사가 성공해 RED, write전역방향시각검사는 throw없는 RED를 거쳐 수정했다. adapter10개 및 복원/CLI 합성시험을 실행했다. API 전체 첫 실행에서 새restore fixture의 child만 queue env를 안 읽어 실패했고, 기존production helper와같이 child배선을 추가했다. 기존 단언은 유지했다.

최종 실제 counts는 parent report와 이 작업의 실행결과를 따른다. 운영 장애의 exact7일 물리삭제, 전체authority+DB동시rollback, 외장SSD손실, provider의 실제5초응답/취소는 합성시험으로 보장하지 않는다. 현재authority를DBbackup과분리하고 운영전정확경로/초기상태/복원checkpoint검증이 필요하다.
