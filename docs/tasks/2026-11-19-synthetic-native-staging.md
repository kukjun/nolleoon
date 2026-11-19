# 합성 native loopback runner

목표: 새 임시 DB·원장·outbox의 localhost 전용 시험 서버. 운영·실계정·네트워크 설정 변경은 범위 밖.

인수: 명시 synthetic opt-in; host/origin/DB 외부 입력 거부; 합성 provider 정확 allowlist; 실제 HTTP 세션/방 생성; 정상 종료 소유 파일 정리.

RED: runner 없는 상태의 integration loader 1 FAIL. GREEN: 2 integration PASS, contracts/API build PASS. 기존 test fixture의 원장 초기화 코드를 재사용하며 실제 Kakao verifier/provider, 운영 환경파일을 읽지 않는다. 일반 전체 하네스/Android 연결은 미실행.
