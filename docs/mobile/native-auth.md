# 네이티브 인증 기반 (#163)

이 코드는 테스트 가능한 어댑터/상태/UI 기반이며 실제 카카오 로그인 완료가 아니다. 현재 준비 화면은 그대로 유지한다. `createNativeAuth`와 `AuthPanel`은 추후 앱 조립 지점에서 연결한다. 네이티브 앱 키 및 Android/iOS 등록·콜백 검증이 모두 없으면 로그인 버튼은 비활성이다. 웹 쿠키를 앱 인증으로 복제하지 않는다.

## 흐름과 보존 경계

- KakaoTalk 설치 시 SDK Talk 로그인, 미설치 시 계정 브라우저 로그인. 사용자가 취소하면 로그인하지 않고 자동 대체/재시도하지 않는다.
- SDK 토큰은 `EphemeralKakaoTokens` 메모리에만 보관하고 교환 종료 시 비운다. SDK 기본 preferences 저장 관리자를 사용하지 않는다. SDK 로그도 비활성이다.
- `POST /api/native/auth/kakao {accessToken}`은 bearer/cookie 없이 호출한다. 이후 서버의 43자 bearer만 OS 보안 저장소에 보관한다.
- session GET / logout POST는 앱 bearer를 사용한다. 30일 절대 만료 계약이며 refresh를 구현하지 않는다. 네트워크 오류를 로그인 성공/만료로 오인하지 않는다.
- logout 실패 시 성공이라고 표시하지 않으며 UI 세션을 비우고 보안 저장 토큰은 명시적 재시도까지 유지한다. 다른 세션의 로그아웃/카카오 unlink는 호출하지 않는다.
- 로그인 진행 중 lifecycle resume은 SDK 복귀와 경쟁하지 않는다. dispose 이후 새 로그인 결과를 저장하지 않는다.

## 공급망·설정

2026-11-18 공식 pub.dev metadata로 `kakao_flutter_sdk_user 2.1.0`, `flutter_secure_storage 11.2.0`을 확인하고 exact pin/lock을 기록했다. [Kakao 공식 문서](https://developers.kakao.com/docs/en/kakaologin/flutter), [공식 SDK](https://github.com/kakao/kakao_flutter_sdk), [secure storage](https://pub.dev/packages/flutter_secure_storage)를 참조했다. 저장 플러그인은 iOS Keychain this-device 접근성과 Android 기본 RSA OAEP/AES-GCM을 사용한다. Android backup 제외 및 iOS Keychain entitlement/접근성은 실기기 빌드 전 별도 확인해야 한다. 현재 플랫폼 설정, 서명, URL scheme, 앱 키는 추가하지 않았다.

실제 SDK 실행·OS 저장소 동작·설치된/없는 KakaoTalk·native callback·재설치/백업·물리 기기·실계정·운영 서버 호출은 미실행이다. unit/widget의 합성 provider/transport와 실제 SDK/플러그인 compile 검사는 이 gate를 대체하지 않는다.

앱 조립 계약: `signedIn` 상태에서만 accountId를 key로 하는 여행방 subtree를 생성한다. 계정 변경/로그아웃/인증 실패 시 subtree를 폐기하여 rooms controller와 진행 중 요청도 정리한다. 이 패치에서 main 화면이나 rooms 작업자의 코드는 수정하지 않았다.

## 이 패치의 실제 검증

- 새 상태 테스트 6, UI/설정 3, SDK gateway 2, native API bridge 2 = 13개. 기반/디자인/data 회귀 포함 총 32개 PASS.
- pin/lock 확인, format, Flutter analyze 모두 PASS. 초기 missing module RED 후 구현했다. bridge 401 회귀가 실제 실패하여 원격 `ApiFailure.status == 401`도 세션 만료로 변환하도록 수정하고 전체 재검증했다.
- `tools/mobile/check.sh` 사용. 실 API 테스트가 아니라 strict JSON/헤더 검사는 합성 transport를 사용했다. 실제 SDK/Keychain/Android Keystore는 플랫폼 미구성으로 미실행이다.

### 독립 리뷰 P2 보완

보관된 계정 A의 재확인이 네트워크 오류로 실패한 상태에서 새 로그인 B를 취소하면 A가 다시 나타날 수 있는 경로를 실제 테스트로 재현했다. 이제 미해결 보관 세션은 새 SDK 로그인을 상태/UI 양쪽에서 차단하며, 세션 재확인 또는 명시적 기존 세션 로그아웃만 허용한다. 저장소 읽기 실패도 소유 상태 미확정으로 취급한다. 추가 상태/UI 2개 포함 인증 focused 11개 PASS(이전 신규 SDK/API 4개 별도).
