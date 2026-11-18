# #173 재판 (진행)

실제 TravelTrialEngine/projectTrial 및 웹 travel-trial-panel 계약을 기준으로 한다. 설정 caseText/penaltyText/durationMinutes/defendantMembershipId, consent accepted/rejected, defense submit/skip, duration, begin-vote, vote(choice/reason), final-defense 명령이다. 시작은 공통 전용 start endpoint만 사용한다.

서버가 참가자를 고정하고 동의·최소3명온라인/피고온라인·권한·deadline·전원투표·기권·1차동률/최후변론/2차동률무죄·모두기권을 판단한다. 클라이언트는 주어진 phase/outcome/counts/익명이유만 표시하고 tally/timeout을 실행하지 않는다. 피고는 투표할 수 없으며 비참가 진행자는 restricted 최소phase 제어만 가능하다. 일반 private play는 restricted DTO에 호출하지 않는다.

설정은 shell 소유 TrialSetupForm, 참가자 화면은 TrialGameView, 비참가 진행자의 단계 제어는 별도 TrialRestrictedControls로 분리한다. 공통 restrictedControls 명시 callback은 별도 리뷰 대상이다. 계정/판/phase/round 변경과 background에서 개인 입력을 없애고 불확실 명령은 세션 pending owner의 동일intent 명시retry만 사용한다. 게임별 로컬 판정/타인 투표 identity 매핑/클라이언트 마감은 없다.

## 구현 및 검증

- shell-owned TrialSetupForm: 사건/벌칙/피고/기본3분, initialSettings를 통해 기존 authorized 설정 수정. 수정 완료는 서버 PATCH로만 consent pending을 반영한다. common editConfigure는 선택명단을 유지하며 참여자 수정 UI는 포함하지 않는다.
- TrialGameView: 피고 동의·거절, 변론 제출·생략, 진행자 시간조정·동시투표시작, 비피고 유죄/무죄/기권 및 이유, 본인 접수확인, 익명 공개 이유/표수, 1차 동률 후 최후변론/2차와 서버 최종판정. 타인 투표 identity 매핑은 없다.
- TrialRestrictedControls: 비참가 진행자에게 서버가 준 최소 phase로 begin-vote/final-defense만 제공한다. 기본 시작/준비취소는 공통 shell, 숨은 설정 수정은 금지한다.
- 마감은 서버 deadline/409/폴링으로 처리한다. 현재 UI는 서버 설정 제한시간만 표시하며 남은 초 카운트다운은 구현하지 않았다. 단말 시계로 투표를 마감하거나 결과를 추정하지 않는다.
- 중단/삭제 DTO는 민감 입력/사건/이유 렌더러를 우회한다. 배경/계정/판/phase/round 변경은 입력을 제거하고 뒤늦은 응답은 공통 controller가 차단한다.

테스트: 없는 모듈 compile RED를 확인한 후 Flutter trial focused 12개 PASS. 새 core draft edit 3 + restricted 1 + 기존 owned dialog 2 PASS는 별도 실행이며 전체 suite 통과를 뜻하지 않는다. `flutter analyze lib/features/games test/features/games` issues 0. 테스트 중 공개결과 라벨과 redacted 외부 DTO의 facilitator=null/selected=[] 조건 누락은 합성 fixture를 실제 계약에 맞춰 정정했다. 서버 DTO validator를 약화하지 않았다.

실제 native HTTP/Kakao, 루트 registry 통합, 실기기 접근성/화면, 전체 하네스는 이 작업에서 검증하지 않았다. 독립 리뷰와 통합 게이트가 남아 있다. 백엔드/API/판정/인증/배포 변경은 없다.
