# 놀러온 Flutter 개발 기반 · #158 / #165

## 목표와 경계

iOS/Android 앱 scaffold와 Flutter 테스트 기반을 추가한다. 로그인·여행방·게임 API는 아직 연결하지 않으며 초기 화면에 구현 대기 상태를 명시한다. 기존 웹·DB·운영 서비스는 변경하지 않는다. 앱 식별자는 개발용 임시 값이며 배포/서명/카카오 콘솔 설정 승인을 뜻하지 않는다.

## SDK 고정과 출처

- Flutter stable 3.50.0, Dart 3.14.0, macOS arm64.
- 공식 release metadata: https://storage.googleapis.com/flutter_infra_release/releases/releases_macos.json
- 공식 archive: https://storage.googleapis.com/flutter_infra_release/releases/stable/macos/flutter_macos_arm64_3.50.0-stable.zip
- SHA256: `ed2d08a3e3c023e84cbe9316d21bd88fda6ee9552f90c1eb4da41a07c170fb35`.
- Framework commit: `ab2912035e160d9cad6306df307576da6128ebdb`.

공식 사이트 source의 metadata 경로를 확인했다. 과거 `/flutter/releases/` 주소는 404였으며 임의 mirror를 사용하지 않는다. SDK는 저장소 밖 전용 개발 경로에 설치하며 전역 PATH·xcode-select를 바꾸지 않는다.

## 검증 게이트

기반 개발 검사와 실기기/서명/배포는 별개다. Android SDK/JDK, Xcode 초기 설정·라이선스, simulator runtime, CocoaPods/네이티브 plugin 의존성은 실제 doctor 결과에 따라 별도 준비한다. 서명팀·bundle ID·앱 연결·스토어 제출·운영 인증정보는 자동 설정하지 않는다. 라이선스 수락도 이 문서나 설치 완료로 추정하지 않는다.

## 실행 결과 · 2026-11-18

공식 archive SHA256 일치를 확인한 뒤 설치했고 `flutter --version --machine`의 framework/Dart/ref가 pin과 일치했다. 기본 doctor 결과: Android SDK 미발견, Xcode 선택/초기 설정 미완료, CocoaPods 미설치. process-local `DEVELOPER_DIR`로 설치된 Xcode를 지정했을 때는 라이선스 미수락 안내가 나왔다. 수락·전역 설정 변경 없이 멈췄다. doctor의 connected device 출력은 실제 iOS/Android 시험 성공이 아니다.

생성 템플릿이 기존 Mac 서명 identity를 자동 감지했으나 실제 서명은 실행하지 않았다. 생성된 `DEVELOPMENT_TEAM`을 제거하고 개인 identity가 커밋 대상에 없음을 점검했다. Android의 기본 release→debug signing 연결도 제거했다. 개발용 bundle/application ID만 남기며 실제 팀·인증서·키·앱 연결은 비구성이다.

- RED: 기본 counter scaffold에서 브랜드/준비 안내 widget 시험 2개 실패.
- GREEN: `tools/mobile/check.sh`로 정확한 SDK pin, lock 강제, Dart format, analyze(경고/정보 포함), unit1 + widget2 PASS.
- 320×640·글자 배율2에서 overflow 예외 없음. 실제 iPhone/Android 렌더링 검증과는 다르다.
- native integration smoke runner는 작성만 했다. iOS/Android build, simulator/device integration, 실제 로그인, 스토어 배포는 미실행/환경 게이트다.
- 직접 외부 의존성은 `material_ui:1.11.1`, `flutter_lints:6.0.0`으로 고정. Flutter3.50 템플릿의 Material UI 분리 구성을 따르며 SDK dependency와 전체 전이 의존성은 pubspec.lock에 기록한다.

## #165 공통 표현 컴포넌트

`lib/design/app_components.dart`는 서버 상태를 만들지 않는 공통 위젯이다. AppAction은 최소48dp와 pending 중 중복 실행 차단, 원시 오류 미노출을 제공한다. AppStatus는 live-region 안내를 제공한다. StepPage는 단계/제목 semantics, 큰 글씨/키보드에 대응하는 scroll, unsaved 취소 확인을 제공한다. 초안 데이터와 실제 단계 변경은 호출자가 소유한다. onBack에서 단계 변경 또는 Navigator.pop을 수행할 수 있으며 확인 전 초안을 지우지 않는다. 서버에 자동 저장하거나 자동 재시도하지 않는다.

추가 widget 사례: 비동기 중복 버튼·실패 안내, 취소 후 초안 유지·중복 확인 방지, 320px/글자2배/키보드 inset, system back에서 취소/승인 후 route 복귀. 실제 서비스 로그인/게임 화면 구현이나 실기기 접근성 인수로 해석하지 않는다.

검증: 컴포넌트 모듈 부재 RED 후 구현. 첫 실행에서 시험의 semantics handle 정리 시점 오류를 발견해 try/finally로 명시 정리했다. 최종 정확한 코드의 `tools/mobile/check.sh`: format/analyze PASS, 전체 unit/widget8 PASS(신규5). 실기기/통합 smoke는 미실행이다.
