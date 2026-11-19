# #218 게임 화면 위계

현재 travel 테마/팔레트를 유지하고 UI 표시만 변경한다. 서버/권한/controller/API/세션 정책은 변경하지 않는다.

- 게임 카드에 실제 정책의 최소 인원을 안내한다: team/draw/menu 2명, trial 3명. application travel-team-draw-engines participants, domain/menu, trial 설정 및 시작 정책과 대조했다. 선택을 새 로컬 규칙으로 강제하지 않는다.
- 준비 화면은 24px 분리 뒤 게임 시작을 유일한 주 CTA로 두고 설정 수정은 보조, 준비 취소는 텍스트로 낮춘다. 버튼 callback/disabled 조건은 그대로다.
- 공통 shell의 불필요한 결과 wrapper Card를 없애 팀 결과의 중첩 카드를 줄인다. 개별 결과 제목은 같은 titleLarge, 설명/구획 간 12/16px 간격을 사용한다.
- 완료/미완료/중단에 optional onExit 콜백을 통한 로비 복귀 주 CTA를 제공한다. 서버 완료나 취소 명령을 보내지 않으며 feature shell이 기존 home 경로를 주입한다. active/draft에서는 표시하지 않는다.
- 최신 상태 확인은 텍스트 보조 액션, 오류는 live region과 error 색, 재시도는 기존 동일 intent로 유지한다.

## 검증
새 위젯 테스트에서 onExit 미구현 RED 후, 320×568/2배 및390×844/1.6배 긴 한국어 결과를 스크롤해 복귀 CTA hit-test와 콜백1회/서버 POST0, shell wrapper Card0을 확인한다. 큰 글자 작은 화면에서는 ListView가 화면 밖 자식을 아직 만들지 않으므로 ensureVisible 대신 실제 스크롤 후 hit-test로 검증했다. 실제 운영앱/계정/시뮬레이터는 접근하지 않는다. 전체 게임 회귀 및 analyze 결과는 아래 실측 기록을 따른다.

실측: 신규3개를 포함 게임 feature 70/70 PASS, 전체 flutter analyze clean(1.3초). 준비 화면의 주/보조/텍스트 버튼 종류·순서, 결과복귀 서버POST0 검증 포함. 전체 앱 통합·실제 렌더 증거는 별도 검증이다.
