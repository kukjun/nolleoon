# Kakao SDK 2.1 네이티브 callback 배선

## 근거와 범위

[Kakao Flutter 시작하기](https://developers.kakao.com/docs/ko/flutter/getting-started)의 로그인 callback은 Android `com.kakao.sdk.flutter.auth.AuthCodeHandlerActivity`, `kakao<네이티브 앱 키>://oauth`다. iOS 로그인 앱 조회는 `kakaokompassauth`만 필요하다. 공유/채널 기능을 추가하지 않으므로 `kakaolink`/`kakaoplus`는 넣지 않았다. 설치된 SDK2.1.0 AuthCodeHandlerActivity와 iOS application/scene delegate도 확인했다.

사용자가 정식 Android applicationId/namespace 및 iOS bundle ID `com.kukjun.nolleoon`을 승인했다. 소스 ID 확정이며 카카오 콘솔 등록이나 스토어 서명 완료를 뜻하지 않는다. 기존 임시 ID 앱의 데이터를 이동·삭제하지 않으며 secure-store key 문자열도 변경하지 않는다. 콘솔/키/서명/associated domains/운영 설정은 변경하지 않았다.

## 한 입력, 기본 비활성

Flutter가 사용하는 같은 `DART_DEFINES`를 Android Gradle과 iOS build phase가 읽는다. `KAKAO_NATIVE_APP_KEY`(32자리 소문자 hex)와 `NATIVE_AUTH_PLATFORM_VERIFIED=true`가 모두 있어야 callback을 활성화한다. 형식 검사는 실제 네이티브 키인지 인증하지 못한다. 콘솔 [앱] > [플랫폼 키]의 **네이티브 앱 키**여야 하며 REST/Admin 키를 여기에 넣으면 안 된다. 해당 REST/Admin define 이름은 명시 거절한다. 키는 source/문서/커밋에 저장하지 않는다.

키 없이 기본 빌드는 가능하다. Android activity는 enabled/exported=false, 비활성 scheme이며 iOS callback/query 목록은 없다. 검증 플래그 true인데 키가 없거나 형식 오류·중복·잘못된 boolean이면 값 없이 generic 오류로 빌드를 중단한다. 기본 로그인 off/Dart auth gate는 변경하지 않았다.

iOS `Runner/Info.plist`는 keyless template다. `Native Callback Plist` build phase가 같은 defines로 `DERIVED_FILE_DIR/NolleoonInfo.plist`를 만든다. template/script를 input, generated plist를 output으로 선언하고 세 build configuration의 INFOPLIST_FILE이 그 output을 참조한다. 매번 재생성하므로 이전 활성 plist가 기본/off 빌드에 남지 않는다. 생성 파일/SDK 빌드 로그에는 native key가 포함될 수 있으므로 외부 공유하거나 커밋하면 안 된다.

## Loopback test identity

`NATIVE_LOOPBACK_TEST_BUILD=true`와 `NATIVE_LOOPBACK_ORIGIN=http://127.0.0.1:<port>` 또는 `http://[::1]:<port>`를 함께 사용한다. 잘못된 port/host/boolean 또는 flag=false인데 origin이 있으면 거절한다. Android debug만 `.localprobe` suffix를 붙이고 release/profile 요청은 거절한다. iOS는 configuration=Debug 및 **이미 분리된** `PRODUCT_BUNDLE_IDENTIFIER=com.kukjun.nolleoon.localprobe`를 요구한다. build phase에서 signing identity를 뒤늦게 바꾸지 않는다. 다른 worker의 origin별 secure key namespace와 함께 통합해야 하며 이 변경만으로 transport/store 분리를 구현했다고 주장하지 않는다.

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
  PRODUCT_BUNDLE_IDENTIFIER=com.kukjun.nolleoon.localprobe \
  DART_DEFINES="$DEFINES"
```

실키를 쓰는 경우에는 사전 승인된 native 앱·패키지·키해시·callback 설정 검증이 필요하다. 실제 계정/토큰으로 시험하거나 기본 verification flag를 켜는 작업은 이 커밋에 포함하지 않는다. command echo/verbose 로그의 공개도 금지한다.

## 이전 임시 ID 실제 검증 (합성 설정만, 2026-11-19)

- Python generator/부정 입력5 PASS, Node source contract3 PASS, pbxproj plutil syntax PASS.
- Android 기본/off debug build: 24.8초 PASS. APK merged manifest에서 callback enabled/exported=false 확인.
- Android synthetic/on + localprobe debug build: 13.7초 PASS. APK applicationId `.localprobe`, oauth scheme/SDK activity 활성화 확인.
- iOS 기본/off simulator build: 24.0초 PASS. 산출 bundle 원래 임시 ID, URLtypes/queries 없음 확인.
- iOS synthetic/on localprobe xcodebuild: BUILD SUCCEEDED. 최종 plist의 별도 bundle ID, 정확한 synthetic scheme 1개, kakaokompassauth만 확인. 로그에서 Native Callback Plist 실행 뒤 해당 DerivedSources plist를 ProcessInfoPlistFile이 소비하는 순서도 확인.

실제 Kakao 인증/브라우저·카카오톡 왕복 callback, 취소/복귀, 실기기, production signing 검증은 미실행이다. 위 결과는 **빌드/산출 설정 검증**이며 로그인 완료를 뜻하지 않는다. 활성 합성 APK/app은 설치·실행하지 않았다.

## 정식 ID 변경 검증 (2026-11-19)

정식 ID는 양 플랫폼 `com.kukjun.nolleoon`, RunnerTests는 `.RunnerTests`, 시험 앱은 `.localprobe`다. Android Kotlin namespace/package 및 source 경로도 일치시켰다. receipt probe 재실행 도구는 새 `.receiptprobe` package만 허용한다. 이전에 설치한 임시 ID 앱/데이터를 삭제·이전하거나 그 앱에 새 probe를 실행하지 않는다. 과거 API24/36 실측 기록은 당시 임시 ID artifact의 기록이며 새 ID에서 재실행했다는 뜻이 아니다.

- 정식 ID 기대값으로 Python/Android source 시험 RED 후 구현 수정. Node source 계약8 PASS(내부 Python5 포함), receipt driver Python3 PASS, Flutter loopback policy1 PASS, pbxproj syntax/diff 검사 PASS.
- Android 기본 debug APK 빌드24.4초 PASS. aapt package `com.kukjun.nolleoon`. APK SHA256 `f677314758d55ecfaac893152ea2690da4a142b8488bf513dc34c6e067ed3c1e`.
- 이 로컬 debug 인증서 SHA256 `d8812171713319fc9c5487f8ce04d6777039a1b35335dea4dd9108a1970849ac`, SHA1 `2ad283693d5a12f4ed82a3743d5e5d62624c4cf5`. 공개 인증서 식별값이며 release/upload 인증서가 아니다. 콘솔 등록은 별도다.
- 첫 iOS build는 integration_test includes 생성 오류, 이어 Xcode 단독 시도는 같은 worktree에서 동시에 실행한 Flutter test의 generated Swift package 재생성 때문에 app_links 모듈 오류였다. 같은 worktree의 build/test 병행을 중단하고 Flutter iOS 생성을 단독 재실행해9.4초 PASS. 최종 plist ID `com.kukjun.nolleoon`, callback/query 목록 없음 확인.
- iOS synthetic/on + 정식 `.localprobe` xcodebuild BUILD SUCCEEDED. 최종 plist ID `com.kukjun.nolleoon.localprobe`, 합성 callback 1개와 login query 1개를 실제 산출물에서 검증했다. 앱 설치/실행·실제 카카오 인증·콘솔 등록·서명 설정은 수행하지 않았다.

## 정식 ID의 격리된 카카오 검증 모드

`NATIVE_KAKAO_VERIFICATION_BUILD=true`는 기존 합성 `.localprobe`와 구별되는 **debug 전용** 모드다. 카카오 콘솔에 등록한 정식 `com.kukjun.nolleoon`으로 callback을 받아야 할 때 사용한다. `NATIVE_LOOPBACK_TEST_BUILD=true`와 동시에 사용할 수 없다. `NATIVE_LOOPBACK_ORIGIN`은 명시 포트가 있는 literal `http://127.0.0.1:<port>` 또는 `http://[::1]:<port>`만 허용하며 native key와 `NATIVE_AUTH_PLATFORM_VERIFIED=true`도 필수다. 기본 빌드에는 이 모드를 넣지 않는다.

Android verification에는 suffix가 없고 synthetic만 `.localprobe`다. release/profile task를 거절하며 aggregate task에서도 non-debug variant를 비활성화한다. iOS verification은 Debug + 정확한 정식 ID만 허용하고 synthetic은 기존 Debug + `.localprobe`만 허용한다. transport/storage worker의 `.verification.<origin SHA256>` 분리가 반드시 함께 있어야 한다. 이 플랫폼 변경 단독으로 저장소 격리가 완료됐다고 주장하지 않는다. 정식 ID와 동일한 앱이므로 기존 앱을 덮어 설치하지 않으며, 전용 새 simulator/emulator와 별도 검증 서버를 사용해야 한다.

실제 키 입력 전 handoff 파일은 저장소 밖 권한0600 파일로 준비하고 아래 값을 채운다. 빈 키 상태는 의도적으로 빌드 실패한다. 실제 키를 이 문서·커밋·명령 출력에 넣지 않는다. REST/Admin key 사용 금지.

```json
{
  "NATIVE_KAKAO_VERIFICATION_BUILD": "true",
  "NATIVE_LOOPBACK_ORIGIN": "http://127.0.0.1:4190",
  "NATIVE_AUTH_PLATFORM_VERIFIED": "true",
  "KAKAO_NATIVE_APP_KEY": ""
}
```

부모 승인 후 Android는 `flutter build apk --debug --dart-define-from-file=<private-file>`를 사용한다. iOS는 같은 define을 base64 `DART_DEFINES`로 전달하는 위 xcodebuild 절차에서 `PRODUCT_BUNDLE_IDENTIFIER=com.kukjun.nolleoon`을 지정한다. 설정 파일 경로만 공유하고 내용이나 verbose build log는 공유하지 않는다. 실제 키 빌드/카카오 로그인/토큰 교환은 아직 별도 단계다.

검증 모드 구현 실측(합성키, 2026-11-19): Python 신규조건 RED 후6 PASS, Node 플랫폼/저장소 source9 PASS. Android verification debug APK22.5초 PASS 및 실제 package 정식 ID/callback 활성 확인. 동일 verification defines의 `:app:assembleRelease`는 구성 단계에서 `Local test identity is debug only`로 실제 거절했다. iOS 기본/off Flutter simulator build23.3초 PASS, verification 합성/on 정식 ID xcodebuild BUILD SUCCEEDED; 최종 plist의 정식 ID/정확한 합성 scheme/login query를 검사했다. 원본 앱 main을 빌드했으나 설치·실행하지 않았고, 이 플랫폼 branch는 Dart verification storage commit과 통합하기 전 실행하면 안 된다. 실제 키 파일·카카오 로그인·콘솔·운영 설정은 접근하지 않았다.
