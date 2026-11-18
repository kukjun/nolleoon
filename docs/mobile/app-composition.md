# 앱 조립: 인증 → 내 여행방

`main.dart`는 이제 준비용 문구만 표시하는 화면이 아니라 실제 native auth / rooms 어댑터를 조립한다. 기본값은 네이티브 로그인 미설정이다. `KAKAO_NATIVE_APP_KEY`와 `NATIVE_AUTH_PLATFORM_VERIFIED`를 명시적으로 제공하기 전에는 카카오 로그인을 시작하지 않는다. 검증 플래그는 실제 Android/iOS 등록·콜백 검증을 대신하지 않으며 REST secret이나 서명 정보를 넣는 자리가 아니다.

검증된 앱 세션만 accountId별 여행방 subtree를 만든다. foreground를 잃거나 인증 상태를 확인 중일 때 이전 명단/방 상태 UI를 제거하여 controller와 요청을 정리한다. 돌아오면 세션 재확인 뒤 새로 조회한다. 원격 만료나 네트워크 오류를 가짜 로그인 성공으로 바꾸지 않으며, 미해결 보관 세션은 재확인/로그아웃만 허용한다. 로그아웃 버튼은 실제 native logout 어댑터를 호출한다.

프로필·게임 상세 화면과 링크 association/런타임 초대 복귀는 아직 미연결이다. 게임 진입 callback은 null이며 준비되지 않은 화면을 성공으로 표시하지 않는다. 초대 파서는 별도 작업이며 초대 수락 API/UI가 준비되면 연결한다.

## 검증 범위

- 합성 인증/transport를 주입한 widget 테스트: 로그인 전 방 조회 없음 → 서버 인증 결과 → 실제 RoomsScreen 목록 → 로그아웃 후 private subtree 제거.
- inactive → resumed 사이 private UI 제거, 재확인 네트워크 오류와 세션 만료 시 비노출 확인. 실제 OS 잠금/앱 snapshot 테스트는 아니다.
- 기존 scaffold widget 2개와 native smoke 테스트의 안내 문구를 새 미설정 UI 의미로 갱신했다. disabled login 검증은 유지·추가했다. native smoke는 실기기에서 실행하지 않았다.
- 실제 사용자 로그인/운영 API/네이티브 키/서명/association/배포 변경 없음.

최종 Flutter checker는 49개 unit/widget PASS, pin/lock/format/analyze PASS. 뒤이어 native smoke에 합성 auth를 주입하여 실제 기기에서 이 시험을 실행하더라도 기존 보안 저장소/실계정/HTTP를 건드리지 않게 했고 format/analyze를 다시 통과했다. 이 smoke 자체는 네이티브 빌드 환경 gate 때문에 여전히 미실행이다.
