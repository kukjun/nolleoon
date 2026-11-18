# 카카오 웹 인증 경계 · #122–124

확인일 2026-11-18. React 웹 + Nest 서버 흐름이며 Flutter/스토어/Apple 로그인은 범위 밖이다. 공식 문서 확인과 mock 검증은 실제 카카오 계정 로그인 성공이 아니다. 카카오 콘솔 앱 등록/도메인/동의 설정·운영 키 존재는 아직 확인하지 않았다. 키 발급, 앱 생성, 권한 추가, 운영 설정 변경은 실행하지 않았다.

## 공식 규격과 이 구현의 선택

공식 [REST API](https://developers.kakao.com/docs/ko/kakaologin/rest-api)는 인가 코드 요청 후 서버 토큰 교환과 사용자 정보 조회를 설명한다. 요청마다 state를 사용하고 등록한 redirect URI를 사용한다. 현재 [사전 설정 안내](https://developers.kakao.com/docs/en/kakaologin/prerequisite)는 Client secret 기본 활성화를 안내한다. 이 구현은 secret을 필수로 요구한다.

고정 카카오 HTTPS authorize/token/user-me endpoint만 사용한다. 서버에서 token을 교환하고 user-me의 회원번호만 계정 키로 사용한다. 이메일, 친구, 메시지, 프로필 사진, 닉네임 scope를 추가 요청하지 않으며 반환돼도 저장하거나 UI에 전달하지 않는다. 별도 OIDC/JWT 해석은 하지 않는다. provider 응답은 64KiB/총 5초 제한, redirect 금지, JSON/필드 검증이며 안전한 정수 범위를 넘는 회원번호는 반올림하여 다른 계정에 연결하지 않고 거절한다.

[로그아웃/연결 해제 개념](https://developers.kakao.com/docs/en/kakaologin/common)은 서로 다르다. 이 단계의 로그아웃은 **우리 서비스의 현재 브라우저 account session 폐기**다. 카카오 전역 로그아웃이나 연결 해제, 계정 삭제가 아니다. Kakao token은 교환 중 메모리에서만 사용하고 보관하지 않는다. 따라서 이 단계는 Kakao token revoke/unlink 기능을 제공하지 않으며 #138 탈퇴 정책·구현과 별도다.

## 설정 이름과 실서비스 체크리스트

서버 전용 `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`를 사용한다. 실제 값은 문서·Git·빌드된 프론트·로그에 넣지 않는다. 모든 키가 없으면 기존 익명 기능은 유지하고 account login은 503으로 닫힌다. 일부만 있거나 redirect가 정확한 `PUBLIC_ORIGIN + /api/account/callback`이 아니면 기동 설정을 거절한다. 개발은 별도 앱/키/등록 callback을 권장한다. localhost/127.0.0.1 HTTP 개발만 예외이고 운영은 HTTPS다.

운영자가 확인할 항목:
- 기존 소유 앱/REST API 키와 secret 활성화 여부. 필요한 값은 승인된 비밀 저장소로 공급.
- 웹 도메인 및 정확한 callback 등록. 추가 동의 항목을 켜지 말고 기존 앱에 이미 켜진 불필요 항목도 별도 검토.
- 로그/프록시에서 callback query(code/state), Cookie/Set-Cookie, provider request body/Authorization을 기록하지 않는지 확인. 앱 자체는 해당 값을 출력하지 않는다.
- 실제 계정 로그인/취소/두 탭/뒤로가기/모바일 카카오 복귀, 다른 기기 동일 계정 복귀와 다른 계정 격리.
- 현재 브라우저 로그아웃 후 만료된 cookie 재사용 거절. Kakao 계정 자체 로그아웃과 혼동하지 않는 안내.

콘솔 설정과 실제 credential/live smoke는 미실행이다. 이 문서는 설정 변경 승인이나 완료 증거가 아니다.

## HTTP 계약

- `GET /api/account/session`: cookie 없음 `{authenticated:false}`, 유효하면 `{authenticated:true,account:{id,displayName,presetId,revision,avatar}}`, 변조/만료는 401.
- `POST /api/account/login {returnTo}`: Origin/JSON/고정 CSRF header 검사 후 `{authorizationUrl}`. UI는 full navigation. returnTo는 정확한 `/travel` 또는 `/travel/invite/<20–128자 URL-safe 토큰>`만 가능하다.
- `GET /api/account/callback`: code/state는 서버가 소비하고 검증된 내부 경로로 303. 오류/취소는 `login=failed|cancelled`만 전달하며 원문 오류·code·token을 전달하지 않는다. 검증 불가능한 state는 `/travel`로만 돌아간다. no-store/no-referrer.
- `POST /api/account/logout {}`: 현재 cookie 및 같은 브라우저 흐름에 발급된 account sessions 폐기와 진행 중 인증 무효화. 익명 쿠키는 지우지 않는다.
- `POST /api/account/profile {expectedRevision,displayName,presetId}`: CAS 수정. 앱이 정한 이름과 10개 기본 아바타를 제공한다. 후속 [계정 사진](account-avatars.md) 확장에서는 명시 업로드 사진을 별도 저장한다. 이름만 수정할 때 사진을 유지하고 preset 실제 변경은 사진을 교체한다. 기존 익명 사진 데이터는 변경하지 않는다.

변경 POST는 `X-Trip-Court-Request: 1`, 정확한 Origin, application/json을 요구한다. callback은 외부 top-level GET이므로 flow cookie만 Secure/HttpOnly/SameSite=Lax, account cookie는 Secure/HttpOnly/SameSite=Strict다. 둘 다 __Host- prefix, Path=/, Domain 없음.

## 저장·경합·남은 범위

계정/provider identity/account sessions/OAuth attempts는 legacy sessions와 분리한다. state/browser/code/session token 원문은 DB에 저장하지 않고 hash만 저장한다. state는 5분, account session은 고정 30일(자동 갱신 없음)이라는 초기 구현값이며 배포 전 계정 정책 문서와 대조한다.

claim을 별도 짧은 transaction으로 먼저 확정한 뒤 provider HTTP는 transaction 밖에서 실행한다. finalization은 최신 exchanging 상태와 만료를 재검사한다. 중복 callback, 코드 재사용, 교환 중 새 로그인/로그아웃을 거절한다. 같은 브라우저의 다음 로그인은 이전 account sessions를 폐기하므로 늦은 옛 Set-Cookie가 도착해도 옛 권한을 되살릴 수 없다. 이 경우 UI는 401 후 다시 로그인할 수 있으며 브라우저 네트워크의 모든 응답 순서까지 제어한다고 주장하지 않는다.

현재 유효 계정과 다른 provider account로 몰래 교체하지 않는다. 계정 전환은 명시적 로그아웃부터 한다. 다른 브라우저의 동일 provider subject는 동일 account로 찾되 다른 브라우저 session을 자동 폐기하지 않는다. 앱 프로필은 DB account에 남는다.

로그인 자체가 #134 과거 기록 가져오기를 하지 않는다. 유효 익명 쿠키를 그대로 보존하지만 선택적 import/미리보기/충돌 처리는 별도 구현이며 이번 인증 성공으로 legacy 기록 소유권을 확대하지 않는다. OAuth 시도/code hash 보관 정리·계정 수명/전체 DB 용량 정책은 #140 운영 게이트에서 검토한다.

## 검증 범위

초기 auth 모듈 및 provider 파일 미존재 RED를 확인한 뒤 mock unit을 구현했다. fake 저장소 시험은 실제 SQLite 원자성/재시작 검증을 대신하지 않는다. provider mock은 실카카오 통신이 아니다. 후속 실제 SQLite/HTTP 시험 결과는 작업 보고의 정확한 commit/명령을 따른다. 제품 전체 하네스·실기기·실카카오 smoke·운영 배포는 별도다.

2026-11-18 개발 검증: auth unit 6 + provider mock 3 + 실제 Nest/SQLite HTTP 3 + native SQLite 3 통과. SQLite는 동시 callback, 동일 subject 계정 하나, 재개방 세션/코드 replay, session insert 장애 rollback, 교환 중 logout/만료를 확인했다. 전체 기존 unit 86/API 119는 통과했으나 DB 62 중 1건이 새 schema12 대 기존 시험의 hardcoded11 불일치로 실패했고 스키마 담당에 보고했다. 이 실패를 숨기거나 전체 통과로 기록하지 않는다. 브라우저와 실카카오 smoke는 이 백엔드 작업에서 실행하지 않았다.

독립 리뷰 수정: NFKC 뒤 Unicode Cc/Cf(보이지 않는 문자·bidi·C1 포함)를 거절한다. 해당 입력 RED 후 GREEN. 전역 요청 budget은 검증된 account principal을 우선 사용하고 legacy principal은 별도 namespace로 유지한다. 동일 proxy socket의 다른 계정 두 개가 각 80회 session 조회하는 HTTP 회귀가 기존 429 RED 후 모두 200 GREEN이다. 미인증은 여전히 socket IP 제한이며 X-Forwarded-For를 신뢰하지 않는다.
