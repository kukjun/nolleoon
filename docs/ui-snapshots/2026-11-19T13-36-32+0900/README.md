# 웹 / Flutter 전후 · 첫 시각 기록

상태: **captured-candidate · 사용자 미승인**. 독립 구현 검토와 사용자 디자인 승인은 별개다.

[비교 HTML](index.html) · [전체 비교 PNG](contact-sheet.png) · [출처·해시 manifest](manifest.json)

## 목표·범위·근거
웹의 여행방 색감과 가독성을 Flutter에 대응한 실제 합성 렌더 18장을 Git에 보존한다. 제품 소스 BEFORE/웹 `d551688`, AFTER `de56652`. 기록 기준 `c010a86`의 `apps/mobile/lib`는 AFTER와 동일함을 git diff로 확인했다. 캡처 fixture는 c010a86 기준이며 한글 폰트 보충/공개 preset 디코딩 대기를 양쪽에 적용했다. Flutter 3.50.0, 390×844, pixel ratio 1, 기본 글자 배율.

디렉터리 시각은 비교 sheet의 실제 파일 mtime인 **2026-11-19 13:36:32 KST**다. manifest에 입력별 남아 있는 mtime도 기록했다. 복사본 mtime을 최초 웹 캡처 시각으로 오인하지 않는다. 시간은 화면 내 사용자의 활동 시각이 아니다. 폰트는 SHA만 기록하며 바이너리를 배포하지 않는다.

## 화면별 구성과 상태
아래 번호는 web/before/after 디렉터리에 공통이다. 같은 합성 여행·두 참가자·두 팀 결과이며 실제 계정이나 서버 데이터가 아니다.

| 파일 | 상태/주요 구성 | 전후 변화와 남은 차이 | 주요 코드 |
|---|---|---|---|
| 00-auth.png | 로그인 전, 소개, Kakao CTA | 보라 버튼→파랑, 소개 계층 추가. 웹 white 소개 카드와 Flutter 전체 화면 구성은 다름 | apps/mobile/lib/app/auth_gate.dart |
| 01-home.png | 합성 여행방 목록 1개, 관리자, 2명 | cream/white 카드, 제목·주 CTA 강조. 프로필·휴지통·탈퇴 상단 메뉴는 웹과 위치가 다름 | apps/mobile/lib/features/rooms/rooms_screen.dart; apps/mobile/lib/app/feature_shell.dart |
| 02-lobby.png | 진행 중 판 없음, 현재 멤버 2명 | 공개 preset와 연녹색 멤버 행, 녹색 제목. 웹은 관리 접기영역/아래 CTA, Flutter는 가로 관리 메뉴 | apps/mobile/lib/features/rooms/rooms_screen.dart |
| 03-selection.png | 새 판 준비 1/3, 네 게임 선택 | 작은 chip+동시 참가자 선택→설명 카드 단계. 웹 하단 뒤로 vs Flutter AppBar 뒤로; 메뉴 명칭도 차이 있음 | apps/mobile/lib/features/games/game_screen.dart |
| 04-team-ready.png | team draft, 두 팀·두 참가자·진행자 | raw team·draft→한글 준비 상태, white 카드·파란 시작. 설정/취소/새로고침 버튼 순서와 웹 분리 카드가 다름 | apps/mobile/lib/features/games/game_screen.dart; apps/mobile/lib/features/games/team/team_game.dart |
| 05-team-result.png | completed, 각 팀 1명 | 보라 외곽 카드→white 카드, 한글 완료 제목. 웹의 파란 결과 확인·로비로 CTA 대신 Flutter는 AppBar 뒤로+본문 새로고침 | apps/mobile/lib/features/games/team/team_game.dart |

## 판단할 항목
- **가독성:** 한글·이름·아바타가 실제 렌더되었다. 카드 계층/여백/강조가 후보로 개선됐지만 6개 정지 화면만으로 긴 글·큰 배율·모든 상태를 합격 처리하지 않는다.
- **동선:** 게임 선택은 단계로 정리됐다. 홈 관리 메뉴, 뒤로가기 위치, 결과→로비 CTA 차이는 아직 남는다. 사용자 선호 확정 전 웹과 동일하다고 하지 않는다.
- **웹 색감:** 실제 travel wrapper canvas `#faf8f3`, ink `#243a32`, CTA `#245ce2`/white/radius14에 대응한다. 전역 body fallback이나 예전 party scope와 섞지 않는다. memberSurface `#f4f7f1`, gameSurface `#f5f8f2`, card white. 근거: apps/web/src/travel.css, apps/web/src/design/styles.css; Flutter apps/mobile/lib/design/app_tokens.dart, theme.dart.

## 검증·미검증
- 이번 기록: 18개 원본 PNG SHA 일치, 각 390×844, sheet/index 원본 해시, 로컬 상대 링크, 합성 fixture 및 화면 내용 검토.
- 이전 구현 검증 기록: c010a86 docs/tasks/native-web-visual-alignment.md의 Flutter279 PASS/analyzer 및 양쪽 렌더1 PASS씩을 참조한다. 이번 문서 작업에서 그 전체 시험을 다시 실행한 것은 아니다.
- **미검증:** 이 dataset의 실제 API/카카오/OS 상태바·키보드·안전영역/실기기, 전체 사용자 흐름의 동등성, 사용자의 최종 디자인 승인. OS 폰트의 픽셀 일치 주장 없음.
- 원본 보존: PNG와 index/contact sheet를 변환하지 않고 복사했다. manifest에는 기록 메타데이터만 추가했다. UI/운영/앱 설치 변경 없음.

## 출처 결속의 한계
이 첫 기록의 소스 SHA는 기존 실행 보고·fixture 문서와 원본 해시를 대조한 수기 출처다. 캡처 전후 HEAD/dirty 상태를 자동 봉인한 manifest는 이 dataset에 없으며, PNG 해시만으로 특정 커밋에서 생성됐음을 증명하지 않는다. 다음 버전은 캡처 도구가 생성하는 전후 소스·환경·PNG 해시 manifest를 함께 보존한다.

## 다음 버전
남은 동선·메뉴 위치를 사용자가 판단한 후, 바뀐 화면을 새 timestamp 디렉터리에 남긴다. 이 첫 후보를 조용히 승인본으로 교체하지 않는다.
