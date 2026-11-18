# #166 현재 방 멤버 사진 sidecar

기준 mobile main950495a. 실제 backend 계약은 native 통합8c02090의 AccountAvatars.roomProfiles/roomImage, NativeAvatarController/AccountAvatarRoutes와 대조했다. 기존 `tests/integration/account-avatar.test.mjs`의 현재 양측 멤버십/open ACL과 `native-bff.test.mjs`의 Bearer/사진 경로를 참고했다. 서버·웹·RoomDto schema 변경 없음.

## 소비 API
- `room_avatars.dart`: RoomAvatarsRepository(ApiClient,AvatarClient), RoomAvatarsDto, RoomAvatarSource(합성 fixture 주입용).
- `room_avatar_widgets.dart`: RoomAvatarsScope(accountScope,roomId,closed,repository,child,refreshKey?,onSessionLost?)와 RoomMemberAvatar(membershipId,presetId,size,label).
- repository는 확인된 계정별 stable 인스턴스로 만든다. scope 계정/방/repo 변경은 이전 controller를 폐기한다. root/rooms/game 연결은 다른 작업에서 수행하며 이 커밋에는 main/AuthGate/게임/로비 파일 수정이 없다.
- metadata 응답은 `{members:[{memberId,avatar:{kind,presetId,revision,imageUrl}}]}`. memberId를 기존 room.members.membershipId와 명시적으로 join한다. accountId/extra/중복ID/타방·타멤버·다른 revision URL을 거부한다.
- native sidecar GET만 ApiOperation에 추가. 사진은 기존 AvatarClient의 HTTPS 고정host/엄격Bearer/noCookie/noRedirect/64KiB stream bound/cancel을 사용한다. ProfileAvatar를 재사용해 RawImage로 decode/dispose, Image.network/MemoryImage/디스크 캐시를 추가하지 않는다.

## 개인정보와 자원 경계
- CURRENT open-room membership 사진만 표시한다. 서버 ?v는 snapshot pin이 아니므로 과거 이미지라고 주장하지 않는다. 탈퇴·나간 멤버, restricted/redacted 기록의 ID/이름을 복원해 photo lookup하지 말아야 한다. 해당 결과는 host가 식별 avatar를 표시하지 않아야 한다.
- visible widgets가 retain한 멤버만 다운로드. 동일 metadata signature에서는 다시 받지 않고 revision/kind/url 변경 때 기존 bytes를 즉시0으로 만들고 새 GET. 여러 widget의 같은 멤버는 하나의 buffer를 공유한다.
- 동시에 최대2개 binary request, 보관 최대16개×64KiB encoded image. 17번째 visible photo는 기본 표시하고 slot이 생기면 받는다. 같은 사진을 여러 widget에서 decode하는 비용/OS RSS hard limit를 보장하지 않는다. #116 정책을 중복 완료하지 않는다.
- foreground metadata10초 poll, refreshKey 변경으로 명시 refresh/이미지 재시도. background/closed/identity change/dispose는 metadata·bytes 삭제와 요청 취소. 401/403/404/410는 scope를 terminal fallback으로 바꾸고 재시도 루프를 멈춘다. 401은 host 인증 갱신 callback. invalid/network metadata도 이전 private사진을 지우되 이후 foreground poll 허용.
- late response는 generation/request identity/signature/watch 여부 모두 검사하고 반환 bytes를0으로 만든다. 이미지0은 Dart buffer 정리이며 시스템 메모리의 모든 복사본을 물리적으로 덮어썼다는 보장은 아니다.

## 검증과 제한
첫 missing-module RED 확인 후 구현. invalid metadata 후 사진 잔존 실제RED([1,2,3] vs null)를 추가한 뒤 failclosed clear로 수정. 합성 source/transport와 생성한 녹색 PNG만 사용한다. widget PNG는 private decode 경로 시험이며 HTTP MIME 검증은 기존 AvatarClient 시험과 별개다. 실제 사용자 사진/API/운영 조회 없음. 실제 플랫폼·실기기·root연결·전역 RSS/DB 예산은 검증하지 않는다. 최종 focused 결과는 아래 추가한다.

최종 좁은 실행: sidecar feature10 + 기존 data21 =31/31 PASS(약2초), 변경 feature/test/API client scoped analyze No issues(1.2초), format 및 diff check PASS. 최초 style analyzer 정보는 해당 코드 brace/import 정리로 해결했고 규칙을 끄지 않았다. 전체 Flutter/full backend 하네스는 이 모듈 작업에서 실행하지 않았다.
