# #170 팀 나누기

범위는 기존 여행 게임 type `team`의 설정/대기/결과 renderer다. 서버 `TravelTeamEngine.prepare`는 `{teamCount}`와 선택 참가자, `start`는 진행자·draft 검사 후 참가자를 고정하여 balancedTeams 결과를 저장한다. 앱은 선택 명단과 팀수만 입력하며 자체 난수·배정·벌칙을 만들지 않는다. 기본 사람 아이콘은 사진 연동이 아니다.

연결: `GameScreen.configure`에서 type team일 때 `teamSetup(context, selectedIds, names: currentAuthorizedNames)`를 호출한다. `play`는 `TeamGameView(run: run,names: currentAuthorizedNames)`를 제공한다. 공통 셸의 진행자 시작/취소·불확실 동일intent 재시도·lifecycle을 그대로 사용한다. 앱 callback registry와 실서버 네이티브 연동/실기기 인수는 별도 미완료다.

초기 모듈 부재 RED 후 7개 widget GREEN: 실제 wire DTO 형식의 2/3/5인 서버 배정, 2/3팀 선택·취소·벌칙 없음, 1명 확정 차단, 미참가 현재멤버 결과 보기/제어 없음, incomplete 결과 없음, 진행자 expectedVersion3 시작409→GET 최신 결과 및 POST1회. 공통17개와 합친24개 PASS, games 전체 scoped analyze issue0. 서버 권한/CAS를 UI 판단으로 대체하지 않는다. 운영/실제 인증/배포 없음.

최신 셸 연결 계약: `configure`는 Future 함수 대신 Widget builder다. type team에서 `TeamSetupForm(selected: ids, names: names, onComplete: done)`을 반환한다. `teamSetup(...)` standalone helper를 셸 callback에서 호출하지 않는다. 정확한 설정 route/lifecycle 취소는 GameScreen이 소유한다.
