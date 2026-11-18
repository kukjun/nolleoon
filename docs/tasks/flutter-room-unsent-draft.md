# #196 전송 전 여행방 초안 복구

상태: 진행

## 목표와 범위
동일 계정 인증 재검증으로 RoomsScreen이 재생성되어도 전송 전 제목·날짜·작성 화면 위치를 기존 root-owned RoomsCreateRecovery 메모리에서 복원한다. 디스크 저장/자동 전송/서버 변경 없이 동작한다.

## 합격 기준
명시 취소·생성 성공·인증 만료·로그아웃 clear·계정 변경은 초안을 제거한다. 제출되어 불확실한 immutable intent가 있으면 항상 그것을 우선하며 저장 초안이 이를 수정하지 못한다. 동일 계정 재생성은 GET만 허용하고 POST하지 않는다.

## 실행과 증거
추가 집중 테스트 RED/GREEN 후 기록 예정. 전체 하네스/실기기/실제 서버는 별도이다.

## 검증 결과
같은 계정 제목·작성 화면 재생성 시험에서 수정 전 실제 RED를 확인했다. 날짜 선택/재생성 GET-only, 명시 취소/계정 변경/clear 이후 오래된 callback 거절, pending immutable intent 우선/같은 요청 성공 후 양쪽 제거를 추가했다. rooms 집중 18개 PASS, rooms scoped analyze issues 0. owner를 교체한 같은 계정 위젯은 새 owner에 재바인딩한다. root는 기존과 같이 동일 계정 revalidation에 같은 owner를 주입하고 로그아웃 때 clear해야 한다. 디스크/서버/기기 검사는 실행하지 않았다.
