# 네이티브 BFF 경계

Flutter용 `/api/native`는 독립 BFF 서버가 아니라 기존 Nest의 별도 HTTP 어댑터다. 여행방과 계정 사진의 route 메타데이터/핸들러를 abstract base로 한 번 선언하고 웹·native 컨트롤러가 인증 정책만 선택한다. 실제 Nest HTTP 시험으로 상속된 route와 params를 검사한다.

## 인증

- 웹: 기존 Secure/HttpOnly cookie, Origin·CSRF·Fetch-Site 검증 유지.
- native: 하나의 `Authorization: Bearer <opaque>`만 사용. Cookie가 함께 있으면 거절한다. 웹 경로는 Authorization을 cookie 대용으로 받아들이지 않는다.
- 로그인 교환은 `{accessToken}`만 받는다. 제공자 토큰은 서버 verifier로 검증하고 요청 본문의 subject/accountId는 신뢰하지 않는다. URL·로그·응답 cookie로 토큰을 전달하지 않는다.
- 계정 세션 30일 절대만료. refresh 없음. logout/계정 삭제/복원 시 폐기 정책은 #161에 따른다.
- native protected 경로는 원장·queue 권위 상태를 검증한다. native 로그인 미설정은 503이며 실제 제공자 성공으로 해석하지 않는다.

## 공통 서비스

방·게임은 기존 accountId 유즈케이스와 payload/CAS/역할·참가자 검증을 그대로 사용한다. 계정 프로필·사진은 transport 태그가 있는 principal의 현재 세션을 저장소에서 검증한다. 사진 decode 후에도 폐기/만료를 재검증한다. 삭제 endpoint는 세션이 삭제된 뒤에도 같은 요청 receipt를 확인할 수 있도록 syntax 검사와 서비스의 receipt 검증을 분리한다.

이미 연결한 legacy 기록의 list/detail만 native에 제공한다. anonymous cookie 증명이 필요한 preview/import는 웹에서만 수행한다. native 인증으로 익명 기록을 자동 연결하지 않는다.

사진 URL은 native 경로이며 이미지 요청에도 Authorization이 필요하다. 인증 토큰을 이미지 URL에 넣지 않는다. 공용 원본 제한/decoder 동시성/정규화/CAS/현재 참가자 ACL을 재사용한다.

## 요청 제한

검증된 web/native account는 같은 account budget을 공유한다. 위조/만료 토큰은 account identity로 계산하지 않는다. native 업로드에도 전용 제한을 적용한다. 제한은 프로세스 메모리 내 방어이며 프록시 뒤 익명 IP 공유나 분산 공격 방어를 보장하지 않는다.

## 검증 한계

테스트는 loopback Nest·합성 SQLite·합성 Kakao verifier를 사용한다. 실제 Kakao, iOS/Android 저장소, 앱 배포·스토어 승인·운영 설정 변경의 증거가 아니다.

## 생산 코드 배선

`KAKAO_APP_ID`는 공식 토큰 조회 응답의 app_id를 비교하는 공개 앱 식별자다. 설정이 없으면 웹은 계속 동작하며 native 로그인 교환은 503이다. 잘못된 값은 시작 실패다. 값이 있으면 기존 계정/방 삭제 원장과 unlink queue가 반드시 구성되어야 한다. 이 작업은 설정 읽기/검증 코드만 추가하며 실제 env, 제공자 콘솔, 실행 서비스는 변경하지 않는다.
