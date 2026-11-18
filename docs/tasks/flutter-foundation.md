# Flutter 기반 작업 · #157/#158

상태: 진행

## 목표와 범위
Flutter iOS/Android를 기존 웹·API·데이터와 호환되게 추가. 운영 변경 없음.

## 미결정과 가정
서명/플랫폼 등록/스토어 로그인 정책은 출시 게이트. 웹쿠키 우회와 별도 Kakao 앱 생성 금지.

## 합격 기준
공식 근거·현재 코드 경계·미결정 명시, 별도 작업트리, 실제 가능한 도구 검사와 Flutter 테스트 기반. 구현과 실기기 검증 구분.

## 실행과 증거
- 원격 main f955209, 기존 worktree 변경 없음. 신규 feat/flutter-foundation.
- GitHub #156–179 총24개 원격 재확인 완료 후 구현 시작.
- Flutter/Dart PATH 없음. Xcode.app 존재, xcode-select는 CommandLineTools. 개발환경 추가 검사 중.
- `node tools/harness/check.mjs --help`는 help 옵션을 지원하지 않아 실제 하네스를 실행했다. 의존성 미설치 상태로 build 등 차단/실패; report `artifacts/harness/2026-11-18T16-19-55-959Z-39482/report.json`. 이를 제품 회귀로 판단하거나 통과로 보고하지 않는다.
- 아직 Flutter build/test, 실제 OAuth/실기기/스토어는 미실행.

## 회고
도구 설치 유무와 실제 native build 가능성을 동일시하지 않는다.
