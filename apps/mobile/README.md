# 놀러온 모바일 · 초기 기반

Flutter iOS/Android scaffold와 준비 중 화면만 포함한다. 로그인·여행방·게임 연동은 아직 구현하지 않았다. `com.example.nolleoonMobile`은 개발용 임시 식별자이며 앱스토어/카카오 등록이나 signing team을 설정하지 않는다.

SDK는 `.flutter-version`에 고정하며 `pubspec.lock`을 커밋한다. 저장소 루트에서 실행:

```sh
FLUTTER_SDK=/your/verified/flutter-sdk tools/mobile/check.sh
```

기기 준비 후에만 실제 통합 smoke를 실행한다:

```sh
cd apps/mobile
"$FLUTTER_SDK/bin/flutter" test integration_test/app_smoke_test.dart -d DEVICE_ID
```

명령 존재는 기기 시험 성공을 뜻하지 않는다. 기반 검사에서는 실제 서비스 API나 카카오 계정을 호출하지 않는다. [SDK 출처·환경 게이트](../../docs/mobile/flutter-foundation.md)
