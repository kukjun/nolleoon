# 놀러온 모바일

Flutter iOS/Android 앱 소스다. 검증된 native 계정 아래 여행방·초대·프로필·아바타 표시·팀 나누기·제비뽑기·메뉴 결정·재판·기록·계정 탈퇴 화면과 API 어댑터를 연결했다. **구현·합성 시험 완료와 네이티브 출시 가능 상태는 다르다.** 기본 플랫폼 검증 플래그는 false이며 실제 로그인·설치 파일·실기기·스토어 인수는 미완료다.

기본 통합 기준은 `b0d6bc4`, 사진 연결 후속은 `5afc022`이다. 이전 단계 문서의 “준비 화면/미연결” 설명은 당시 기록이며 현재 연결 상태는 [릴리스 게이트](../../docs/mobile/release-gates.md)를 따른다.

## 로컬 검사

SDK는 `.flutter-version`, 패키지는 `pubspec.lock`으로 고정한다. 저장소 루트에서:

```sh
FLUTTER_SDK=/your/verified/flutter-sdk tools/mobile/check.sh
```

기기 및 플랫폼 준비 후에만 다음 smoke를 별도로 실행한다. 명령 존재는 실행 성공 증거가 아니다.

```sh
cd apps/mobile
"$FLUTTER_SDK/bin/flutter" test integration_test/app_smoke_test.dart -d DEVICE_ID
```

일반 unit/widget 검사는 합성 provider/transport/이미지를 사용한다. 실계정·운영 탈퇴·실사진을 테스트 자료로 사용하지 않는다. [SDK 환경](../../docs/mobile/flutter-foundation.md), [인증 설계](../../docs/mobile/native-auth.md), [탈퇴 영수증](../../docs/mobile/deletion-receipt-store.md).

## 안전한 기본 구성

`main.dart`는 `KAKAO_NATIVE_APP_KEY`(기본 빈 문자열), `NATIVE_AUTH_PLATFORM_VERIFIED=false`, `NATIVE_INVITE_LINKS_VERIFIED=false`, `NATIVE_PHOTO_PLATFORM_VERIFIED=false`를 읽는다. 플래그를 true로 바꾸는 것만으로 플랫폼 검증이 끝나지 않는다. 모바일에는 같은 Kakao 앱의 **Native 앱 키만** 사용하며 REST API 키·Admin 키·client secret·서버 환경파일을 번들에 넣지 않는다. 임시 앱 식별자와 미확정 서명은 출시용으로 취급하지 않는다.

`5afc022`에서 사진 adapter를 root에 연결했다. 별도 `NATIVE_PHOTO_PLATFORM_VERIFIED`가 기본 false여서 실제 사진 선택은 비활성이다. 인증 플래그만으로 켜지지 않는다. 합성 연결 시험은 실제 OS picker 성공 증거가 아니다. OS 사진 권한·실제 picker, Kakao 콜백, 앱 링크 association은 각각 실제 플랫폼에서 확인해야 한다. Android 탈퇴 영수증의 실제 디스크 내구성은 [#210](https://github.com/kukjun/nolleoon/issues/210)에서 보완 중이며 강제 종료 시험은 미완료다. 현재 운영 서버/웹의 성공이 이 앱의 인증·설치 성공을 대신하지 않는다.
