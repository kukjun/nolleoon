# 모바일 구현 상태와 출시 게이트

기본 통합 소스: `b0d6bc4e7c20501380c75ae1e6f7a23922bf3e9a`. 사진 root 연결 후속: `5afc022d274232630e8bcc4202786f2330c35ebc`. 후속 clean 통합 `0029cce`에서 전체 Flutter 259 PASS 및 analyzer clean을 확인했다.
이 문서는 현재 상태를 요약한다. 이전 단계별 PLAN/인증/조립 문서의 미연결 표기는 당시 범위의 기록이다. 이 정리는 서버·운영·키·설정·기능을 변경하지 않는다.

## 연결된 기능

- 검증된 native 세션 → 내 여행방 생성/목록/관리·휴지통, 초대 preview와 명시적 참여.
- 프로필 이름·프리셋, 방/게임의 현재 멤버 sidecar 아바타. 사진 업로드/OS picker adapter는 `5afc022`에서 root에 연결했으며 별도 플랫폼 검증 플래그가 기본 false이므로 실제 선택은 비활성이다. 기존 권한 API만 사용하고 익명 투표 이유·제한/삭제된 기록에서 신원을 복원하지 않는다.
- 팀 나누기·제비뽑기·메뉴 결정·재판의 설정/진행/서버 결과, 기록 조회.
- 명시적 계정 탈퇴, 불확실한 요청의 동일 requestId 재확인, 로컬 인증 정리 및 영속 영수증 복구.
- background/계정 교체 시 개인 화면·표시용 이미지 버퍼를 제거한다. 단, 진행 중인 OS picker의 최대 1MiB 입력은 같은 계정의 재인증 뒤 한 번 전달하기 위해 메모리에만 보관하며 취소·계정 교체 시 폐기한다. 같은 계정 재검증 후 불확실한 명령은 사용자 수동 재시도만 허용한다. 결과는 앱이 임의로 생성하지 않는다.

## 설정과 인증 경계

실제 `apps/mobile/lib/main.dart`의 compile-time 입력:

| 입력 | 기본값 | 의미 |
| --- | --- | --- |
| `KAKAO_NATIVE_APP_KEY` | 빈 문자열 | 기존 웹 계정과 같은 Kakao developer app의 Native 앱 키 |
| `NATIVE_AUTH_PLATFORM_VERIFIED` | `false` | 실제 native 등록·콜백 검증 전 인증 비활성. 사진 picker 자동 활성화 플래그는 아님 |
| `NATIVE_INVITE_LINKS_VERIFIED` | `false` | OS 앱 링크 handler 비활성. 실제 association 검증 후에만 활성화 |
| `NATIVE_PHOTO_PLATFORM_VERIFIED` | `false` | 사진 adapter root 연결의 별도 활성화 조건. 실제 picker/권한 검증 전 비활성 |

플래그는 증거가 아니라 활성화 조건이다. REST API 키·Admin 키·client secret·운영 `.env`는 앱 코드/번들/문서에 포함하지 않는다. 서버의 Kakao 앱 ID 검증과 앱의 Native 키는 역할이 다르다. 웹 쿠키를 복제하지 않고 native opaque bearer를 별도 OS 보안 저장소에 보관한다. SDK access token은 메모리 교환 후 SDK 로컬 정리를 시도한다. 정리 실패가 가능하므로 실제 기기에서의 제거를 보장하거나 검증 완료로 주장하지 않는다.

서버 계약은 **30일 절대 만료**, refresh 없음이다. 서버 DB 복원은 기존 native 세션을 무효화하며 웹 세션 정책과 구분한다. 앱은 세션 확인 실패를 로그인 성공으로 해석하지 않는다. OS secure store의 실제 권한/백업/재설치 동작은 아직 실기기 검증되지 않았다.

## 탈퇴 복구의 의미

- pending 영수증은 원래 계정·requestId·bearer·**원래 세션 절대 만료**를 보존한다. 임의 보존 기간 연장이나 자동 POST는 없다. 동일 native 삭제 POST를 명시적으로 재확인한다.
- confirmed 영수증에는 raw bearer 대신 원래 credential digest만 남긴다. 이는 다른 새 credential을 지우지 않기 위한 로컬 정리 일치 증명이며 별도의 서버 인증 수단이 아니다.
- 인증 저장소·SDK 메모리·private 상태·영수증 정리가 끝나야 성공을 표시한다. 저장 실패는 성공으로 덮지 않는다. 영수증 read 이전 일반 로그인/probe를 막는다.
- 손상/만료/v1 기록은 조용히 무시하지 않는다. 두 단계 명시적 **이 기기 로컬 초기화**는 로그인과 임시 복구 기록만 지운다. 서버 탈퇴 완료를 입증하거나 서버 계정/게임을 삭제하는 동작이 아니다. 부분 실패 시 로그인 gate를 열지 않는다.
- secure store 시험은 합성 platform이다. 실제 강제 종료·기기 백업 복원·Keychain/Keystore 검증을 완료했다고 주장하지 않는다.

### Android 영수증 내구성: #210 미완료

`flutter_secure_storage 11.2`의 Android 저장은 `SharedPreferences.apply()` 완료를 실제 디스크 영속 완료로 보장하지 않는다. Dart Future 완료와 저장 후 읽기 일치만으로 process-kill 뒤 복구를 증명할 수 없다. [#210](https://github.com/kukjun/nolleoon/issues/210)의 고정 preferences 대상 최소 `commit()` barrier 보완은 구현 진행 중이며, 이 문서는 완료/검증을 선언하지 않는다. native 빌드와 실제 강제 종료 시험은 미실행이다. 영수증의 순서·digest·직렬 저장 합성 회귀 PASS도 이 플랫폼 내구성 게이트를 대체하지 않는다.

## 알려진 제품 한계

- 원본 사진 1MiB/4MP 제한으로 일반 고해상도 사진이 거절될 수 있다. 실제 OS downscale/picker/권한 흐름은 별도 검증이다.
- 게임 준비 수정은 기존 선택 참가자를 유지한다. 서버 규칙/참가자 권한을 임의 변경하지 않는다.
- 재판 남은 초의 실시간 countdown UI는 없다. 서버 deadline 및 서버 projection에 따른 진행과 별개다.
- 미제출 초안과 일반 불확실 명령 복구는 메모리 수명이다. 프로세스 종료 뒤 모든 초안 복구를 보장하지 않는다. 탈퇴 영수증만 별도 영속 복구 계약을 가진다.
- 현재 멤버 사진은 최신 권한/revision의 이미지이며 역사적 결과 시점 사진 snapshot이 아니다.

## 검증 근거와 미완료 게이트

| 범위 | 실제 근거 | 뜻하지 않는 것 |
| --- | --- | --- |
| Flutter 통합 | clean `0029cce` 전체 **259 unit/widget PASS**, analyzer clean. 이전 `9b84c44`의 251 PASS와 구분 | 실제 HTTP 인증, SDK 로그인, 실기기/OS secure store 합격 |
| 사진 root 연결 후속 | `5afc022`, 독립 focused **28 PASS** 보고 | 실제 OS picker/사진 권한 성공 또는 새 전체 Flutter 결과 |
| 서버/웹 로컬 전체 하네스 | `04bf122ee661cb4a7cf697358b7bcdbbc4f20eeb`, **19개 실행 결과 passed / 725 tests PASS** | 최종 Flutter tree 검증, 실제 native SDK/실기기 또는 전체 제품 인수 |

서버/웹 근거는 해당 실행 작업트리의 `artifacts/harness/2026-11-18T18-13-06-807Z-97708/report.json`이다. 합계는 harness30 + workspace8 + docs10 + unit222 + API162 + DB139 + browser39/36 + gameplay3 + mobile emulation3 + party24 + travel39 + travelE2E9 + partyE2E1 = 725. build/lint/layers/types/repo 검사도 passed이며 보고서의 `productValidation`은 `partial`이다. 별도 이전 17:41 실행의 Chromium 권한 실패를 이 성공 보고서와 혼동하지 않는다. 이전 `7684721`의 722 tests와 최신 `04bf122`의 725 tests는 별도 실행이다.

위 Flutter 실행 기록은 [feature shell](../tasks/flutter-feature-shell.md)의 최종 합성 검증에 있다. 이 문서 작성 과정에서 테스트를 재실행하지 않았다.

출시 전에 별도로 닫아야 할 게이트:

1. Android/iOS 플랫폼 SDK·빌드 도구, 최종 applicationId/Bundle ID와 서명 소유권, APK/IPA 생성 및 설치 검증.
2. 같은 Kakao 앱의 native 등록과 실계정 로그인/취소/만료/로그아웃, 실제 서버 verifier 조합. 현재 웹 OAuth 성공으로 대체할 수 없다.
3. AASA/assetlinks·초대 링크 cold/warm 복귀·Kakao callback 공존 및 실제 기기 검증. 플래그 기본 false 유지.
4. 실제 기기의 background/복귀·사진 권한/선택·보안 저장·탈퇴 복구·접근성·화면 크기 인수. 특히 #210 디스크 내구성과 process-kill 복구 검증.
5. 원격 CI와 native 빌드 파이프라인, 독립 출시 인수. 로컬 backend PASS와 mobile unit/widget PASS는 별도 범위다.
6. [소유자 결정 #180](https://github.com/kukjun/nolleoon/issues/180): Apple 로그인/계정 연결 방향, 개발자 계정·대상 국가·앱 식별/서명, 개인정보/삭제 경로·심사 접근 요건. 정책 충족·스토어 승인이나 유료 계정 생성은 이 문서로 승인/확정되지 않는다.

현재는 코드 통합과 합성 회귀의 체크포인트이며 **스토어 출시 또는 실기기 인수 완료가 아니다**.
