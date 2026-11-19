# #219 재판 권한·접근성 검증

base7e5af66, 테스트만 변경. 실제 운영·계정·기기·4189 미접촉.

- 실제 Nest HTTP+합성 SQLite: 최초 진행자 a/방 관리자 a, 피고 b, 일반참가자 c. b/c의 투표개시403 확인. 서버15초 단절 감지 이후599999ms에는 진행자 유지,600000ms에 연결된 참가자 후보에서 주입 random이 c 선택. 관리자 a/피고 b/동결명단/수락 유지. 복귀한 이전 진행자 a와 피고 b의 개시403, 새 진행자 c만 투표개시 및3분 서버마감 확인. 시계는 fixture 주입이며 실제10분 대기 아님.
- Flutter: 진행자 변경 refresh 이후 이전 버튼 제거/새 진행자에게만 명령 제공. 피고 여부와 진행자 여부를 독립 조합해 변론/개시 버튼 검증. 합성 transport이며 서버권한 검증은 별도 HTTP시험이 담당.
- 접근성:320×568/390×844, text1.6/2.0, 허용 길이 안의 긴 한국어 사건/벌칙. ensureSemantics를 활성화하고 상단 및 투표 시작 위치에서 Android/iOS tap target, labeled target, text contrast guideline 모두 검사. 화면 overflow exception 없음. 실제 VoiceOver/TalkBack/키보드/실기기 검증이 아님.

초기 Flutter 실패4건은 guideline 위반이 아니라 test teardown의 SemanticsHandle 늦은 해제였다. try/finally로 해당시험 안에서 해제하도록 수정 후7/7 PASS. 제품 규칙/UI 소스 수정 없음. HTTP1 PASS, API/contracts build PASS, scoped analyze/ESLint 결과 별도 실행 기록 참조. 실제 정책 결함은 이번 범위에서 발견되지 않았다.
