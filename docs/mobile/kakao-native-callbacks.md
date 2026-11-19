# Kakao SDK 2.1 네이티브 callback 배선

## 근거와 범위

[Kakao Flutter 시작하기](https://developers.kakao.com/docs/ko/flutter/getting-started)의 로그인 callback은 Android `com.kakao.sdk.flutter.auth.AuthCodeHandlerActivity`, `kakao<네이티브 앱 키>://oauth`다. iOS 로그인 앱 조회는 `kakaokompassauth`만 필요하다. 공유/채널 기능을 추가하지 않으므로 `kakaolink`/`kakaoplus`는 넣지 않았다. 설치된 SDK2.1.0 AuthCodeHandlerActivity와 iOS application/scene delegate도 확인했다.

Android 임시 applicationId `com.example.nolleoon_mobile`, iOS 임시 bundle ID `com.example.nolleoonMobile`을 유지한다. `com.kukjun.nolleoon`은 아직 확정/등록된 ID가 아니다. 콘솔/키/서명/associated domains/운영 설정은 변경하지 않았다.

## 한 입력, 기본 비활성

Flutter가 사용하는 같은 `DART_DEFINES`를 Android Gradle과 iOS build phase가 읽는다. `KAKAO_NATIVE_APP_KEY`(32자리 소문자 hex)와 `NATIVE_AUTH_PLATFORM_VERIFIED=true`가 모두 있어야 callback을 활성화한다. 형식 검사는 실제 네이티브 키인지 인증하지 못한다. 콘솔 [앱] > [플랫폼 키]의 **네이티브 앱 키**여야 하며 REST/Admin 키를 여기에 넣으면 안 된다. 해당 REST/Admin define 이름은 명시 거절한다. 키는 source/문서/커밋에 저장하지 않는다.

키 없이 기본 빌드는 가능하다. Android activity는 enabled/exported=false, 비활성 scheme이며 iOS callback/query 목록은 없다. 검증 플래그 true인데 키가 없거나 형식 오류·중복·잘못된 boolean이면 값 없이 generic 오류로 빌드를 중단한다. 기본 로그인 off/Dart auth gate는 변경하지 않았다.

iOS `Runner/Info.plist`는 keyless template다. `Native Callback Plist` build phase가 같은 defines로 `DERIVED_FILE_DIR/NolleoonInfo.plist`를 만든다. template/script를 input, generated plist를 output으로 선언하고 세 build configuration의 INFOPLIST_FILE이 그 output을 참조한다. 매번 재생성하므로 이전 활성 plist가 기본/off 빌드에 남지 않는다. 생성 파일/SDK 빌드 로그에는 native key가 포함될 수 있으므로 외부 공유하거나 커밋하면 안 된다.

## Loopback test identity

`NATIVE_LOOPBACK_TEST_BUILD=true`와 `NATIVE_LOOPBACK_ORIGIN=http://127.0.0.1:<port>` 또는 `http://[::1]:<port>`를 함께 사용한다. 잘못된 port/host/boolean 또는 flag=false인데 origin이 있으면 거절한다. Android debug만 `.localprobe` suffix를 붙이고 release/profile 요청은 거절한다. iOS는 configuration=Debug 및 **이미 분리된** `PRODUCT_BUNDLE_IDENTIFIER=com.example.nolleoonMobile.localprobe`를 요구한다. build phase에서 signing identity를 뒤늦게 바꾸지 않는다. 다른 worker의 origin별 secure key namespace와 함께 통합해야 하며 이 변경만으로 transport/store 분리를 구현했다고 주장하지 않는다.

### iOS test 빌드 명령

기본/off는 `flutter build ios --simulator --debug --no-codesign`이다. test build는 같은 Flutter `DART_DEFINES` 값을 Xcode 명령에도 제공하고 별도 bundle ID를 지정한다. 다음은 실키가 아닌 synthetic smoke 예시다. 앱 실행/로그인은 하지 않는다.

```sh
# 먼저 기본 Flutter simulator build로 generated Flutter/SwiftPM 설정 준비
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
# 이 환경에서 필요하면 승인된 process-local xcrun wrapper만 PATH 앞에 추가
DEFINES=$(python3 - <<'PY'
import base64
items = ['KAKAO_NATIVE_APP_KEY=' + 'a'*32,
         'NATIVE_AUTH_PLATFORM_VERIFIED=true',
         'NATIVE_LOOPBACK_TEST_BUILD=true',
         'NATIVE_LOOPBACK_ORIGIN=http://127.0.0.1:4190']
print(','.join(base64.b64encode(v.encode()).decode() for v in items))
PY
)
xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/nolleoon-kakao-ios-on \
  CODE_SIGNING_ALLOWED=NO \
  PRODUCT_BUNDLE_IDENTIFIER=com.example.nolleoonMobile.localprobe \
  DART_DEFINES="$DEFINES"
```

실키를 쓰는 경우에는 사전 승인된 native 앱·패키지·키해시·callback 설정 검증이 필요하다. 실제 계정/토큰으로 시험하거나 기본 verification flag를 켜는 작업은 이 커밋에 포함하지 않는다. command echo/verbose 로그의 공개도 금지한다.

## 실제 검증 (합성 설정만, 2026-11-19)

- Python generator/부정 입력5 PASS, Node source contract3 PASS, pbxproj plutil syntax PASS.
- Android 기본/off debug build: 24.8초 PASS. APK merged manifest에서 callback enabled/exported=false 확인.
- Android synthetic/on + localprobe debug build: 13.7초 PASS. APK applicationId `.localprobe`, oauth scheme/SDK activity 활성화 확인.
- iOS 기본/off simulator build: 24.0초 PASS. 산출 bundle 원래 임시 ID, URLtypes/queries 없음 확인.
- iOS synthetic/on localprobe xcodebuild: BUILD SUCCEEDED. 최종 plist의 별도 bundle ID, 정확한 synthetic scheme 1개, kakaokompassauth만 확인. 로그에서 Native Callback Plist 실행 뒤 해당 DerivedSources plist를 ProcessInfoPlistFile이 소비하는 순서도 확인.

실제 Kakao 인증/브라우저·카카오톡 왕복 callback, 취소/복귀, 실기기, production signing 검증은 미실행이다. 위 결과는 **빌드/산출 설정 검증**이며 로그인 완료를 뜻하지 않는다. 활성 합성 APK/app은 설치·실행하지 않았다.
