# #159 기존 API 계약 추출 및 Flutter fixture

상태: 부분 구현 / 독립 리뷰 대기

## 범위
기준 f955209 main의 기존 account session/room/invite/run/API 오류·version·requestId·privacy 계약을 읽어 JSON 합성 fixture와 소비자 문서, Node 계약시험 추가. 서버/웹 동작·DB·인증 보호 변경 없음. native adapter #162 및 Dart SDK/models는 아직 구현하지 않음.

## 합격 기준
실제 public presenter/parser/engine와 fixture 일치, DTO enum/nullable 구분, 비밀/타인 private 결과 미포함, 실패·취소를 성공으로 처리하지 않고 동일 의도 재시도 ID 보존. 명령 body와 버전 출처 명시.

## 증거
fixture 존재/버전 검사 RED(ENOENT) 후 생성. 실제 room presenter, 4 engine projector, 웹 parser, error presenter, native requestId/version 검사와 비교한 Node8/8 PASS. caller cancellation/응답유실후동일body재시도, 투표 작성자만 보는 사유 수신확인·타인 비공개 fixture 포함. 설치는 기존 npm lock 기준이며 Dart 설치/프로젝트 생성 없음. 상세 결과/커밋은 보고에 기록.

## 독립 리뷰 반영
초대 발급은 동일 requestId 재시도가 STATE_CONFLICT이고 token 재전송/유실복구가 안 되는 예외를 문서와 machine fixture에 명시했다. 실제 TravelRooms.issueInvite에 기존 receipt를 주입해 token 생성/재전송이 발생하지 않는 시험을 추가했다. 새 예외 metadata 테스트 RED 후 보완. 투표 사유 privacy 사례는 실제 TrialEngine의 prepare→동의→start→begin-vote→vote→project 결과를 fixture와 직접 비교하도록 강화했다. Node9/9 PASS; 원래 fixture 검증만으로 실제 projection을 검증했다고 확대해석하지 않는다.
