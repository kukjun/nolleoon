# Flutter travel 화면 시각 계층 정렬

## 기준과 경계
현재 `apps/web/src/travel.css`, `travel-rooms.tsx`, `travel-new-game.tsx`를 기준으로 크림 배경·진한 녹색 글자·밝은 멤버/게임 표면과 파란 CTA를 사용한다. 공통 tokens/theme는 별도 e68b78b 변경을 사용한다. legacy party 전용 색이나 게임별 새 색을 발명하지 않는다.

Controller, 서버 권한/규칙, API, 인증 조건, 영수증/재시도, 모달 소유권은 변경하지 않는다. 로그인 랜딩은 소개만 추가하고 실제 로그인 가능 여부를 동일 조건으로 유지한다. 실제 계정·키·앱 설치·시뮬레이터는 접근하지 않았다.

## 화면 변경
- 내 여행방/생성에 28px 주제 제목과 짧은 설명, 로비 멤버에 웹과 같은 밝은 표면·44px 아바타·간격 적용.
- 게임 선택은 작은 chip 대신 설명 카드. 선택하면 참가자 화면으로 이동하고 이전 카드 목록을 숨긴다. 다시 고르기로 돌아갈 수 있으며 기존 설정 DialogRoute/초안 비동기 보호를 유지한다.
- background/계정 교체 때 참가자 선택과 로컬 단계도 함께 초기화한다. 추가 준비 완료 규칙은 없다.
- 결과/진행 화면의 raw 영어 type/status를 한글 제목으로 표시하고 28px 제목·결과 카드 처리. 기존 AppBar 복귀를 유지하며 새 완료/로비 API나 라우트를 만들지 않는다.

## TDD 및 검증
신규 320/390 화면 시험은 카드 설명/단계 분리 미구현으로 RED, 구현 후 GREEN. 최종 시험은 실제 공통 theme와 1.6배 글자에서 카드→참가자→다시 고르기, 선택 수 및 overflow 예외를 확인한다. 기존 game_config/game_identity 시험은 새 게임 카드 탭만 추가하고 background/계정교체/late callback/요청0 assertion을 그대로 유지했다. 모달 취소는 참가자 단계, background 복귀는 게임 선택 단계로 검증한다.

합성 widget 회귀 35개(rooms, game shell/config/identity/new style, auth panel) PASS, 전체 analyze clean. 게임 모든 renderer/전체 앱 회귀와 실제 after 캡처는 통합 후 독립 검증에서 수행한다. widget PASS는 실기기나 실제 로그인 PASS가 아니다.
