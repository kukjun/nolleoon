# #164 / #168 초대 화면 부분 구현

## 범위
서버의 최소 preview(available/loginRequired)만 표시한다. 로그인은 참가가 아니며, 취소해도 PendingInvitation을 보존한다. 참가 버튼에서만 join한다. 동일 참가 요청의 네트워크 불확실성은 같은 requestId로 재시도하며 새 계정으로 바뀌면 이전 mutation을 버린다. 이미 참가한 사용자는 서버가 반환한 기존 RoomDto로 이동하며 임의 오류 상태를 만들지 않는다.

작은 InviteSharingPanel은 관리자 전체 화면이 아니다. 명시적 issue/revoke + 선택적 공유 callback만 제공한다. issue 응답 유실은 새 토큰을 추측하거나 같은 issue를 자동 재전송하지 않는다. 방 snapshot 새로고침 뒤 새 요청으로 재발급할 수 있다. revoke는 같은 intent로 재시도한다. 공유 plugin은 설치하지 않는다.

## 연결 계약
- 부모가 PendingInvitation을 로그인 화면 밖에서 소유한다.
- InvitesController.open(검증할 전체 URL), setAccount(verifiedAccountId/null), onSessionLost, onJoined(RoomDto).
- InvitationScreen.onLoginRequested는 로그인 라우트만 연다. 취소 시 setAccount를 임의로 채우지 않는다. 성공해도 join은 자동 호출하지 않는다.
- controller는 account가 바뀌면 setAccount를 호출하고, feature route 폐기 시 dispose한다. 로그인 때문에 재생성하면 pending.current URI를 open하여 preview부터 재검증한다.
- InviteSharingController는 인증된 계정별 subtree에 두고 로그아웃/계정전환 때 dispose한다. updateRoom은 같은 방의 새 서버 snapshot에만 사용한다. 공유 callback에는 canonical 초대 URL만 전달한다.
- 실제 Universal/App Links 및 플랫폼 association 파일·카카오 SDK 로그인·운영 HTTP는 미설정/미실행 게이트다. 이 구현만으로 앱이 OS 링크를 수신한다고 주장하지 않는다.

## 검증
합성 ApiTransport 기반 controller/widget 시험이다. 실제 서버 인증·실기기 증거가 아니다. 참가 중 중복클릭/네트워크불확실성/새 초대/계정변경/401/404/최소DTO/issue 응답유실/revoke멱등과 320px 로그인 취소·명시참가를 검사한다. 현재 서버에는 정원초과 전용 계약이 없으므로 임의 ROOM_FULL 코드를 새로 만들지 않는다.

### 실제 실행 증거
- 최초 feature import/클래스 미구현으로 test loading RED 확인 후 controller/repository 구현.
- 최초 12개 통과 뒤 외부 PendingInvitation 교체 회귀를 추가하여 실제 RED(POST 포함 요청 2개, 기대 1개) 확인. preview/join 시작 전 현재 intent 동일성 검사로 수정 후 13/13 통과.
- Flutter 3.50.0 SDK, `flutter --suppress-analytics test test/features/invites`: 최종 13/13 통과. `flutter --suppress-analytics analyze --no-pub`: No issues found. 중간 analyzer의 brace lint 7건은 owned 파일에서 수정했다.
- 테스트는 합성 transport/controller/widget만 수행했다. main route 연결·실제 HTTPS 초대·OS Universal/App Links·실기기·외부 share sheet는 별도 게이트다. 기존 기능 전체 회귀는 coordinator 통합 후 수행한다.
