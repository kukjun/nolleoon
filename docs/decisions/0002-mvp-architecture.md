# ADR-0002 · MVP 기술 구조

상태: 사용자 승인 큰 방향 + 위임된 최소 구현 설계. 2026-11-16. 제품 코드·배포 미검증. [현재 규칙](../design/00-current-rules.md)을 바꾸지 않는다.

## 배경과 결정

React + TypeScript 모바일 UI, NestJS 한 프로세스의 통합 BFF, SQLite 로컬 파일을 사용한다. 별도 BFF 서버는 네트워크/배포/인증 복잡도를 더하므로 두지 않는다. BFF는 controller/화면 DTO/입력 및 공개 필드 검증에 집중하고 판결은 domain/use case에서 수행한다. Nest provider로 clock/random/repository/session port를 주입한다. domain은 Nest와 DB에 의존하지 않는다.

대안: 별도 BFF 프로세스, 네트워크 DB, 캐시/메시지 브로커는 MVP 규모에 추가 운영 부담이므로 보류한다. SQLite는 단일 인스턴스·짧은 쓰기 transaction에 맞춰 사용하고 다중 서버 쓰기나 무제한 동시 접속을 보장하지 않는다.

## 저장소·마이그레이션

드라이버는 better-sqlite3를 우선 선택한다. Node ABI 호환성과 설치/빌드 성공은 저장소 티켓에서 검증 후 버전을 lockfile에 고정한다. WAL, foreign_keys, busy timeout을 연결 초기화에서 명시하고 실제 설정/잠금 시험을 한다. 한 프로세스에서 transaction을 짧게 유지한다. 순번 SQL 마이그레이션과 schema_migrations 테이블로 적용 이력을 추적하고 migration transaction 실패 시 이전 스키마를 보존한다. 배포 전 backup/restore는 후속 운영 시험이다.

## 상태 동기화·시간

MVP는 HTTP 폴링 snapshot을 선택한다. 추가 실시간 서버 없이 복귀/버전 검사와 재시도를 검증하기 쉽다. 폴링 주기와 연결 감지 간격은 기능 티켓에서 모바일 배터리/백그라운드 실측으로 정한다. 서버가 단절로 판정한 시각(disconnectedAt)부터 600초를 유예하며 경계에서 now >= disconnectedAt+600초면 퇴장 확정한다. 유예 시작 시각 자체는 감지 지연의 영향을 받으므로 즉시 감지를 보장하지 않는다.

새 투표 접수는 transaction 안 서버 now < deadline인 경우만 허용한다. 이미 저장된 동일 요청 재확인은 마감 뒤에도 기존 접수 결과를 반환한다. 모든 명령/정산은 game/round/status/version을 검사하며 재시작 시 저장된 미완료 마감/유예를 다시 평가한다. 서버 시간은 epoch UTC, 화면은 serverNow 대비 남은 시간이다. 기기 시간대가 개별 마감을 만들지 않는다.

## 세션·권한

난수 opaque 세션 토큰은 HttpOnly/Secure/SameSite 쿠키, 서버에는 hash를 저장하는 설계다. 단일 origin 프론트/API를 기본으로 하며 변경 명령의 origin/CSRF 검증을 둔다. 초대 링크는 입장 수단일 뿐 과거 결과/투표권 인증이 아니다. 브라우저 히스토리는 표시 인덱스이며 서버 game 참여 권한이 최종 기준이다. 세션 수명/갱신은 세션 티켓에서 기록 접근 목표와 함께 고정한다. 권한/비밀값은 로그에 넣지 않는다.

## 관측·배포·검증

요청 식별자, 오류 코드, 처리시간, 상태 전이 종류를 구조화해 기록한다. 닉네임/사건/이유/토큰을 기본 로그에서 제외한다. health/readiness와 DB 오류를 구분하고 마감 작업 실패를 발견할 수 있게 한다. 실제 로그·보관 설정은 후속 티켓에서 검증한다.

Mac mini + 기존 Cloudflare Tunnel 방식. 별도 포트/DB/서비스, 기존 서비스 변경 금지. 외부 HTTPS 접속 확인만 배포 게이트이며 중국 현지 네트워크 시험은 제외한다. Tunnel/도메인 credential 또는 권한 변경은 문서 승인만으로 실행하지 않는다.

정확한 버전은 #2 이후 공식 registry/호환성 검사·설치 결과로 고정한다. 현재 package.json의 Node 범위와 실제 설치 환경은 초기 구성 때 검증한다. 이 ADR은 아직 lockfile·성능·모바일·DB 복구·외부 접속의 성공 증거가 아니다. 피고 퇴장 중단 이력 공개는 #33 결정 대기이며 미정 필드 공개를 기본 허용하지 않는다.
