# #172 메뉴 선택

실제 `domain/menu.ts` 및 `TravelMenuEngine` 계약을 사용한다. 설정은 `{}`이며 선택된 각 참가자가 메뉴 한 개를 제안하거나 패스한다. 전원 응답 후 최다 후보를 선택하고 동률이면 서버가 추첨한다. 전원 패스면 no-choice다. 앱은 후보 원문을 `{type:'submit',menu}`로 전송하고 서버의 정규화 응답만 확정값으로 표시한다. 로컬 NFC/소문자변환/집계/난수/타인 후보 목록을 만들지 않는다. 진행자는 참여 여부와 별도로 `{type:'cancel'}`로 수집 중단할 수 있다.

연결: shell 소유 설정 route의 configure builder는 `MenuSetupForm(selected: ids, names: authorizedNames, onComplete: done)`을 반환한다. play는 `MenuGameView(run: run, controller: controller, viewerMembershipId: selfId)`를 쓴다. 필수 accountScope 및 PendingGameCommands owner는 공통 셸 계약을 따른다. 후보 제출 전에도 타인 후보/응답수/득표수/작성자를 보여주지 않으며, 서버 DTO의 본인 submission 및 최종 result만 사용한다. 입력은 route·계정/판·phase 변경과 background에서 제거되고 디스크에 보관하지 않는다. 불확실한 전송 intent만 세션 소유자에 남아 사용자 명시 같은 ID/bytes 재시도를 허용한다.

TDD: 모듈 부재 RED 후 focused9 PASS. 빈 설정/후보 ack 대기·서버정규화 응답/패스 no-choice/모호한 응답 exact intent retry/관전자 응답차단 및 비참가 진행자 중단/409 최신결과 GET/새 판 oldresponse 차단/background 미제출후보 제거/null·redacted 안전표시. 초기 widget 3실패는 enterText 직후 활성화 프레임을 반영하지 않은 시험 순서였고 입력 frame을 pump한 후 같은 검증을 통과했다. scoped Flutter analyze issue0.

브라우저 부하 비교와 parent의 검사 조율을 위해 이번 커밋은 menu focused 검사만 실행했다. 이전 games37 PASS와 단순 합산하여 이번 전체46개 통과로 주장하지 않는다. 최종 통합 전체 모바일·독립 리뷰·실제 네이티브 BFF/Kakao·실기기/원격 인수·배포는 별도 미완료다. main/pubspec/기존 서버는 변경하지 않았다.
