# #175 앱 종료 뒤 탈퇴 영수증 복구

`DeletionReceiptStore`는 삭제 요청 하나만 저장한다. 정상 로그인 세션이나 새 계정의 인증 수단으로 복원하지 않는다. 운영 root 조립은 `SecureDeletionReceiptStore` 한 인스턴스와 검증된 원래 `AuthSession.expiresAt.millisecondsSinceEpoch`를 repository에 함께 주입해야 한다. 옵션을 생략하는 기존 합성 테스트와 메모리 전용 호출은 process-death 보장을 제공하지 않는다.

- 최종 확인 뒤 POST **전** 원래 accountScope/requestId/bearer/만료시각을 저장하고 읽어서 일치 여부를 확인한다. 저장 실패 시 POST하지 않는다.
- 영수증 성공 응답 뒤 메모리 bearer를 지우고, 같은 저장 키를 bearer 없는 `confirmed` envelope로 바꾼다. 저장 실패 시 완료로 표시하지 않는다. 메모리에서 확인된 요청은 다시 POST하지 않고 저장/로컬 정리만 재시도한다.
- 쓰기 실패 직후 프로세스가 종료되어 이전 pending이 디스크에 남으면, 복원된 **동일 requestId·원래 bearer**로 사용자 명시 영수증 확인만 허용한다. 서버의 원래 session 만료시각을 연장하거나 임의 24시간 정책을 만들지 않는다.
- confirmed 복원은 cleanup-only다. secure 로그인 정보와 계정별 private cache 정리가 성공하고 영수증 삭제까지 확인해야 완료다. 정리 실패도 다시 안내한다.
- bootstrap `read()`가 끝나기 전 정상 로그인/계정 화면을 열지 않는다. `DeletionRecovery.restore(...).pendingRepository`로 복원하며 자동 POST는 없다. 다른 계정 controller에 연결하면 거절한다.
- malformed/expired/알 수 없는 필드/다른 계정·요청 덮어쓰기는 차단한다. 만료/손상 상태를 단순 null로 바꿔 이전 인증을 정상 로그인으로 부활시키면 안 된다. root가 기존 secure 로그인 상태를 먼저 안전하게 정리하고 저장된 영수증 삭제를 명시 처리한 뒤 새 흐름을 허용해야 한다. 이 root 조립은 별도 작업이다.

저장은 기존 `flutter_secure_storage`와 iOS `first_unlock_this_device` 정책을 사용한다. Android 앱의 shared preferences cloud/device-transfer 백업 제외를 유지해야 한다. 이 변경은 설정/권한을 바꾸지 않는다. 계정·토큰·payload를 예외/log/toString에 넣지 않는다.

검증: envelope strict/만료, 합성 secure platform의 새 adapter 인스턴스 복원·단계 역행 거절, 저장 실패 전 POST 차단, 전송 후 응답 불명 상태의 동일 요청 복원, ACK 뒤 쓰기 실패/cleanup 재시도, 계정 교체 거절. 실제 OS 보안 저장소/강제 프로세스 종료/백업 복원/운영 계정은 실행하지 않았다. TDD 최초 누락 모듈 RED 후 targeted tests로 검증한다.
