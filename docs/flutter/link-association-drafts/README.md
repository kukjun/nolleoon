# 플랫폼 연결 초안 · 아직 비활성

`app_links` 7.2.2 하나를 사용하고 Flutter 기본 deep-link 처리 플래그를 끈다. 패키지의 stringLinkStream에 초기·후속 이벤트가 포함되므로 별도 initial-link API를 중복 호출하지 않는다. NATIVE_INVITE_LINKS_VERIFIED 기본값은 false다. 이 상태에서 Dart의 plugin 객체/stream 구독은 만들지 않는다. 패키지의 네이티브 등록 자체를 비활성화한다는 뜻은 아니다.

## 출시 전에 별도로 검증할 것
- Android 실제 applicationId 및 실제 서명 SHA-256을 확인한 assetlinks.json. MainActivity에는 검증된 호스트의 HTTPS `/travel/invite/`만 의도한 intent-filter로 추가한다. 현재 실행 manifest에는 초대 intent-filter를 추가하지 않았다.
- iOS 실제 Team ID/Bundle ID, Associated Domains entitlement, 도메인의 apple-app-site-association. 현재 entitlement/도메인 파일/서명 설정은 변경하지 않았다.
- 두 플랫폼의 cold/warm 실행·중복·로그인 중 새 링크, 실제 Kakao callback 공존. 실제 검증 전 compile-time flag를 true로 배포하지 않는다.
- 초대 URL은 `https://nolleoon.kukjun.com/travel/invite/<opaque>` 완전 일치만 받는다. query/fragment/port/userinfo/encoded separator/제어문자/custom scheme는 초대에 사용하지 않는다. Kakao SDK custom callback은 SDK의 별도 설정을 유지하며 초대 라우터가 소비하지 않는다.

## Kakao 공존 소스 확인과 한계
공식 7.x iOS 구현은 defaultUrlHandling=.never로 다른 plugin에 이벤트를 전파한다. 이를 .availability/소비 callback으로 바꾸지 않았다. Android plugin은 MainActivity intent 처리 후 true를 반환한다. Kakao AuthCodeHandlerActivity 별도 경로는 변경하지 않았지만 실제 두 SDK 콜백 공존을 기기에서 검증하기 전 성공으로 주장하지 않는다.

Android release manifest에 INTERNET을 명시한다. cleartext/네트워크 보안 우회는 추가하지 않고 iOS ATS 기본 HTTPS 정책도 유지한다.

공식 근거:
- https://pub.dev/packages/app_links (7.2.2, cold와 후속 stream)
- https://pub.dev/packages/app_links/changelog
- https://docs.flutter.dev/ui/navigation/deep-linking
- https://github.com/llfbandit/app_links/blob/main/doc/README_ios_7.md
- https://docs.flutter.dev/cookbook/navigation/set-up-app-links
- https://docs.flutter.dev/cookbook/navigation/set-up-universal-links

## Android 자격 증명 백업 제외
`allowBackup=false`를 명시하고, Android 12 이상 `dataExtractionRules`의 cloud-backup과 device-transfer 모두 `sharedpref` 및 `device_sharedpref` 전체를 제외한다. 이전 버전의 fullBackupContent도 sharedpref 전체를 제외한다. 현재 flutter_secure_storage의 네이티브 토큰 저장소는 preferences이므로 파일명에 의존하지 않는 제외다. 이는 앱 manifest의 정책이며 실제 제조사 기기 이전/백업 복원 시험을 대신하지 않는다. iOS thisDeviceOnly 설정은 변경하지 않는다.

공식 근거: https://pub.dev/packages/flutter_secure_storage 와 https://developer.android.com/identity/data/autobackup . Android 공식 문서상 일부 OEM에서 allowBackup=false만으로 D2D를 막지 못하므로 두 추출 모드를 명시했다. 기기 보안 설정 변경이나 실제 백업/복원은 수행하지 않았다.
