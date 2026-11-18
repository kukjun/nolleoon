# TRAVEL-14 · 제비 미공개 10분 이탈 정책

목표: 영속 여행방용 순수 수명 정책과 공개 projection을 분리한다. legacy room/party 수명, 운영 DB 및 API는 변경하지 않는다.

확정: 사전 배정 자기 제비, 미공개 연결끊김 10분 도달 시 incomplete, 자동 공개/재배정 금지, 공개분만 이력, 새 판은 새 ID/배정. offline만으로 여행방 membership을 제거하지 않는다.

미정: 명시적 탈퇴/추방 시점은 정책결정 전 fail-closed. 순수 모듈은 해당 경우 blocked 반환, 임의 종료나 restart 허용을 하지 않는다.

검증: 9:59 복귀/10:00, deadline 선행 reveal 경계, 중복 timeout/여러 이탈, 완료/미완료 고정, 공개 projection allowlist. 실제 SQL 경합·HTTP/로그/HTML·새 ID 배정은 새 travel adapter 통합 후 별도 검증한다. 이 작업만으로 #131 완료 아님.

실행: 구현 전 import module missing RED. 구현 후 contracts/API build 및 policy5개+기존allocation2개=7/7 PASS. 첫 ESLint의 structuredClone 전역오류를 globalThis로 명시 후 대상 lint PASS. 이 경계 검사는 순수 입력 기반이며 실제 접속 복귀 업데이트보다 만료 판정을 먼저 적용하는 API/SQL transaction 검증은 다음 단계다.
