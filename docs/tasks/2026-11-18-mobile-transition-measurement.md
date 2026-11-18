# #189 모바일 단계 전환 측정 안정화

상태: 부분 수정 검증 완료

## 목표와 범위
실제 팀 설정 화면이 나타난 뒤 접근성을 측정한다. React가 이전 선택 화면을 제거하는 동안 별도 프로토콜 호출에 걸쳐 유지된 DOM 배열을 측정하지 않는다. 제품 코드·44px 최소 터치 영역·가로 넘침·reduced-motion 기준·timeout·retry는 바꾸지 않는다.

## 근거와 합격 기준
기존 실패는 팀 설정 측정에서 이전 게임 선택 버튼을 모두 0×0으로 기록했다. 당시 연결 여부가 기록되지 않아 원래 실행의 경합을 단정할 수는 없다. 같은 원본 320px 시험의 독립 재실행은 통과했다. 새 helper는 실제 팀 시작 버튼 visible을 기다리고 한 번의 브라우저 JavaScript 실행 안에서 현재 노드를 선택하고 측정한다.

- 지연된 화면 전환 이전 버튼을 새 단계의 측정 결과로 사용하지 않는다.
- 실제 43px 버튼은 계속 실패 대상으로 검출한다. 숨겨진 버튼은 제외한다.
- 기존 실제 게임 320/360/390px 접근성 회귀를 유지한다.

## 실행과 증거
- 수정 전 helper에 지연 전환 시험 실행: 2개 중 1 실패·1 통과(6.5초). 새 단계가 나타나기 전에 이전 43px 선택 버튼이 측정되는 RED 확인.
- 전체 workspace build 통과.
- 수정 후 `playwright test --config=playwright.party.config.mjs tests/browser/party-mobile-measurement.spec.mjs tests/browser/party-mobile-accessibility.spec.mjs --reporter=line`: 합성 2개 및 기존 실제 게임 320/360/390px 3개, 총 **5개 통과(47.9초)**. retry 0, 개별 제한 및 기존 합격 기준 불변.
- 변경 파일 ESLint 및 `git diff --check` 통과. 브라우저 종료 뒤 4179 listener 없음 확인.

## 미해결
같은 원본 전체 하네스의 browser-launch 360초 timeout 원인은 별도 조사 대상이다. 이 변경으로 해결했다고 주장하지 않는다. 전체 하네스·실기기·운영 검증은 이 작업에서 수행하지 않았다. #189의 전체 완료를 뜻하지 않는다.
