# 브라우저 신원과 쿠키 · MVP-05

## 신원과 복구 정책

닉네임은 인증 수단이 아니다. 서버는 독립된 난수 session ID와 32바이트 암호학적 난수 토큰을 만든다. 토큰은 base64url이며 DB에는 SHA-256 hash만 저장한다. raw 토큰을 JSON·URL·localStorage·로그에 넣지 않는다. 쿠키를 가진 브라우저만 같은 신원을 복구한다. 다른 기기/브라우저·쿠키 삭제·만료 뒤에는 새 신원이고, 같은 닉네임이나 클라이언트가 보낸 참가자 ID로 이전 권한을 얻을 수 없다.

세션은 마지막 발급/갱신부터 **90일** 유효하다(구현 선택). UI는 기존 유효 신원을 조회한 뒤 같은 출처 POST로 수명을 갱신한다. 조회 GET 자체는 수명을 변경하지 않는다. 신규/만료 브라우저에서는 사용자가 ‘이 브라우저로 시작’을 누르면 새 신원을 만든다. 유효 토큰 재발급 요청은 같은 신원을 유지한다. 위조·만료 토큰으로 인증 GET은 401이며 발급 POST는 과거 신원 복구가 아닌 새 신원이다.

서버 게임 기록의 초기 자동 삭제 기한 없음과 세션 수명은 별개다. 세션 만료로 기록이 자동 삭제되지는 않지만 현재 브라우저 권한으로 복구할 수 없다. 90일 무활동 이후 이력 접근 상실은 안내해야 하며 장기 계정 복구는 MVP에 없다. 방의 10분 연결 유예/퇴장은 이 세션 수명과 다르며 후속 기능에서 처리한다.

## HTTP 경계

- `GET /api/session`: 서버 쿠키로 신원을 검증하고 `{authenticated:true}`만 반환. 신원 ID나 토큰을 반환하지 않는다. 없는/중복/형식 오류/위조/만료 쿠키는 401이다.
- `POST /api/session`: 빈 JSON 객체만 받는다. 닉네임·participantId·sessionId 입력은 400으로 거절한다. 현재 유효 쿠키가 있으면 갱신, 없거나 유효하지 않으면 새로운 신원을 발급한다.
- 쿠키: `__Host-trip_session`; HttpOnly, Secure, SameSite=Strict, Path=/, Domain 없음, Max-Age 90일. 로컬 시험을 이유로 Secure를 해제하지 않는다.
- 변경 POST는 미리 설정한 PUBLIC_ORIGIN과 Origin이 정확히 일치해야 한다. X-Trip-Court-Request: 1 및 application/json이 필요하고, Sec-Fetch-Site가 제공되면 same-origin만 허용한다. Origin 누락/null/타출처와 단순 폼 요청을 거절한다. CORS 허용 헤더를 추가하지 않는다. 커스텀 헤더는 비밀 토큰이 아니라 브라우저의 same-origin 제약을 이용하는 추가 조건이다.
- GET/POST에 Cache-Control: no-store. 세션 비밀은 Set-Cookie에서만 전달한다. 권한은 서버 세션 조회로 확인하며 query/header의 참가자 ID는 인증 자료로 쓰지 않는다. 향후 방/게임 명령은 이 신원으로 게임별 권한을 별도 검사해야 한다.

## 구성·수명·로컬 실행

API에는 DB_PATH 절대 경로와 PUBLIC_ORIGIN을 반드시 지정한다. 안전한 전용 DB 경로 선택은 호출자의 책임이다. production origin은 HTTPS만, 개발은 loopback HTTP만 허용하며 API bind는 계속 127.0.0.1이다. Node 앱은 시작 시 migration을 적용하고 종료 훅/기동 포트 실패 시 DB를 닫는다. 테스트는 임시 DB만 사용한다.

개발 Vite는 /api를 loopback API_PORT(기본 3001)로 프록시하여 브라우저에는 한 origin으로 보인다. 기본 PUBLIC_ORIGIN은 http://127.0.0.1:5173이다. 주소를 localhost로 바꾸거나 포트를 바꾸면 origin도 일치시켜야 한다. 배포에서는 같은 HTTPS origin 아래 프론트/API가 필요하며 실제 배포 설정은 후속 작업이다.

## 검증과 한계

- 단위: 토큰 hash·유효/위조/누락·갱신·정확한 만료 경계.
- 실제 Nest+SQLite: 쿠키 속성, JSON 비노출, DB hash, 동일 쿠키 유지, 신규 분리, 만료/위조/중복 거절, ID 주입 거절, CSRF 조건 실패 시 DB 생성 없음, 서버를 닫고 재생성한 뒤 복구.
- 실제 Chromium: loopback HTTP에서도 Secure/HttpOnly/Strict 쿠키를 유지했고 document.cookie에는 보이지 않음. 새로고침·재방문 복구, 독립 context 분리, 쿠키 삭제 후 안내를 확인한다. Playwright를 통해 쿠키를 읽는 것은 시험이며 앱 JS가 접근할 수 있다는 뜻이 아니다.
- Firefox/WebKit/실제 iPhone·Android·HTTPS 외부 배포는 아직 검증하지 않았다. localhost 예외를 외부 HTTP에 일반화하지 않는다. 다인 게임 역할/투표/이력 권한은 후속 티켓이며 이 단계의 단순 인증을 해당 기능 완료로 보지 않는다.
- 세션 대량 생성의 rate limit·종합 보안 회귀는 MVP-25 범위다. 쿠키를 탈취한 공격자나 악의적 같은-origin 스크립트까지 신원 도용을 막는다고 주장하지 않는다.

MVP-07부터 오류 JSON은 [통합 BFF 고정 오류 계약](web-bff.md)을 따른다. 인증 실패는 SESSION_REQUIRED이며 성공의 authenticated:true 형태는 유지한다.
