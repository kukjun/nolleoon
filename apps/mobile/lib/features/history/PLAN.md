# #174 계정별 여행방 기록

## 실제 계약과 범위
`TravelRuns.history` / `project`와 NativeRoutes를 대조했다. `GET /api/native/travel-rooms/:roomId/history?cursor=…`는 `{items:RunDto[],nextCursor}`이고, 상세는 `GET /api/native/travel-rooms/:roomId/runs/:runId`다. 기존 ApiClient·RunPageDto·RunDto를 그대로 사용하며 새 data operation이나 서버 정책을 추가하지 않는다.

현재 서버는 활성 방 멤버십을 검증한다. 재판 목록은 동결 참가자로 제한하고 비재판은 방 구성원에게 서버 projection으로 허용한 기록을 반환한다. 이 화면은 계정 전체·탈퇴한 방·삭제 대기 방의 별도 접근 권한을 만들어내지 않는다. 403/404/410은 이전 목록과 상세를 비운다. 실제 상세 GET의 서버 maintenance는 기존 서버 계약이며 클라이언트 명령은 모두 GET뿐이다.

## 표현과 비공개 경계
- 서버 status를 준비/진행/완료/미완료/중단으로 구분한다. 미완료를 완료나 패배로 바꾸지 않는다.
- `redacted`는 명시된 숫자 집계만, `restricted` 또는 game=null은 접근 제한 안내만 렌더한다. JSON 전체를 문자열로 표시하지 않는다.
- 팀별 인원, 실제 공개된 제비 당첨/비당첨 수, 최종 메뉴, 공개된 재판 판정·라운드 수치·익명 이유를 표시한다. 비공개 후보·자기 제출 초안·미공개 제비를 복원하거나 추정하지 않는다. 재판 상세 벌칙은 유죄 결과에서만 표시한다.
- cursor는 불투명하게 전달하고 반복 cursor는 오류로 처리한다. 페이지 겹침은 runId로 합치고 낮은 버전으로 되돌리지 않는다. 다음 cursor가 있으면 더 보기이며 전체를 다 읽었다고 주장하지 않는다.

## 앱 연결 계약
`HistoryScreen(repository, roomId, accountScope, onSessionLost)`에서 accountScope는 상위 인증이 확인한 계정 ID다. 동일 key의 계정/방/repository 변경은 controller를 폐기하고 이전 응답을 무효화한다. callback 변경만으로 목록을 지우지 않는다. inactive/background에서는 메모리 목록·상세를 비우고 요청을 취소하며 foreground 복귀는 새 GET을 한다. 401은 상위 인증에 알리고 자동 요청을 중단한다. 별도 캐시·저장·자동 명령 재전송은 없다.

main/router 연결, 실계정 인증·실서버 접근, 실기기 lifecycle은 이 커밋의 완료 범위가 아니다. pubspec 및 다른 기능 파일을 변경하지 않는다.

## 검증 기록
- 첫 시험은 미구현 repository/controller/summary module 부재로 compile RED(1 loader failure). 8개 동작 시험이 실행됐다고 주장하지 않는다.
- 구현 후 합성 transport unit/controller 8개 + widget 2개 = 10개 PASS. NativeRoutes/strict DTO를 통과하는 GET과 cursor, 중복/반복 페이지, 401/403, cross-room/run 응답 거부, background/늦은 응답, restricted/redacted, 미완료 제비/전원패스 메뉴를 검사했다.
- widget은 같은 key 계정·방 교체 중 늦은 상세 응답 폐기, 320px 긴 텍스트, 상세 뒤로가기, inactive 숨김/복귀를 검사한다. 물리 기기나 실서버 증거가 아니다.
- 최종 변경 후 focused 10/10 PASS, scoped analyze 0 issues(1.2초), dart format 6파일 변경0 및 diff check 통과. 최초 analyze의 brace-style 정보 5개를 규칙 비활성화 없이 수정하고 다시 검증했다. 전체 앱·실기기 검사는 미실행.
