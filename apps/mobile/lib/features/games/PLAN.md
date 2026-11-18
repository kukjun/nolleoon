# #169 공통 게임 흐름

범위: 기존 NativeRoutes/ApiClient 기반 repository, foreground 2.5초 polling controller, 공개된 DTO만 렌더하는 공통 셸. 서버가 판정·버전·참가자 동결·한 방 한 판을 결정한다. 게임별 입력/결과 화면은 후속 기능이며 callback 없이는 지원한다고 표시하지 않는다.

합격: create는 room version, edit/start/action/cancel은 run version을 고정한다. 불확실한 전송은 같은 intent로 명시 재시도만 가능하다. 409는 GET으로 최신 상태만 읽고 명령을 자동 재실행하지 않는다. background/logout/route 이탈은 요청 취소와 세대 차단으로 늦은 private 응답을 버리고 DTO·입력 intent를 비운다. foreground 복귀는 GET만 한다.

Native endpoint/실제 Kakao/실기기는 미검증이다. 변경은 games 디렉터리에 한정한다. RoomsScreen.onOpenRun(roomId,runId) 연결은 별도 앱 조립 담당이 한다.

## 검증 기록
- missing module RED 이후 repository/controller/widget 10개 GREEN. 10초 room polling은 요청1회로 남는 실제 RED 후 timer 추가로 GREEN.
- 실제 서버 request DTO를 읽어 create=room version, 나머지=run version을 사용했다. fake transport에 NativeRoutes/ApiClient/strict DTO를 함께 통과시킨 합성 검증이며 실제 원격 연결 증거가 아니다.
- scoped Flutter analyze issue0. Widget의 inactive 렌더 숨김과 controller의 background 메모리삭제/취소 검사를 별도로 시행했다(paused에서는 Flutter가 프레임 자체를 멈춤).
- 초기 추가 fixture는 activeRun에 불필요 version을 넣어 strict parser가 거절했으며 실제 DTO의 facilitatorMembershipId로 바로잡았다. Timer 보존 오류는 widget 시험 종료 전에 lifecycle 중단을 명시해 해소했다.
- 게임별 설정·투표·추첨·결과 화면, 계정 앱 route 조립, 실기기/원격 인증/배포는 미완료다. 공통 셸에서 callback이 없으면 입력기능 미연결을 표시한다.

## 독립 리뷰 후 identity 교체 보완
같은 Widget key에서 room/run만 바뀌면 옛 private projection이 남던 실제 RED를 재현했다. didUpdateWidget이 room/run/repository/viewer/accountScope 변경을 감지해 이전 controller·poll·요청·intent를 폐기하고 새로 읽는다. accountScope는 필수 비어있지 않은 문자열이며 동일 repository의 계정/세션 교체에도 갱신해야 한다. callback 인스턴스 변경만으로 입력을 초기화하지 않고 현재 widget callback을 호출한다. 이전 configure 완료는 새 계정/방에 명령을 보낼 수 없다. 추가5개+기존10개=15 PASS, 변경 파일 analyze issue0. team WIP는 이 보안 수정 커밋에 포함하지 않는다.

## 불확실 명령의 세션 수명 소유자
`GameScreen.pendingCommands`는 필수이며 인증 세션 상위에서 만든 `PendingGameCommands`를 같은 계정의 route remount에 재사용해야 한다. 앱 조립 담당이 로그아웃·계정 교체에 `clear()`한다. owner는 메모리 전용이고 디스크에 개인 명령을 저장하지 않는다. accountScope 변경은 옛 intent를 버린다. background/route dispose는 DTO를 지우지만 응답이 불확실한 immutable intent를 owner에 남겨, 돌아와 GET 확인 후 사용자 명시 retry만 같은 requestId/bytes로 전송한다. 새 명령으로 대체하거나 자동 offline 재생하지 않는다. 권한 상실과 로그아웃은 제거한다.

신규 owner 계약 부재 RED 후 accepted-response 지연→background→controller remount→명시 retry exact bytes, 새 계정 및 logout 제거 회귀를 추가했다. 공통17개 PASS, scoped analyze issue0. 이 owner를 앱에 실제 연결하는 것은 별도 조립 게이트다.

추가 방어: owner가 새 계정에 bind된 뒤 dispose 전인 옛 controller에서도 새 Bearer로 명령이 나갈 수 있던 단독 RED를 확인했다. 응답 수락뿐 아니라 dispatch 직전에도 owner의 accountScope 일치를 확인한다. 신규1+공통17+team7=25 PASS, games analyze issue0. 검증 이후 변경은 동일 if문의 lint용 braces뿐이다.

## 설정 모달 소유권 보완 (최신 configure 계약)
설정 대기 중 inactive가 epoch만 바꾸고 configuring을 영구 true로 남기던 독립 리뷰 RED를 재현했다. 기존 Future callback이 임의 root dialog를 띄우는 계약은 폐기했다. 최신 `configure(context, kind, ids, onComplete)`는 설정 Widget을 반환하며 새 route를 push하지 않는다. GameScreen이 정확한 DialogRoute를 소유하여 inactive/identity 교체/dispose에서 그 route만 제거한다. token identity로 옛 completion/finally가 새 설정을 취소·전송하지 못한다. 일반 취소/Back은 null 완료 후 GET 복귀한다. TeamSetupForm을 builder에 반환하고 standalone teamSetup helper는 앱 셸 밖에서만 사용한다.

신규 lifecycle/overlay2개 + 기존25개=27 PASS. same-key 계정교체 시험도 private 모달 제거를 검증한다. games scoped analyze issue0. registry 연결 담당에게 breaking configure 계약을 전달했다.
