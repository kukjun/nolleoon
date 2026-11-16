# MVP 순차 실행 기록

상태: 진행

## 목표·범위
승인된 MVP-01~32를 GitHub 이슈로 생성한 뒤 선행 관계에 따라 계획 → TDD → 구현 → draft PR → 독립 리뷰·검증 → 완료 순서로 진행한다. 실제 완료·배포와 문서 초안을 구분한다. 필요한 추가 이슈를 기록하고, 중요한 미확정 결정은 `critical`로 보류해 독립 작업을 계속한다.

## 현재 결과
- GitHub #1~32 생성, 전체 목록에서 32개 OPEN 확인.
- 각 이슈에 범위·선행 이슈·REQ 추적·RED 사례·AC·검증란 포함.
- #33은 피고 퇴장 중단의 이력 공개 범위 결정이며 아직 미해결.
- MVP-01 기준선 작업 착수. 이전 미커밋 하네스와 UI 시연은 보존.
- 기존 하네스 자체 시험: `node --test tests/harness/*.test.mjs` 9/9 통과. 제품 수용 시험 아님.

## 승인·안전 경계
공개 저장소에는 가상 데이터와 프로젝트 코드/문서만 게시한다. 비밀·개인 데이터·DB·작업 증거 원문은 제외한다. PR 검증/리뷰 전 자동 완료하지 않는다. 외부 배포·네트워크/보안 설정·데이터 파괴는 별도 해당 승인 규칙을 따른다.

## MVP-01 검증
- 변경 전 문서 계약 시험 RED: 4개 실패, 종료 코드 1.
- 문서 정리 후 최종 GREEN: 6개 통과, 실패·skip 없음. 리뷰 회귀 2개 포함.
- 독립 리뷰 지적 2건(방장 개시 문구, 삭제된 참조) 수정 후 재리뷰 승인.
- 활성 문서 링크 및 공개 부적합 정보 검사, diff 검사 통과.
- 이 검증은 문서 기준선에 한정하며 제품 동작·배포 완료를 뜻하지 않는다.

## MVP-02 진행
- #1은 PR #34 병합 후 CLOSED 확인.
- 앱 부재/환경 검증/계층 검사 RED 3개 실패, 빌드 전 smoke 실패 확인.
- React/Nest/공유 계약 workspace와 루프백 실행 기반 구현.
- GREEN 환경·구조 계약 5개 통과, 의존성 검사·빌드·HTTP smoke 통과.
- 깨끗한 staged 소스 내보내기에서 npm ci·계층 검사·전체 빌드·HTTP smoke·문서 6개 시험 통과. 독립 리뷰의 type-import 누락 지적은 회귀 RED→GREEN 후 재승인.

## MVP-03 검증
- #2는 PR #35 병합 후 CLOSED 확인.
- 확장 시험 RED 12개 중 3개 실패, fake 대역 미구현 실패 확인 후 구현.
- 깨끗한 소스 복사본 npm ci 및 전체 check: 하네스 15·workspace 5·문서 6·unit 3·API 1·Chromium 1 통과. lint/계층/build/type 통과.
- 빈 시험·skip/TODO·실행불가·timeout은 통과하지 않으며 미구현 DB/게임/실기기/외부접속은 별도 미구성 표시.
- 원격 CI는 게시 후 별도로 확인하며 로컬 통과로 대체하지 않는다.
- 독립 리뷰 후 새·중첩 시험 자동 수집을 추가하고 회귀 RED→GREEN, 전체 하네스 재실행·재리뷰 승인.
- 최종 소스 재검증 중 제한된 실행 환경의 Chromium MachPort 권한 오류로 브라우저 검사가 실패했다. 코드 변경/보호 설정 변경 없이 허용된 정상 실행 환경에서 전체 check 재실행해 전부 통과했다.
- 실행 workflow 게시가 GitHub OAuth workflow 범위 부족으로 거부됨. #36에 차단 기록, 실행되지 않는 docs/ci 초안으로 보존. 원격 CI는 미실행/차단. #3 AC가 CI 초안과 원격 미실행 명시를 허용하므로 로컬 기반 완료와 최종 CI 인수 차단을 분리한다.

## MVP-04 검증
- #3은 PR #37 병합 후 CLOSED. 원격 CI 인증 #36은 별도 OPEN 유지.
- 실제 DB 기반 RED 후 저장소 구현. 지원하지 않는 스키마를 허용하던 결함은 RED→GREEN으로 수정.
- 독립 리뷰의 제약 시험 fixture 강화 후 DB 15개 통과. 복합 FK 2개/index 2개를 임시 빌드에서 제거한 변이 시험은 각각 실패했고 원복·재빌드했다.
- 깨끗한 소스에서 npm ci 및 better-sqlite3 네이티브 rebuild·빌드·DB 시험 검증. 전체 하네스와 독립 재리뷰 통과.
- Node ABI 137, better-sqlite3 13.2.0, 실제 SQLite 3.54.1. 백업 복원/실제 데이터 연결/인증·게임 기능/원격 CI는 이 성공에 포함하지 않는다.

## MVP-05 검증
- #4는 PR #38 병합 후 CLOSED 확인.
- 초기 `node --test tests/unit/sessions.test.mjs`는 구현 전 모듈 부재(ERR_MODULE_NOT_FOUND)로 tests 1/pass 0/fail 1, 종료 코드 1. assertion 실행 전의 RED임을 구분한다.
- 최종 깨끗한 소스 npm ci/native rebuild·전체 check 통과: self15/workspace5/docs6/unit4/API4/DB15/browser2와 lint/layers/build/types. 실제 main+Vite 개발 경로의 401→쿠키발급→복구 smoke 통과.
- 독립 리뷰 승인. 쿠키 flags/동일·신규 브라우저/위조·만료·CSRF/서버 재시작을 확인. 실제 모바일·외부 HTTPS·게임별 권한·원격 CI는 미검증.

## MVP-06 검증
- #5는 PR #39 병합 후 CLOSED 확인.
- 구현 전 브라우저 입력 탐색 timeout으로 expected0/unexpected1, 종료 코드1 RED 확인.
- 모바일 디자인 시스템과 세션 셸 구현 후 깨끗한 소스 npm ci/native rebuild·전체 check 통과, 브라우저5 포함. 독립 코드·시각 리뷰 승인.
- 390 모바일 홈, 320 갤러리·모달, 1440 데스크톱 스크린샷을 직접 확인. 입력 오류/비동기 실패/중복 방지/모달 반복·포커스/320x360 스크롤과 세션 회귀 검사.
- 에뮬레이션이므로 실기기 키보드·노치·VoiceOver 합격으로 주장하지 않는다. 기존 ui 원본은 보존했다.

## MVP-07 검증 · M1 완료
- #6은 PR #40 병합 후 CLOSED 확인.
- 초기 presenter 모듈 부재 RED(tests1/fail1/exit1) 후 계약 구현. 진행 이유 공개·전체 entity 직렬화·피고 투표 허용의 3개 보안 변이는 각각 시험 실패를 확인하고 원복.
- 깨끗한 소스 npm ci/native rebuild·전체 check 및 실제 main/Vite smoke 통과: unit14/API5/DB15/browser5와 self15/workspace5/docs6 및 정적 검사.
- 독립 개인정보 공개·권한·오류 리뷰 승인. 실제 게임 endpoint·마감 엔진은 후속 범위이고 action 표시는 명령 허가의 대체물이 아니다.
- M1 개발 기반 1~7 구현·검증을 마쳤다. #33 공개 결정과 #36 원격 CI 인증은 미해결이며 전체 MVP 인수는 미완료다.
