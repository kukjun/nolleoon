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

## v2: 원래 세션의 로컬 정리 증명

pending 생성 시 원래 bearer의 SHA-256 `tokenDigest`를 계산하고 confirmed에서도 같은 digest만 유지한다. root의 별도 local-only cleanup은 현재 secure session token의 digest가 일치하거나 token이 없을 때만 정리하며, 다른 새 session은 건드리지 않는다. digest도 로그나 서버로 보내지 않는다. 이전 v1 데이터는 자동 승격하지 않고 명시 오류로 차단한다. 아직 배포되지 않은 스키마 변경이다.

기존 lock에 있던 dart.dev의 [crypto 3.0.8](https://pub.dev/packages/crypto/versions/3.0.8)을 같은 버전 direct exact dependency로 선언했다. 직접 해시를 구현하지 않았고 다른 dependency version/hash는 바꾸지 않았다. pending token/digest 불일치, confirmed raw token 부재, v1 거절 추가 회귀 포함 scoped16 PASS.

## 독립 리뷰 수정: 지연 쓰기의 bearer 부활 방지

같은 저장 키의 read/check/write와 clear를 인스턴스 간 static queue로 직렬화한다. 이전 pending 쓰기가 지연되어 confirmed 저장이나 clear 뒤에 완료되는 순서 역전을 방지한다. 실패한 작업도 이후 queue를 영구 차단하지 않는다. root는 한 isolate의 저장 owner만 사용하며 별도 background isolate/extension 쓰기는 지원하지 않는다.

독립 리뷰의 지연 platform write 재현을 실제 RED로 확인한 뒤, 다른 adapter 인스턴스에서 confirmed/clear를 요청하는 회귀 두 개로 GREEN을 확인했다. targeted18 PASS, scoped analyze clean. OS 권한/실제 secure store 실행을 주장하지 않는다.

## #210 Android commit 확인 경계

Android의 plugin `apply()` 완료와 디스크 commit 확인을 구별한다. session write/delete와 receipt pending/confirmed/clear는 plugin 작업 뒤 `nolleoon/native_secure_storage_barrier` 채널의 인자 없는 `flush`를 기다린다. 응답 bool true만 성공이며 false/다른 타입/bridge 누락/예외/5초 미응답은 실패로 반환한다. 민감 key/value를 채널 인자로 보내지 않는다. receipt 작업의 기존 인스턴스 간 queue는 barrier 완료까지 유지된다.

두 기본 `FlutterSecureStorage` 인스턴스에 Android `resetOnError:false`를 명시하여 손상 오류를 조용한 초기화 성공으로 바꾸지 않는다. 암호화 알고리즘·권한·backup 정책·의존 버전은 바꾸지 않는다. iOS는 기존 this-device Keychain 경로를 유지한다.

pending commit 미확인 시 destructive POST는 0이다. ACK 뒤 confirmed commit 또는 session 삭제 commit을 확인하지 못하면 cleanup 완료라고 표시하지 않는다. 기존 합성 secure-store 시험에는 fake barrier를 명시 주입했으며, 별도 channel 시험이 bridge 오류/누락/timeout과 no-argument 계약을 검증한다. 합성 테스트는 실제 Android Kotlin 컴파일, OS 저장소 또는 kill/relaunch 검증을 대체하지 않는다. native handler와 Dart를 함께 통합해야 Android 저장이 성공하며, handler 없는 빌드는 의도적으로 fail-closed다.

Dart의 5초 timeout은 native 작업을 취소하지 않는다. native 단일 executor에 이미 들어간 commit은 나중에 완료될 수 있다. timeout 뒤 Dart queue가 진행되어 새 plugin write/delete가 일어나더라도 이전 barrier는 비밀 값/삭제된 bearer를 다시 쓰지 않고 고정된 non-secret marker만 바꾼다. 따라서 늦은 marker 응답을 성공으로 승격하지 않으며, 새 작업은 자기 barrier의 true 응답과 뒤이은 readback 일치를 다시 요구한다. 이는 native/OS 저장 순서의 실제 기기 검증을 생략할 근거가 아니며, 강제 종료·디스크 실패·backup 복원 검증 gate는 남는다.
