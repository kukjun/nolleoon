# 여행방 관리 (#168)

## 범위

서버 RoomDto 권한/현재 버전을 사용한 방 정보(이름·선택 날짜), 열기/닫기, 관리자 위임, 추방, 퇴장, 삭제 대기 및 삭제 방 목록/복원 UI. 새 권한이나 게임 규칙은 만들지 않는다. 서버 `TravelRooms`, `TravelRoomDeletion`, native inherited routes와 대조했다. solo 관리자는 바로 퇴장하지 못하고 위임할 대상이 없으면 방 삭제 경로를 이용한다. 진행 중 게임의 닫기/삭제/퇴장/추방은 노출하지 않으며 서버 재검증이 최종 권한이다.

삭제·복원·위임·추방·퇴장 등 변경은 대상과 영향을 화면 내 AlertDialog로 확인한다. 보호 subtree 밖 navigator overlay에 개인 대상 정보를 남기지 않는다. 변경된 계정/방/저장소로 같은 key를 재사용해도 이전 form과 confirmation은 무효화한다. 앱/OS 설정이나 실제 운영 데이터는 변경하지 않았다.

## 앱 연결 계약 (아직 미연결)

- `ManagementScreen(repository, roomId, accountId, recovery, onSessionLost)`
- `DeletedRoomsScreen(repository, accountId, recovery, onSessionLost)`
- verified accountId 필수. `ManagementRecovery(accountId)`는 인증 상위에서 각 관리 route/room별로 소유해야 한다. 동일 계정의 일시적 화면 재생성 때는 유지하고, 명시적 로그아웃/다른 계정/만료 시 `clear()` 후 버린다.
- 복구 객체에는 재요청에 필요한 immutable MutationIntent만 있으며 방 목록/화면 명단은 controller 폐기 시 지운다. 자동 재전송은 없다. 불확실한 작업 중에는 다른 변경을 막고 같은 bytes/requestId의 수동 재확인만 허용한다. 409는 새로운 확인과 조회가 필요하며 기존 요청을 새 버전으로 몰래 재작성하지 않는다.
- 401은 보호 정보를 지우고 현재 callback으로 상위 인증 처리를 요청한다. 준비되지 않은 main 라우팅·서버 배포 완료를 뜻하지 않는다.

## 데이터 계층 최소 확장

`deletedRooms`, `deleteRoom`, `restoreRoom`만 추가했다. 각각 `/api/native/travel-deleted-rooms`, `/:roomId/deletion`, `/:roomId/restore`. 삭제에는 expectedVersion 및 DELETE_ROOM 확인값, 복원에는 requestId/deletedAt/deletionVersion만 보내며 일반 expectedVersion을 허용하지 않는다. 기존 네트워크/인증/host 보호 검사는 유지한다. 다른 작업자의 binary avatar 파일은 변경하지 않았다.

## 검증

초기 누락 operation RED → 구현. unsafe 삭제 버전 정수의 실제 수용 실패도 별도 RED로 재현 후 safe integer 경계를 추가했다. 합성 transport와 widget 테스트로 admin/participant/solo/active game, 409/401, 동일 retry, 계정별 pending 복구, 취소 무전송, 시스템 Back/초안 유지, 320px 큰 글자, 복원 proof 및 같은 key 계정 교체를 검사했다. 실제 서버/실계정/물리 기기에서 삭제나 복원을 실행하지 않았다. 앱 연결, 완전한 네이티브 빌드/권한/배포 검증은 별도다.

최종 검증: 신규 관리 12개를 포함한 해당 worktree 전체 48개 unit/widget PASS. Flutter pin/lock/format/analyze PASS. 네이티브 integration_test는 실행하지 않았다.
