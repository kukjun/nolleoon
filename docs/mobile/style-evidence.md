# 웹과 Flutter 스타일 비교: 합성 BEFORE

제품 기준 소스: `d551688`. 실제 사용자 인증·운영 데이터·시뮬레이터를 사용하지 않는 **표현 비교**다. 기능 인수, 실기기 픽셀 동일성 또는 웹/Flutter 완전 동작 동등성의 증거가 아니다.

## 공통 조건

390×844, pixel ratio 1, 기본 글자 배율. 로그인 전·로그인 후 홈·방 로비·게임 선택·팀 배정 시작 전·팀 결과의 6개 상태. 합성 여행/두 참가자/두 팀을 사용한다. 결과 난수 규칙은 재실행하지 않고 양쪽 서버 응답 fixture에 같은 배정을 넣었다.

- Flutter: 실제 MyApp와 화면 위젯, 기존 ShellTransport/AuthRepository 합성 fixture. RepaintBoundary로 렌더한 PNG이며 OS 스크린샷이 아니다. 시스템 Apple SD Gothic Neo를 Roboto/SF 가족 별칭에 로드하고 SDK MaterialIcons도 로드한다. Ahem 네모 글꼴이 아니다. OS별 실제 글꼴 선택·상태바·안전 영역·키보드·접근성 배율은 이 비교에 포함하지 않는다. 글꼴 파일은 배포/커밋하지 않는다.
- 웹: 실제 Vite build, Chromium viewport 스크린샷. ephemeral loopback 정적 서버만 띄우고 모든 API는 Playwright 합성 응답으로 대체한다. 다른 origin 요청은 차단한다. DB/API 서버·고정 포트·실제 Kakao 요청은 없다.
- API 형식 차이(native/web)는 각 기존 테스트 계약을 따른다. 두 구현의 버튼명/레이아웃은 현재 차이를 그대로 보인다. 스크롤 위치도 각 단계에서 실제 사용 가능한 조작을 거친 상태다. 이미지 편집으로 비슷하게 맞추지 않는다.

## 재현

루트에서 contracts/web build 후 `node tools/mobile/capture-style-before.mjs`.

모바일 디렉터리에서:

```sh
STYLE_EVIDENCE_ICON_FONT='<flutter-sdk>/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf' \
  flutter --suppress-analytics test --no-pub test_targets/style_evidence_capture.dart
```

Mac의 `/System/Library/Fonts/AppleSDGothicNeo.ttc`가 필요하다. 별도 명시 실행용 test_targets 파일로 일반 widget 테스트 전체를 실행할 때 자동 이미지 생성하지 않는다. 라이브 서비스/기기를 연결하지 않는다.

산출물은 `artifacts/style-evidence/before/{flutter,web}/`의 `00-auth`~`05-team-result` PNG 12개. 웹 computed.json에 browser 버전과 실제 색·반경을 기록한다. 출력은 BEFORE 비교용이므로 나중 소스에서 재실행 시 이전 증거를 덮어쓰지 않도록 별도 worktree/artifact 디렉터리로 보존해야 한다.

## 실제 관찰

- 웹 대표 CTA는 파랑 `rgb(36,92,226)`, 흰 글자, 반경14px. body 전역 배경과 travel 영역 배경은 별도로 읽어야 한다.
- Flutter 기존 결과에는 `team · completed` 내부 상태 표현, 보라 계열 카드/외곽선과 새로고침 CTA가 보인다. 웹은 큰 결과 제목·white card·녹색 tint 내부 행·파란 로비 복귀 CTA다.
- 두 결과 이미지에서 한글 이름과 아바타가 실제로 렌더된 것을 직접 확인했다. Flutter 앱 제목/헤더 구조도 웹과 다르다. 후속 UI 구현자가 고칠 대상이지 fixture가 숨길 차이가 아니다.

검증: Flutter 렌더 시나리오 1 PASS(6캡처), 웹 스크립트 exit0(6캡처), 실제 운영/모바일 OS 미사용. 이 캡처 생성 도구는 기존 UI 인수시험을 대체하거나 assertion을 완화하지 않는다.
