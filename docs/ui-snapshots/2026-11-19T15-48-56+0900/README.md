# #220 UI 후보 2: 단계별 가독성

**captured-candidate / acceptance=false / 사용자 디자인 승인 아님.**

[비교 보기](index.html) · [자동 캡처 출처](after/manifest.json) · [기록 및 과거 참조](manifest.json) · [픽셀 차이](diff/summary.json)

## 실제 실행과 출처

- UI 원본 `f2e77b4`, 캡처 소스 `3f57d00b848c0019c9a618f7e4f0ee4ca30987e1`. 최종 UI 커밋들을 계획 전용 branch에 합성하고 fixture의 진입 문구만 `새 게임` → `게임 고르기`로 갱신했다. 제품 동작 변경 없음.
- 2026-11-19 **06:48:56.208–06:48:58.677 UTC / 15:48:56.208–15:48:58.677 KST**. 390×844, pixelRatio1. 자동 도구가 캡처 전후 commit/dirty=false/sourceDigest/환경 일치를 검증했다. 정확한 폰트·엔진·이미지 해시는 원본 manifest에 있다.
- 실제 MyApp의 합성 계정/방/transport를 렌더했다. 실제 카카오 인증·운영 API·OS·실기기 캡처가 아니다. 로컬 한글폰트와 공식 MaterialIcons는 재배포하지 않는다.
- `native-visual-regression capture` 1 PASS. `node --test tests/visual/native-visual-regression.test.mjs` 5 PASS. 기존 proposed baseline과 exact RGBA 비교는 **changed / acceptance=false**. 변경량은 디자인 승인이나 개선 점수가 아니다.
- 첫 시도는 출력 디렉터리를 git 추적 범위 안에 생성해 dirty 상태가 바뀌어 도구가 거절했다. 해당 출력은 채택하지 않았다. 두 번째 외부 출력은 기존 거절 파일로 dirty=true였으므로 채택하지 않았다. 거절 자료를 작업 트리 밖으로 옮긴 뒤 clean 상태에서 세 번째 캡처한 원본만 여기 보존했다. 검사 조건은 완화하지 않았다.

## 화면과 요구사항 매핑

| 화면 | 주요 컴포넌트 | 요구사항 / 변화 | 남은 차이 |
|---|---|---|---|
| [로그인](after/00-auth.png) | auth_gate.dart | #217 공통 문구/톤 유지 | 실제 OS 상태바·카카오 전환 미검증 |
| [여행방 목록](after/01-home.png) | rooms_screen.dart, feature_shell.dart | #217 만들기/목록을 우선, 프로필·탈퇴 등 계정 메뉴로 묶음 | 전역 로그아웃은 별도 노출, 웹과 헤더 구조 다름 |
| [로비](after/02-lobby.png) | rooms_screen.dart | #217 명단→주 게임 고르기→초대/방 더보기로 위계 정리 | 관리 메뉴 확장 상태는 이 6장에 없음 |
| [게임 선택](after/03-selection.png) | game_screen.dart | #218 1/3 단계, 4개 게임 설명·최소 인원 표시 | 4번째 카드까지 길어 작은 화면은 스크롤 필요 |
| [팀 준비](after/04-team-ready.png) | game_screen.dart, team_game.dart | #218 명단과 게임 시작 강조, 수정·취소 보조 | 재판/제비/메뉴 준비 상태는 별도 기능 시험 영역 |
| [팀 결과](after/05-team-result.png) | team_game.dart, registry | #218 팀별 카드와 아바타·인원·로비 복귀 강조 | 다른 게임 결과/비공개 상태는 본 이미지로 입증하지 않음 |

#219 진행자/피고 권한·큰 글씨 검증은 `apps/mobile/test/features/games/trial/trial_role_accessibility_test.dart` 및 `tests/integration/travel-trial-facilitator-role.test.mjs`에 별도 존재한다. 이 캡처 작업에서는 해당 전체 시험을 재실행했다고 주장하지 않는다. 추가 **320px·큰 글씨 PNG는 미생성**이며, 390 표준 manifest를 다른 크기로 오인시키지 않았다.

## 보존 및 육안 확인

- #216 `../2026-11-19T13-36-32+0900/`는 수정하지 않았다. Git tree `c0076f9af9fd68218bfdc9f9a2c5cdc1565ef145` 유지. 비교 페이지의 웹/이전 화면은 이 경로를 상대 참조한다. 재촬영·새 파일로 복제하지 않았다. 해당 원래 SHA/기록 mtime은 새 manifest의 referenceFrom에 명시했다.
- 6장의 실제 PNG를 직접 열어 한글, 아이콘, 명단 아바타, 버튼, 팀별 결과를 확인했다. 이 크기에서 잘린 글자/RenderFlex 오류는 관찰되지 않았다. 다만 사진 실기기/VoiceOver/TalkBack/키보드/네트워크 실패까지 검증한 것은 아니다.
- 참고 서비스의 이미지·문구·폰트를 복사하지 않았다. 기준 스냅샷 자동 갱신 없음. 최종 사용자 검토와 디자인 승인은 별도다.
