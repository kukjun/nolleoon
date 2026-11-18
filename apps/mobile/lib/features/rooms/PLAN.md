# #167 여행방 홈·로비

## 경계
기존 native BFF의 계정 멤버십을 조회한다. 앱용 방 복제, 로그인 대역 성공, 게임 정책, 운영 변경은 없다. `RoomsScreen`을 인증된 accountId 키 아래 주입하고 로그아웃/계정 전환 때 subtree를 폐기한다. auth/main/data/shared 컴포넌트는 이 작업 소유가 아니다.

## 합격 기준
- 실제 ApiClient + 합성 transport로 목록 cursor, 생성 body, 응답 파싱을 확인한다.
- 생성 중 중복 요청 차단, 불확실한 생성 실패는 동일 requestId/body로만 재시도한다.
- 로비는 관리자/게임 진행자/연결 여부를 구분한다. 오프라인은 탈퇴가 아니다.
- 로비의 10초 polling은 foreground에만 동작하고 화면/계정 종료 시 취소한다. background에는 보호된 내용을 지우고 복귀 시 재조회한다.
- 권한 소실/새 탐색/느린 이전 응답은 오래된 명단을 되살리지 못한다.
- 선택 날짜, 빈 화면, 실패/재시도, 목록 더 보기, 작은 화면을 시험한다.

## 검증 기록
테스트 원고를 컨트롤러 구현 전에 작성. 공유 Mac API gate 때문에 실행은 parent의 재개 통지 대기. 실제 native 서버·카카오·실기기·운영은 별도 미검증.

## 최종 구현/검증
- `RoomsRepository`는 실제 `ApiClient` / `NativeRoutes`를 사용한다. 생성에 requestId/title/startDate/endDate만 보내고 expectedVersion을 임의로 넣지 않는다. 조회는 목록 cursor와 roomId 계약을 따른다.
- 생성 응답 유실에는 불변 mutation intent를 유지하고 입력 변경을 막는다. 취소 후 목록으로 돌아가면 서버에서 이미 생성됐는지 먼저 확인하도록 경고한다.
- 401/FORBIDDEN/NOT_FOUND/ROOM_CLOSED 보호 데이터 제거, 늦은 응답 세대 차단, foreground 복귀 재조회, 10초 로비 polling을 구현했다. inactive 시 내용 제거 후 paused에서는 요청하지 않는다. OS 앱 전환 스냅샷의 실기기 프라이버시까지 검증한 것은 아니다.
- 로비는 방 관리자/게임 진행자/오프라인을 별도로 표기한다. 사진/프리셋 이미지 연결은 이 변경 범위가 아니며 기본 인물 아이콘만 사용한다. 게임 생성·관리·초대·기록은 별도 feature가 연결한다.
- 게임 진입은 `Future<void> Function(roomId, runId)? onOpenRun` 주입이다. future는 게임 route가 닫힐 때 완료해야 한다. 그동안 로비 polling/데이터를 중지하고 복귀 시 다시 조회한다. 콜백이 없으면 연결 준비 안내만 표시하며 가짜 성공은 없다.
- auth owner는 `RoomsScreen(repository:, onSessionLost:, onOpenRun:)`을 **accountId 키** 아래 설치하고 로그아웃/계정 변경 시 폐기한다. main/auth는 수정하지 않았다.
- RED: 컨트롤러가 없는 상태에서 테스트 로딩 실패 확인. 이후 실제 실패(취소 microtask 관찰, 모의 오류 envelope, material_ui 테스트 루트, paused 프레임 비활성)를 구분해 올바른 계약/생명주기 테스트로 고쳤다. 서버 보호/제품 기준을 약화하지 않았다.
- GREEN: feature 12개 (repository/controller 7 + widget 5)와 전체 31개 통과. 320/390 폭 생성→로비→목록, 작성 취소/유지, 실제 API body/path, cursor, 중복 생성/동일 intent 재시도, 늦은 탐색/권한 소실, polling/foreground/dispose 포함. `flutter analyze` No issues. 실제 서버/Kakao/기기/외부 배포/이미지 시각 검수는 미실행이며 합성 transport + Flutter 위젯 결과만이다.

## Lifecycle follow-up
`RoomsCreateRecovery(accountId)` is an optional account-bound memory-only owner supplied by auth composition. It retains only an immutable uncertain create payload across same-account verified remount; it never replays automatically. The create screen restores title/dates and requires explicit retry. Runtime account mismatch throws. Auth composition MUST call clear() on explicit logout, expired sign-out, or account switch; feature clears on success/known rejection/explicit abandon. Unsubmitted drafts are still not retained across full auth-subtree disposal (UX limitation, not duplicate mutation). Added two recovery tests; feature 15 passed after date-only draft fix.
