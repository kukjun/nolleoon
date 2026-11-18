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

## Native system picker adapter (code complete, native gate still closed)
`configuredNativePhotoSource(nativeConfigurationVerified: false)` defaults to no source. After separate native configuration/device approval, passing true on Android/iOS constructs `NativeProfilePhotoSource` with the real official `FlutterGalleryPicker`. It selects one gallery image, never camera/video, disables full metadata and opts into Android Photo Picker. `XFile.length` is checked **before** opening its bounded stream. Only JPEG/PNG/WebP signatures pass; original input must fit 1MiB. Existing 4MP/256px crop preflight follows. The adapter has no API client and cannot upload. Profile Save is still explicit.

Pinned registry packages: image_picker 1.2.4, image_picker_android 0.8.13+25, image_picker_platform_interface 2.11.2. Setup sources: [official plugin](https://pub.dev/packages/image_picker/versions/1.2.4), [official Android implementation](https://pub.dev/packages/image_picker_android). iOS uses PHPicker on iOS14+; the metadata flag avoids requesting full-library metadata. The plist contains a gallery-purpose explanation only, no camera/microphone entry. Android adds no broad storage/media permissions. Existing Flutter SDK minSdk=24 satisfies the plugin baseline; the app manifest is unchanged. Verify the final merged manifest and iOS14+ scoped-picker/device behavior before enabling the gate.

Interrupted Android recovery metadata is consumed only to discard it, never automatically attached to another account. Original gallery files are not deleted. The plugin/OS may create temporary sandbox copies; no app persistent image copy is created, and real-device temp-cache lifecycle remains an explicit privacy check. HEIC/GIF is not accepted by this JPEG/PNG/WebP input policy.

The system picker causes inactive/resume. Auth composition must verify that same-account return can complete the profile route while still blanking protected content; full subtree disposal intentionally discards late selection. Account changes must always discard it. Keep the gate false until that route/permission/cancel/process-death flow is verified. No OS prompt was accepted, no live photo was read, and no signing/deployment was performed here.

Tests use an injected picker/file port and the real image_picker Dart wrapper with a platform spy. They verify gate/cancel/size-before-read/growing stream/MIME/metadata flags. A synthetic EXIF6 JPEG is normalized using the real Flutter codec and checked for 256px rotated colour placement. These are not device-picker results.
