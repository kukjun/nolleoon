# React 모바일 디자인 시스템 · MVP-06

현재 사용자 노출 브랜드는 **놀러온**이다. [브랜드·운영 구분](branding.md)을 따른다.

기존 `ui/tokens.css`의 독립 색/간격 원칙을 선별해 React로 이식했다. 기존 `ui/`와 그 시연은 수정하지 않았다. 토스 미니게임의 단순한 위계·한 번에 한 행동이라는 UX 방향만 참고하며 로고·TDS·폰트·일러스트를 복사하지 않았다. 별도 Site 생성·배포도 하지 않았다.

## 확인 경로와 실제 기능 경계

- `/`: 실제 브라우저 세션의 발급/복구/실패/유실 안내. 게임 생성 버튼은 준비 중 disabled이고 앞으로의 플레이는 ‘예정된 플레이’로 표시한다.
- `/?view=design`: UI 동작 미리보기. 입력·선택·고정 03:00·모달·가짜 지연/실패는 로컬 예시이며 서버에 저장하거나 게임을 진행하지 않는다. 이 화면은 세션 발급도 하지 않는다.

## 토큰과 시각 원칙

`apps/web/src/design/styles.css`가 현재 공통 토큰과 스타일 원본이다.

| 역할 | 값/원칙 |
|---|---|
| 화면/표면 | #f6f8fb / 흰색, 약한 경계선 |
| 기본/보조 글자 | #202b3c / #596579 |
| 주 행동 | #245ce2, 연한 #edf3ff 보조 면 |
| 완료/경고/오류 | #147358 / #805000 / #bb3446; 항상 텍스트·형태 함께 사용 |
| 본문/입력 | 기본 16px, 입력 16px, 보조 설명 13px, 작은 섹션 표기는 11~12px |
| 간격 | 4/8/12/16/24/32px 기준 |
| 모서리/터치 | 패널 24px, 버튼 14px, 버튼 최소 48px 높이 |
| 레이아웃 | 최대 1080px, 700px 이하 한 열, 좌우 20px, env(safe-area-inset-*) 보정 |

한 화면의 실제 주 행동은 세션 시작 하나다. 파란색은 주 행동/선택에 집중하고, 글의 위계를 크기·굵기·간격으로 구분한다. 모바일에서는 장식 말풍선을 숨겨 핵심 입력/안내 공간을 확보한다. disabled는 배경과 문구 모두 달라지며 disabled 여부는 색만으로 판단하지 않는다.

## 컴포넌트 계약

- **Button**: 기본 type=button, submit은 명시. 외부 loading 또는 내부 Promise 처리 중 disabled/aria-busy, ref 잠금으로 같은 프레임 중복 클릭도 차단한다. Promise rejection은 일반적인 inline alert로 표시하고 다시 실행 가능하게 한다. 구체 서버 오류 상태는 호출자가 별도로 설명할 수 있다.
- **Input**: label/id, 필수 표기, aria-invalid와 오류 설명 연결. 예시 form은 필수값 실패 시 첫 입력으로 포커스를 옮긴다. 실제 입력 길이·닉네임 규칙은 후속 기능에서 결정한다.
- **ChoiceGroup**: fieldset/legend와 native radio. 선택 테두리·체크 표시·텍스트를 함께 제공하며 방향키로 선택할 수 있다.
- **Status / Banner**: 명시적인 ‘접수 완료’, ‘연결 끊김’ 등 문구. 기본 상태 예시는 live region이 아니며 실제 세션 상태만 live 사용한다.
- **Timer**: 받은 초를 표시하는 presentational component. 실제 카운트다운/서버 deadline 로직은 없다. aria-live=off로 매초 낭독하지 않는다.
- **Modal**: native dialog/showModal로 배경을 inert 처리. 열기 때 닫기 버튼으로 초점 이동, Tab/Shift+Tab 순환, Escape·닫기·외부 open 변경 후 기존 opener로 복원. textarea/select 포함, hidden/inert/disabled/음수 tabindex는 순환에서 제외한다. opener가 제거됐으면 존재하지 않는 노드로 강제 포커스하지 않는다.
- **Layout**: 공통 헤더/본문/하단 여백. 100dvh와 safe-area 보정, 페이지/모달 자체 스크롤을 사용하며 화면을 덮는 고정 하단 버튼을 두지 않는다.

reduced-motion에서는 animation/transition을 비활성화한다. 포커스 링은 키보드 사용에서 표시한다. 긴 한국어·공백 없는 문자열은 overflow-wrap으로 줄바꿈한다.

## TDD·시각 확인 기록

구현 전 실제 Chromium에서 ‘입력 확인’ 버튼을 찾는 시험이 timeout으로 실패했다(expected 0/unexpected 1, exit 1). 구현 뒤 필수 오류/중복 클릭/실패 feedback, 반복 모달/포커스 순환/명시적 닫기/상태 변경, 320px 긴 글·라디오 방향키·48px 버튼 시험을 추가했다. 초기 모달 시험의 ‘닫기’ locator가 ‘상태 변경으로 닫기’에도 매칭되어 exact 이름으로 교정했다. 기능 기대값을 완화한 것은 아니다.

실제 Chromium 스크린샷을 저장하고 직접 열어 확인했다:
- `artifacts/design-system/home-mobile.png` (390px): 제목/실제 CTA/신원 유실 안내가 겹치지 않고 이어짐. 첫 캡처의 버튼이 초기 disabled→enabled transition 중 연하게 보였으므로 enabled 대기·animation 비활성 후 안정 상태를 다시 촬영했다.
- `gallery-mobile.png` (320px): 긴 문자열이 패널 안에서 줄바꿈, 상태 배지에 문구/원형·마름모 구분, 선택 카드와 타이머 가로 넘침 없음.
- `modal-mobile.png` (320×640): 메모/선택/닫기/주 버튼이 화면 안에 들어오고 배경과 명확히 분리됨.
- `home-desktop.png` (1440px): 좌측 소개/우측 실제 세션과 예정 기능이 두 열로 정렬됨. 작은 안내 문구는 읽기 쉽게 13px로 높였다.

이 파일은 ignored 로컬 증거이며 공개 배포 산출물이 아니다. 좁은 320×360 viewport에서 입력/버튼 스크롤 접근도 시험한다. **실제 iOS/Android 키보드, 노치 safe area, VoiceOver, 외부 모바일 브라우저는 아직 미검증**이다. viewport 축소를 실기기 키보드 검증이라고 부르지 않는다. 기능별 합격 개수와 최종 전체 결과는 해당 하네스 보고서/이슈에 기록한다.
