# #161 네이티브 계정 세션

상태: 구현·검증, 독립 리뷰 대기

## 목표와 범위
독립 opaque native session 저장소/유스케이스를 구현한다. 동일 Kakao 앱의 검증된 subject는 기존 웹 계정을 재사용한다. controller/Authorization 파싱/라우팅은 #162이며 이번에는 추가하지 않는다.

## 미결정과 가정
위임 승인된 기본값: 절대30일, refresh 없음, 만료 시 Kakao 재인증. logout은 현재 앱 session만, 계정 삭제는 웹+native 전체, 복원은 native 전체 무효화·웹 session은 기존 정책 그대로.

## 합격 기준
32 random bytes(43자 base64url) bearer는 DB에hash만 저장. 별도테이블이며 fake browser hash는 만들지 않는다. disabled/pendingunlink 거절, awaited provider 뒤 authoritative guard 재검사, 잘못된 앱 및 삭제경합에서 session발급없음. 복원/삭제/다른앱session 회귀 및 기존자료보존.

## 실행과 증거
신규 모듈 부재 RED 확인 후 core시험 GREEN. 복원 native session 잔존1→기대0 RED 재현 후 제거를 구현했다. 전체 build 성공, 전체 unit209/DB133 성공(이후 동시로그인/잘못된앱 시험2개 추가 GREEN), lint 재검사. 실사용자/키/운영DB/배포는 접근하지 않는다.

## 회고
native public API가 연결되기 전까지 유스케이스 시험 결과를 실제 Flutter 로그인 완료로 표현하지 않는다.
