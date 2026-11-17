# PARTY 기준선 보존 · #78

새 구현은 기준 commit `3d6f782`의 별도 worktree에서 시작한다. 원본 작업 트리의 미완성 avatar 초안과 기존 UI/문서 미추적 파일을 이 worktree로 복사하지 않는다. 원본은 수정·삭제하지 않았다. 미완성 초안의 FailureCode 오류와 운영 코드 상태는 별개이며 원본 오류의 재현·파일별 보류 목록은 coordinator가 관리한다.

합성 schema9 fixture는 신원, 열린 방, 멤버, 초안·수락, 진행 재판·라운드, 완료 재판·불변 집계를 담는다. 먼저 완료 기록 누락을 시험으로 검출(RED 1)한 뒤 추가했고, SQLite 온라인 백업→새 경로 복원에서 각 행의 동등성을 확인했다. 같은 경로·기존 대상·손상 백업은 거절한다. 운영 DB는 읽거나 복사하지 않았다.

이 fixture는 이전 스키마의 정확한 정의로 생성한다. 후속 migration 적용 시험에서 기존 ID/내용/checksum을 유지해야 한다. 기본 설치는 lockfile의 공식 npm 의존성 설치(`--ignore-scripts`) 후 better-sqlite3만 명시적으로 rebuild했다. 전체 브라우저/배포 검증은 이 단계의 주장이 아니다.
