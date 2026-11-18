# #173 재판 공통 화면 경계 보완

상태: 검증 (독립 리뷰 대기)

## 목표와 범위
restricted 재판 DTO는 일반 private play에 넘기지 않고 진행자에게만 별도 최소 단계 제어를 허용한다. 생성 configure와 수정 editConfigure를 명시적으로 분리한다. 수정은 shell이 소유하는 취소 가능한 dialog에서 기존 authorized snapshot을 받아 설정만 바꾸고 기존 선택명단을 유지한다. 서버 전용 PATCH와 captured version을 사용하며 서버의 동의 초기화 응답을 그대로 반영한다.

## 합격 기준
restricted 진행자는 숨은 설정을 빈값으로 추정하지 않고 수정 불가 안내와 명시적인 준비 취소/새 게임 경로를 사용한다. 준비 중 시작/계정 변경/배경 전환은 dialog와 오래된 callback을 폐기한다. 서버 버전이 바뀌면 자동 덮어쓰지 않고 다시 수정하도록 안내한다. 불확실 전송은 같은 immutable intent만 수동 재시도한다. onRunAvailable은 서버가 반환한 run ID를 부모에게 한 번 알리며 부모는 새로 생성한 완료 판도 재진입할 수 있다.

## 실행과 증거
restrictedControls 미구현 compile RED → 1개 PASS. editConfigure/onRunAvailable 미구현 compile RED → draft edit 3개 + 기존 owned dialog 2개 + restricted 1개 PASS. fixture의 기본 version 1/기대 7 불일치는 fixture를 명시 7로 정정했다. Flutter focused analyze issues 0. 실제 서버/기기/전체 하네스는 별도 검증이다.
