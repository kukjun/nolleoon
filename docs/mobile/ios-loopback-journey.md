# iOS 합성 localhost native 여정 target

준비 코드이며 실제 simulator 성공 기록이 아니다. 선행 origin/storage 격리 d8bc922 및 별도 localhost runner가 필요하다. 이 커밋은 production lib/main, ATS, signing, 네트워크 설정을 변경하지 않는다.

실행 전 별도 archive에서 시험 bundle identifier를 `com.example.nolleoonMobile.localprobe`로 구성하고 실제 빌드 Info.plist가 같은지 호스트에서 확인해야 한다. `NATIVE_PROBE_BUNDLE_ID` 선언은 실제 서명/번들 검증을 대신하지 않는다. 앱은 iOS debug+정확한 localhost origin+시험 flag를 선검사하고 ApiOrigin의 실제 설정 및 session/receipt key 분리까지 확인한 뒤에만 시험 namespace를 clear한다. deleteAll은 사용하지 않는다.

별도 시험 복사본 apps/mobile에서 (실행은 별도 조율):

```sh
flutter test integration_test/native_loopback_journey_test.dart -d SIMULATOR_ID \
 --dart-define=NATIVE_LOOPBACK_TEST_BUILD=true \
 --dart-define=NATIVE_LOOPBACK_ORIGIN=http://127.0.0.1:4188 \
 --dart-define=NATIVE_PROBE_BUNDLE_ID=com.example.nolleoonMobile.localprobe
```

실제 IoApiTransport·NativeAuthBackend·SecureSessionStore·SecureDeletionReceiptStore를 사용하고, provider만 정확 `synthetic-provider-a`를 반환하는 합성 identity다. 실제 Kakao SDK/key/token은 사용하지 않는다. 로그인→명시적 방 생성→목록 확인→로그아웃→시험 session null을 검사한다. 매번 새 server 임시DB를 사용한다. 토큰/사진/원문응답을 출력하지 않고 오류 시 production으로 우회하지 않는다. 일반 pubspec/main/CI에서 이 target을 자동 실행하지 않는다.

ATS/loopback 도달성은 실행 결과로 검증해야 한다. 이 target이 iOS ATS/Android cleartext/adb reverse를 설정하거나 실기기를 탐색하지 않는다. 이 시험의 합성 identity 성공은 실제 Kakao 인증 성공이 아니며 게임4종/실기기/스토어 인수도 별도다.
