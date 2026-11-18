# 놀러온 Flutter 앱 · 실행 설계

상태: #156–179 승인 작업 시작. 현재 배포된 React 웹을 대체하거나 운영 DB를 복제하지 않는다.
기준: main f955209 (운영 구현 13d01da 포함). Flutter iOS/Android UI 추가, Nest application/domain 및 SQLite가 유일한 판정·기록 원천이다.

## 단계와 게이트

1. #157 공식 조사/인증·딥링크 설계 → #158 도구/빌드 → #159 계약.
2. #160 공급자 토큰 검증 → #161 앱 세션 → #162 native BFF → #163 로그인 → #164 초대.
3. #165 디자인 → #166 프로필 → #167 여행방 → #168 관리 → #169 상태 동기화.
4. #170 팀 → #171 제비 → #172 메뉴 → #173 재판 → #174 기록 → #175 탈퇴.
5. #176 보안/호환 → #177 혼합 다인/실기기 → #178 독립 리뷰 → #179 내부배포/스토어 게이트.

각 기능은 실패 테스트, 구현, 검증, draft PR, 독립 리뷰, 수정·재검증 순이다. 합성 OAuth와 실제 Kakao/물리 기기를 구분한다. 기존 #36 원격 CI, #140 운영, #142 실기기, #155 실제 unlink 미확인을 승계한다.

## 실제 재사용 경계

- `apps/api/src/application/travel-*.ts`와 domain 규칙/SQLite repository를 공유한다. Dart로 판정 규칙을 복제하지 않는다.
- `presentation/account.controller.ts`의 HttpOnly Secure cookie와 `commands.ts`의 웹 Origin/CSRF 검사 유지. Flutter를 위해 이를 제거하거나 앱이 웹 Origin을 가장하게 하지 않는다.
- 현재 방 10초/판 2.5초 polling이다. 초기 모바일도 foreground에서 polling, background 정지, 복귀시 신원·상태 재검증. WebSocket 전환은 선행 조건이 아니다.
- requestId/version/revision, 서버 projection과 오류 코드를 Dart 계약으로 명시한다. 네트워크 실패 명령을 임의로 새로운 ID로 재실행하지 않는다.
- 기존 웹쿠키 소유 증명이 필요한 과거 연결은 원래 웹에서 수행. 앱은 이미 연결된 계정 기록만 조회한다.

## 인증 제안과 보안 기준

기존 Kakao Developers 앱에 native 플랫폼을 추가해야 동일 회원번호를 재사용할 수 있다. 앱이 보내는 사용자 ID를 신뢰하지 않는다. 서버는 공식 access token info로 app_id/id/남은 수명을 검증한 다음 기존 provider identity를 조회한다. 별도 앱 생성이나 이메일 자동 병합은 하지 않는다.

네이티브 세션은 별도 opaque credential/해시 저장, 기기별 폐기와 갱신, 탈퇴시 전기기 무효화를 갖도록 설계한다. 서버 Admin/REST client secret은 앱에 포함하지 않는다. Native key는 비밀 서버 키와 구분한다. provider 토큰은 로그/딥링크/query에 넣지 않는다. 웹 세션 규칙을 약화하는 우회는 금지한다. 구체 수명·갱신/재사용 방어는 #161 ADR과 테스트에서 검토한다.

초대 링크는 기존 HTTPS URL을 유지한다. Universal Links/App Links는 실제 소유 도메인 association, 등록된 bundle/package 및 서명 인증서에 연결한다. 기본 Flutter router handler와 app_links를 동시에 설치하지 않는다. cold/warm start, 로그인 중 초대, 취소·재시도·폐기·타호스트를 검증한다.

## 출시 전에 확정/확인이 필요한 것

- bundle/package ID, 기존 Kakao 앱 native 플랫폼 등록 및 같은 app_id, 개발자 membership·서명 소유권.
- iOS Apple 4.8 소셜 로그인 요구에 대한 동등한 privacy login 옵션(예: Sign in with Apple) 검토. 카카오만으로 심사 통과한다고 가정하지 않는다. 계정 연결은 별도 검증이 필요하다.
- Xcode/Android SDK 라이선스, 실제 기기 및 앱 전환 시험 접근, 스토어 계정/개인정보 제출.
- 스토어 제출/보안 설정/운영 전환은 별도 승인 게이트. 아직 수행하지 않았다.

## 공식 근거 (2026-11-18 조사)

- Flutter architecture: https://docs.flutter.dev/app-architecture/recommendations
- Kakao Flutter: https://developers.kakao.com/docs/ko/kakaologin/flutter
- Kakao REST token info: https://developers.kakao.com/docs/ko/kakaologin/rest-api
- Kakao app 단위 회원번호: https://developers.kakao.com/docs/ko/getting-started/faq
- iOS links: https://docs.flutter.dev/cookbook/navigation/set-up-universal-links
- Android links: https://docs.flutter.dev/cookbook/navigation/set-up-app-links
- Flutter testing limitations: https://docs.flutter.dev/testing/overview
- App Review (4.8 포함): https://developer.apple.com/app-store/review/guidelines/

공식 기능/제약과 이 프로젝트 설계 추천을 구분한다. 모바일 UI는 View/ViewModel + Repository/Service로 시작하며 불필요한 모든 요청별 domain/usecase 계층을 강제하지 않는다.
