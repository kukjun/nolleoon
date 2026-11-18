# Flutter 초대 앱 라우팅 · #164 부분 구현

## 목표 / 경계
검토된 초대 feature를 실제 AuthGate/RoomsScreen에 조합한다. 단일 app_links stream은 명시 검증 플래그 전까지 꺼져 있다. 실제 association/signing/Kakao 설정, 운영 API, 실제 사용자/자격 증명에는 접근하지 않는다. 관리/게임 전체 화면 조합은 별도다.

## 선택
- full HTTPS canonical invite만 받는다. 앱 내부 path만 전달된 경우도 거부한다. initial getter와 stream을 동시에 구독하지 않는다.
- 로그인 취소는 초대를 소모하지 않는다. 새 링크가 이전 링크보다 우선하며 로그인 성공만으로 참가하지 않는다.
- background/인증 재검증 중에는 초대 요청을 취소하고 private UI/응답 DTO를 없앤다. 같은 계정의 불확실한 참가 intent는 메모리에서만 보존해 수동 재시도한다. 만료/로그아웃/다른 계정에서는 버린다.
- 참가 성공은 서버 roomId로 실제 RoomsScreen을 연다. 같은 widget key에서 accountId 또는 initialRoomId 변경 시 기존 controller를 폐기하여 과거 요청이 새 화면을 덮지 못한다.
- 기존 방 만들기 불확실 요청의 같은 계정 재시도/로그아웃 제거 규칙을 유지한다.
- INTERNET 명시, ATS/HTTPS 유지, Android 자격 증명 preferences의 cloud/D2D 백업 제외. 플랫폼 초안/공식 링크는 `../flutter/link-association-drafts/README.md`.

## TDD / 검증 범위
최초 라우팅 시험은 새 link-source 타입/주입 API가 없어 컴파일 RED였다. 구현 후 cold 링크→로그인→명시 참가→실제 방 feature 표시 시험 통과. 초기 합성 async-generator stream 종료를 widget fake-async에서 await하여 종료가 멈춘 fixture 문제는 단일 controller stream과 비동기 정리로 수정했다. 중단 실행은 통과로 세지 않는다.

추가 시험: warm/중복/잘못된 URI/Kakao scheme 무시, 로그인 취소 후 최신 링크, 숨겨진 초대 무요청, same-key 방/계정 변경 중 늦은 응답 차단, suspend 후 같은 참가 바이트 재시도, 플랫폼 manifest 백업 제외. 기존 app-flow 및 방/초대 회귀를 함께 실행한다. 모두 합성 Dart widget/transport 시험이며 실제 Nest HTTP/OS 링크/실제 Kakao 공존은 미검증이다.

## 출시 게이트
실제 iOS/Android association, 네이티브 앱 빌드/서명, cold/warm 전달 및 Kakao callback 공존, OEM 백업/기기 이전 검증은 완료 전까지 별도 차단 상태다. 초안 파일을 도메인에 게시하지 않았다.

최종 focused 결과: `flutter test test/app test/features/invites test/features/rooms` 40/40 PASS (10초), `flutter analyze --no-pub` No issues. 새 lifecycle 시험 작성 중 void 반환 API에 await를 붙인 컴파일 실패는 제거 후 재실행했다. analyzer의 새 curly-brace 경고 5개는 해당 3파일만 자동 수정했다. API/브라우저 전체 하네스는 이 커밋에서 실행하지 않았다.
