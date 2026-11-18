# #175 계정 탈퇴 feature · 아직 main 미연결

기준 origin/main d7eaa04. Native BFF 계약은 integration 8c02090으로 확인했다.
- 실제 HTTP는 POST /api/native/account/delete. requestId와 confirmation='계정 탈퇴'. 별도 receipt GET은 없으며 같은 bearer/requestId 재전송의 {deleted:true}가 영수증이다.
- 명시 최종 확인 전 쓰기 없음. 응답 유실 시 계정별 메모리 DeletionRecovery가 immutable intent와 원래 credential의 repository를 보존한다. 자동 재시도하지 않는다. 변경된 계정으로 재전송하지 않는다.
- 호스트는 verified account별 recovery를 소유하고 명시 로그아웃/계정 변경 시 clear/bind해야 한다. 미확인 요청이 있을 때 단순 화면 remount나 auth probe만으로 recovery를 지우면 안 된다. 앱 강제 종료 후 복구/영수증 확인은 미구현이다. credential/receipt를 별도 디스크에 저장하지 않는다.
- onDeleted(accountScope)는 해당 계정의 OS secure storage, auth/SDK identity, 모든 개인 화면·이미지·대기 요청 cache를 정리해야 한다. 다른 현재 계정을 지우면 안 된다. 실패하면 throw해야 로컬 정리만 다시 시도한다. 이 feature는 main/auth 파일을 바꾸지 않으며 실제 정리 연결 완료를 주장하지 않는다.
- 서버 영수증 확인 후 token reference 제거, cleanup 실패/성공과 서버 탈퇴를 구분한다. 401/유효하지 않은 영수증을 탈퇴 성공으로 해석하지 않는다.
- 승인된 web 정책의 공동 자유입력 삭제·숫자 유지·진행 판 미완료·미공개 제비 미공개·단독 관리자 방 7일 삭제대기·Kakao ID 최대 7일 처리를 그대로 설명한다. 실제 연결 해제 성공을 주장하지 않는다.

합격 기준: 명시 확인/취소, 동일 요청 retry, 중복 클릭, background/계정 교체/late response, 엄격 receipt, cleanup 실패 retry, 320px UI. TDD: 신규 테스트에서 구현 파일/클래스 부재 컴파일 실패를 먼저 확인했다. 실제 API/OS secure storage/실기기/Kakao 원격 호출은 수행하지 않는다.

검증 기록: 초기 missing implementation RED 이후 구현, logout clear 후 동일 계정 late receipt가 cleanup을 호출하는 실제 RED(1 vs 0)를 추가하고 owner epoch로 수정했다. 최종 feature9 + 기존 data11 = 20 PASS, 전체 Flutter analyzer No issues. 320px UI는 widget test이며 실제 기기/스크린샷 검증이 아니다. 시작 전 dependency cache 복사로 SDK plugin resolve가 실패한 analyzer는 offline pub get으로 복구했고 pubspec/lock 변경은 없다.
