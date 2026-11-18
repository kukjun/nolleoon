# #171 제비뽑기

서버 TravelDrawEngine의 prepare는 `{winnerCount, penaltyText}`, start는 선택 참가자의 제비를 사전 배정한다. action은 본인의 `{kind:'reveal'}`만 받는다. 앱은 배열/격자 선택이나 로컬 난수/당첨 계산을 만들지 않는다. 화면은 self.canReveal 및 서버가 이미 공개한 revealed만 사용한다. 결과 acknowledgment 전에는 당첨/통과 표시를 만들지 않는다.

연결: 최신 GameScreen.configure builder에서 `DrawSetupForm(selected: ids, names: authorizedNames, onComplete: done)`을 반환한다. play는 `DrawGameView(run: run, controller: controller, viewerMembershipId: selfId, names: authorizedNames)`이다. 진행자 시작/취소, version, pending owner, 명시 동일intent retry는 공통 셸이 맡는다. 원래 판을 재시작하는 API를 만들지 않고 새 판은 별도 createRun 흐름으로 시작한다. 사람 아이콘은 사진 연동이 아닌 placeholder다.

N은 1..선택 참가 인원, 참가자 2명 이상, 벌칙 입력 필수/500 code point 안내를 제공한다. 최종 입력/권한/한 방 한 판/참가자 동결은 서버가 검증한다. 10분 종료를 앱 시계로 판정하지 않는다. 서버 incomplete/409를 받아 공개된 부분만 표시하고 숨은 winner 수를 계산하거나 추정해 보여주지 않는다.

TDD: 초기 모듈 부재 RED 후 draw 10개 GREEN. 2/3/5인 wire fixture, 본인 1장/관전자 제비 없음, ack 대기·중복 disabled, 네트워크 모호성 같은 bytes 명시 retry, incomplete 공개부분만, deadline409 후 GET, 새 run 전환 뒤 옛 response 거부, N/벌칙 form, completed/null/redacted 안전 표시. NativeApiClient+strict DTO+fake transport를 사용하는 합성 검증이다. 전체 games37 PASS, scoped analyze issue0.

실제 네이티브 BFF·Kakao·실기기·원격 인수/배포·앱 callback registry 연결은 별도 미완료다. 실제 hidden allocation/사용자 정보는 읽지 않았다.
