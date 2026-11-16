# 실제 다인 E2E와 회귀 근거

## 무엇을 검증하는가

`tests/browser/gameplay-e2e.spec.mjs`의 `@e2e`는 실제 React→Nest→임시 SQLite 경로에서 독립 브라우저 컨텍스트를 연결하는 종합 흐름이다. 단일 브라우저의 역할 토글이나 mock 응답을 다인 게임의 증거로 사용하지 않는다. 기존 기능별 브라우저 회귀는 별도 gate로 유지하고 새 E2E와 중복 집계하지 않는다.

실제 Chromium 자동화는 실제 iPhone Safari·Android Chrome 실기기 검증이나 외부 도메인 접속 시험이 아니다. 전체 제품 인수는 계속 `partial`이다. #28 접근성/모바일 보완, #30 외부 배포, #31 독립 최종 리뷰, #32 최종 인수 및 #33 공개 정책 결정은 이 테스트 묶음의 성공으로 완료되지 않는다. 원격 CI #36도 별도다.

## 종합 여정

1. 다섯 신원이 설정·역할·수락·변론·동시 투표를 거쳐 유죄 결과를 확인한다. 종료 뒤 새 참가자에게 과거 내용이 노출되지 않는지 확인하고, 원래 참가자들은 재입장 없이 다음 판에서 새 피고(방장 겸임)·새 수락을 정한다. 첫 동률 → 새 최후 변론 → 재동률 무죄 → 두 판의 개인 기록까지 이어진다.
2. 다섯 신원의 진행 게임에서 이미 접수된 본인 표를 offline/online·reload 뒤 복구하고, 여섯 번째 신원은 관전자임을 확인한다. 방장 퇴장 → 서버가 선택한 새 방장 확인 → 피고 퇴장 중단/비공개 → 남은 전원 퇴장·방 폐쇄까지 진행한다. 방장 후보를 시험이 미리 지정하지 않는다.
3. 세 신원이 전원 기권하여 무판결을 확인하고 실제 입력한 기권 이유만 나타나는지, 새로고침과 개인 기록에도 같은 결과인지 확인한다.

종합 흐름의 모든 상태 변경은 실제 UI로 수행하고, 추가 HTTP 읽기는 비공개 필드·영수증·마감 등 서버 응답을 확인하는 데 쓴다. 10분 경계는 별도 API/프로세스 고정 시계 회귀로 검증한다. 기존 3/5/6명 기능 회귀와 서버 재시작 시험을 삭제하거나 종합 흐름의 실행 수에 더하지 않는다.

## 실행과 데이터 격리

```sh
npm run build
npm run test:browser
npm run test:e2e
npm run check
```

두 Playwright gate는 순서대로 실행하며 4179를 동시에 사용하지 않는다. 시험 서버는 실행마다 새 임시 DB를 만들고 종료 시 닫는다. 각 시나리오는 새 방·새 컨텍스트를 만들며 실제 사용자 쿠키/DB를 재사용하지 않는다. 두 gate의 JSON report는 각각 실제 실행 수를 기록한다. 0개, skip-only, unexpected failure, flaky 결과를 성공으로 계산하지 않는다. `retries: 0`을 유지하며 실패를 재시도 횟수로 숨기지 않는다.

신규 종합 E2E에만 `retain-on-failure` trace를 적용하고 기존 기능 회귀의 trace는 비활성 상태를 유지한다. 실패 screenshot은 두 gate에 적용한다. 실패 trace와 screenshot에는 합성 게임 데이터만 담긴다. ignored 산출물이며 공개 저장소에 업로드하지 않는다. 재실행 때 산출물이 교체될 수 있으므로 실패 원인과 해당 실행 경로를 먼저 작업 기록에 남긴다. 스크린샷만으로 API 권한이나 SQLite 내구성을 입증하지 않는다.

## 요구사항에서 실제 시험으로

아래는 관련 실행 파일의 색인이다. 한 행이 여러 설계 기대값을 묶어 연결하며, 해당 T 번호의 모든 변형/실기기 조건이 자동화됐다는 선언이 아니다. 구체 assertion과 실제 결과는 소스·실행 보고서가 기준이다. [REQ→담당 이슈](mvp/traceability.md), [T 설계](design/09-verification.md), [SC 흐름](design/03-mobile-flows.md)와 함께 읽는다.

| 요구/설계 범위 | 실제 코드와 증거 성격 |
|---|---|
| REQ-001~009,042~046,058 / T-01~03,36~43,56 | browser `rooms`, `roles`, `consent`, `start`; API 같은 이름 및 `security-regression`. 3/5/6 독립 컨텍스트와 2명 거절은 기능별 회귀, 종합 흐름은 5인 실제 참가 |
| REQ-010~014,019,024,041,066 / T-04~06,13,34~35,62 | browser `trial`, `votes`, `settings`; API `progress`, `votes`, `settings`. 실제 개시/변론과 서버 권한·CAS 경합을 구분 |
| REQ-015~017,020~021,062 / T-07,09~10,15,32,60 | browser `settlement`, `results`, `votes`; API `settlement`, `security-regression`; unit `tally`, `published-rounds`. 미제출 마감은 서버 고정 시계/monitor 시험으로 검증 |
| REQ-025~029,069~070 / T-14,16,18~19,64~65 | browser `revote`, `results`; API/DB `revote`, API `progress`; 1차 공개 보존·2차 분리·무표/재동률 정책 |
| REQ-018,030~031,034~035,038,054 / T-08,17,20~21,24~25,52 | browser `presence`, `recovery`, `session`, `votes`; API `recovery`, `sessions`; unit `deadline-clock`, `identity-generation`. 브라우저 offline/복귀와 실제 10분 경과를 혼동하지 않음 |
| REQ-036~039,049,051,061,063 / T-27~29,31,46,49,59,61 | browser `personal-history`, `close`; API `personal-history`, `results`, `security-regression`; unit `history-consistency`. 참가 이력 기반 접근, 종료 후 입장 거부, 중단 원인별 마스킹 |
| REQ-040,047~050,066,068 / T-30,33,44~48,62~63 | browser `next-game`, `start`, `host-transfer`; API `next-game`, `settings`, `host-transfer`. 다음 준비 세대와 오래된 명령/응답 격리 |
| REQ-052~053,055~060,064~065 / T-50~58,61 | browser `leave`, `host-transfer`, `close`; API `leave-expiry`, `host-transfer`, `room-close`. 명시적 퇴장 UI와 600000ms fake-clock 경계 시험을 별도로 기록 |
| REQ-021,037,055~057,068 / T-12 | API `durability`, DB `backup`: 실제 소유 자식 프로세스 SIGKILL/재시작, 온라인 백업·새 DB 복원. 전원 차단/실제 디스크 고장 시험 아님 |
| REQ-022,033,067 / T-11,23 및 입력 경계 | browser `design-system`, `security-text`; API `security-regression`. 키보드/작은 viewport/텍스트 출력은 자동화, 실기기 인수는 미완료 |

REQ-032/T-22는 폐기다. T-26 중국 현지 접속은 MVP 범위 밖이며 일반 외부 접속도 #30에서 따로 확인한다. 세부 미결정 중단 공개 정책은 #33이며 현재 보수적으로 숨긴다.

## RED와 최종 결과를 읽는 법

이미 구현된 기능을 종합한 새 시나리오가 처음부터 통과할 수 있다. 이를 가짜 기능 실패로 기록하지 않는다. 별도 gameplay gate 부재·분리 계약은 먼저 실패시키고 구현한다. 흐름 작성 중 실패가 생기면 제품 결함, 잘못된 locator/기대값, 실제 비동기 경계 중 무엇인지 구분해 기록한다. 최종 통과 개수·시간·커밋/worktree·보고서 경로는 해당 실행 근거를 따르며 고정 숫자를 최신 통과처럼 재사용하지 않는다.

초기 종합 흐름은 새 fixture가 방 생성 응답 완료 전에 홈 URL을 초대 링크로 읽어 첫 시험 90초 제한에서 멈췄다. 제품의 방 생성 결함이 아니라 시험 fixture의 비동기 경계 오류였다. 실패 trace/screenshot을 확인하고 소유한 runner만 중단한 뒤 실제 대기실 표시를 기다려 URL을 읽도록 수정했다. 개별 assertion이나 기존 기능 시험의 제한을 늘리지 않았다.

다음 실행은 2개 실패·1개 통과(27.0초)였다. 다른 참가자인 피고의 변론 제출 직후 방장 화면이 아직 이전 version일 때 개시를 눌러 서버의 정상 CAS 409 보호에 걸렸다. 실패 화면의 안내를 확인하고 방장 화면에도 새 변론이 동기화된 뒤 개시하도록 시험을 수정했다. 자동 재시도나 CAS 보호 완화가 아니다. 초기 실패 산출물은 `artifacts/e2e-first-failure`, 이 동기화 실패는 `artifacts/e2e-cas-failure`에 별도 보존했다.

320px 유죄·재동률 무죄, 390px 피고 퇴장 중단·기권 이력 캡처를 직접 확인했다. 판결이 첫 영역에 보이고 긴 이유는 줄바꿈되며, 중단 화면에는 사건·벌칙·기존 투표 이유가 나타나지 않았다. 두 라운드 이유와 기권 이유 한 개가 구별된다. 이것은 Chromium viewport 확인이며 실물 기기 키보드·safe area 검증은 아니다.

최종 targeted `npm run test:e2e -- --reporter=line`은 3개 통과, 39.8초였다. 신규 긴 두 여정만 90초, 세 명 기권 여정은 60초의 시험 실행 예산을 명시했고 종합 gate는 150초다. 기존 65개 기능 회귀의 300초 gate·기존 개별 제한·assertion은 변경하지 않았다. 최초 중단 실행의 정확한 상태는 1개 실패·1개 interrupted·1개 미실행이며 성공으로 계산하지 않는다. 최종 독립 전체 결과는 별도 clean source 보고서를 따른다.
