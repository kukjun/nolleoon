# 개발 검증 하네스 · MVP-03

검토한 저장소 코드의 실행·판정·증거 루프다. 제품 전체 완료나 권한 격리를 보장하지 않는다. 기반 헬스·Nest HTTP·SQLite·Chromium 검사에 기능별 회귀를 추가한다. 현재 구현 범위와 실제 개수는 각 실행 report 및 [작업 기록](tasks/2026-11-16-mvp-execution.md)을 확인한다. MVP-27부터 별도 실제 다인 gameplay E2E gate를 실행한다. 실기기·외부 접속 및 전체 제품 최종 인수와는 별개다.

## 설치와 실행

Node 24.x / npm 11.x. [로컬 기반](local-development.md)을 따른다.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm rebuild better-sqlite3
node node_modules/@playwright/test/cli.js install chromium
npm run check
```

Linux에서 필요한 시스템 라이브러리가 없으면 CI처럼 공식 Playwright `install --with-deps chromium` 절차를 사용한다. 설치는 네트워크 다운로드를 포함한다. 로컬 운영·보안 설정을 자동 변경하지 않는다.

개별 검사:

```sh
npm run test:harness
npm run lint
npm run build
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:database
npm run test:browser
npm run test:e2e
npm run test:mobile
```

unit/integration/browser는 빌드 산출물을 사용하므로 build를 먼저 한다. 전체 check는 빌드를 직접 수행하고 실패 시 그에 의존하는 검사를 blocked로 표시하여 이전 산출물로 성공을 만들지 않는다.

## 실행과 판정

- Node TAP: 실제 tests/pass/fail/skipped/todo/cancelled 수를 기록한다. 빈 파일의 암묵적 시험은 거절한다. 0개·skip·todo·미완료는 합격이 아니다.
- Playwright JSON: expected/unexpected/skipped/flaky 수와 errors를 검증한다. 빈 시험·skip은 incomplete, 실패·flaky·오염된 JSON은 failed다. JSON이 아닌 출력 형식을 임의로 통과시키지 않는다.
- lint/type/build: 실제 ESLint, TypeScript, workspace 빌드 명령의 종료 코드를 기록한다. 이런 명령에 가짜 시험 수를 부여하지 않는다.
- 파일/실행 환경 누락은 blocked, 잘못된 설정·assertion·시간 초과는 failed다. 준비한 필수 검사 중 passed 아닌 것이 하나라도 있으면 check 종료 코드는 1이다.
- 다인 gameplay E2E·실기기·외부 배포는 아직 not-configured 계획으로 별도 표시한다. 검증 기반 성공을 제품 전체 인수로 표시하지 않는다.

## 구성

`tools/harness/check.mjs`가 repo 문서, 러너 자체 시험, 문서/workspace 계약, lint, 계층, build/type, unit, API integration, 브라우저 기동 순서로 검사한다. Node 시험 그룹은 공유 discovery로 지정 디렉터리 아래 `*.test.mjs`를 재귀 탐색·정렬한다. 개별 npm 명령과 전체/CI가 같은 탐색기를 사용하며 빈 디렉터리·심볼릭 링크는 거절한다. 과거 tests/ui는 포함하지 않는다.

`tests/support/fakes.mjs`의 FakeClock과 SequenceRandom은 경계 시험용 대역이며 실제 게임 정책을 대신하지 않는다.

각 실행 전 Git HEAD와 dirty 상태, 시작 시각을 기록하고 종료 시각·Node/OS/CPU·명령·출력·종료 코드·개수·소요 시간을 `artifacts/harness/<실행>/report.json`에 저장한다. 이 경로는 ignored이고 자동 업로드하지 않는다. HEAD+dirty 목록은 맥락이지 암호학적 빌드 증명이 아니다. 공개할 로그는 비밀·개인정보를 검토한다.

## 실패 주입과 경계

자체 시험은 assertion 실패, 비정상 종료, 타임아웃, 파일 누락, 빈 설정/빈 시험, skip/todo, 혼합 pass/skip, Playwright 실패/빈값/skip/flaky/오염 출력을 주입한다. macOS/Linux에서 각 검사 프로세스를 별도 그룹으로 실행하고 종료/시간 초과 후 같은 그룹 손자 프로세스도 정리한다. 실제 쓰기 ticker를 띄워 정리 이후 멈추는지 시험한다.

이 도구는 샌드박스가 아니다. 선택한 코드가 현재 사용자 환경을 상속하며, 프로세스 그룹을 이탈하는 악의적 데몬·출력 위조·비밀 탐지를 보장하지 않는다. Windows 프로세스 트리 격리는 지원 범위가 아니다. 외부 바인딩·배포·설정/권한·인증 변경은 별도 경계다.

AGENTS는 의도/원칙 안내, runner는 측정, CI는 다른 환경의 재검증이다. Codex 전역 훅·신뢰 설정·브랜치 보호·required check를 설정하지 않았다. 자동 수정/커밋/배포도 하지 않는다.

## CI

`docs/ci/harness.yml`은 실행되지 않는 초안이며, 승인된 인증으로 게시되면 read-only contents 권한으로 npm ci, 공식 Chromium 설치, 동일 check를 실행하도록 작성했다. 비밀값/배포 단계/외부 결과 업로드가 없다. 원격 실행 결과는 해당 GitHub run을 실제 확인한 뒤 기록하며 로컬 통과만으로 원격 통과를 주장하지 않는다.

## 원격 CI 게시 차단
GitHub OAuth 인증에 workflow 범위가 없어 실행 workflow push가 거부되었다. CI 정의는 실행되지 않는 `docs/ci/harness.yml`에 보존한다. #36 해결 전 원격 CI는 미실행/차단이며 로컬 통과와 구분한다. 인증이나 보호 설정을 임의 변경하지 않는다.

## 종합 gameplay E2E

`@e2e`가 붙은 시험은 `gameplay-e2e` gate에서만 집계하고, 기존 `browser-launch` 기능 회귀 gate는 해당 태그를 제외한다. 전체 `check`는 두 gate를 순서대로 실행한다. 독립 컨텍스트·요구 연결·실패 증거의 해석은 [E2E 인수 근거](e2e-acceptance.md)를 따른다. 실기기·외부 배포 planned 항목은 계속 미완료로 남긴다.

## 모바일 자동화와 실기기 차단

`@mobile`은 별도 `mobile-emulation` gate에서 실행한다. 기존 기능 gate는 `@e2e|@mobile`을 제외하고 종합 E2E는 `@e2e`만 실행한다. `mobile-device` planned 항목은 물리 기기 접근 미확보로 `blocked`이며 자동화 성공으로 해제하지 않는다. [실기기 인수 체크리스트](mobile-acceptance.md)를 따른다. 전체 자동화 status와 제품 인수 완료는 다른 지표다.

## 외부 인수 준비

`external-deployment`는 실제 배포 승인·적용 #65 대기로 `blocked`다. 로컬 E2E/production smoke 성공으로 해제하지 않는다. [외부 인수 체크리스트](external-acceptance.md)와 빈 evidence 템플릿은 준비용이며, 오프라인 증거 형식 검사는 네트워크 요청 없이 최대 독립검토 준비 상태만 반환한다. 외부 도메인에서 방을 생성하는 시험을 일반 `npm run check`에 추가하지 않는다.
