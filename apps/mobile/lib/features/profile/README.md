# #166 내 프로필

## 주입
`ProfileScreen(repository: ProfileRepository(ApiClient, AvatarClient), onSessionLost:, photoSource: optional)`를 검증된 accountId key 아래 마운트한다. 로그아웃/계정 변경 때 auth owner가 subtree를 폐기해야 한다. main/auth/rooms는 변경하지 않았다.

- 이름: 기존 profile revision CAS와 현재 presetId를 보내서 기존 사진을 덮지 않는다.
- 캐릭터: 원본 10 WebP를 바이트 그대로 복사했다. 꾸미기이며 게임 역할/권한과 무관하다. PUT 성공 후 session 재조회로 profile revision까지 갱신한다.
- 충돌: 최신 profile을 다시 읽되 사용자 입력/선택을 유지하고 자동 재저장하지 않는다. 실패를 저장 성공으로 표시하지 않는다.
- 사진: native platform picker 구현/권한 설정은 아직 없다. 기본 버튼은 비활성화하고 미연결 상태를 설명한다. 승인된 host picker가 ProfilePhotoSource를 주입할 때만 선택할 수 있다. 제어권을 넘긴 원본 byte는 crop 후 지운다. 1MiB JPEG/PNG/WebP, 헤더 메타데이터 4MP 검사 후 중앙 정사각형 256 PNG로 만들고 미리보기·명시 저장을 거친다. 서버가 MIME/픽셀/CAS/최종 WebP를 다시 검증한다. 자동 업로드하지 않는다.
- 인증 이미지: native Bearer로 읽고 URL/공용 ImageCache/디스크에 토큰·사진을 남기지 않는다. decoded image는 RawImage와 명시 dispose를 사용한다. 화면 비활성/권한 소실/폐기 시 profile과 byte를 제거하고 비동기 이전 응답을 무시한다. OS app-switcher 스냅샷/실기기 메모리 소거는 별도 미검증이다.
- 방/게임 멤버 이미지 연결은 이 profile route와 별도이다.

## 검증
구현 전 없는 AvatarClient/ProfileController 로딩 RED 확인. 기본 UI 테스트의 material/스크롤/real-codec fake-time 제약을 실제 원인에 맞게 수정했다. codec 작업은 runAsync로 실제 PNG를 생성·decode한다. 320/390 화면에서 프리셋 선택→취소/저장, CAS 최신화/409, 이름 검증, 이미지 byte 제거/401, 4MP 초과와256 crop을 시험한다. 합성 transport와 Flutter 테스트이며 실제 카카오/서버/기기/스토어·운영 성공을 의미하지 않는다. 최종 실행 개수는 전달 보고 참조.

### Identity/review correction
`accountScope` is now required (verified account ID). Scope/repository changes dispose old controller/photos, invalidate pending picker completion, clear drafts and reload. Callback closure changes use the current callback without wiping a draft; picker implementation changes invalidate only picker state. 409 shows the latest server name alongside the preserved draft and offers explicit `최신 이름 사용`. A late failed conflict-refresh cannot clear a newer foreground profile. Regression includes same-repository account swap + delayed photo return, callback rebuild, and delayed 401 conflict-refresh.
