# 네이티브 세션 수명과 복원

상태: 위임 승인 기본값, #161

- 별도 native_account_sessions의 opaque bearer. SecureTokens가 32 random bytes를 만들며 DB는 SHA256 hash만 저장한다. 웹 browser_hash나 cookie를 흉내 내지 않는다.
- 발급 시각부터 절대30일. 자동 연장/refresh token은 없다. 만료 시 Kakao 재인증 후 별도 세션을 발급한다. Kakao access token의 만료와 우리 앱 세션 만료는 별개이며 provider token은 보관하지 않는다.
- 같은 검증된 Kakao 앱·subject는 기존 account ID를 재사용한다. disabled 계정은 발급하지 않는다. 앱 기기별 세션은 독립이며 현재 앱 logout은 해당 bearer만 폐기한다.
- 탈퇴는 웹과 native 세션을 모두 삭제한다. 진행 중 token 검증 이후 authoritative 삭제/큐 상태와 pending subject를 재확인한다.
- 복원 대상의 모든 native 세션을 제거한다. 원본 백업은 변경하지 않으며 기존 웹 session 복원 정책은 이번 변경에서 바꾸지 않는다.
- 토큰 검증/로컬 세션 유스케이스는 HTTP transport를 알지 못한다. controller/권한분리/CSRF·Origin 정책은 #162에서 별도 구현·검증한다.

보안 의존성: NativeAccountAuth를 조합할 때 NativeAuthAuthority.check는 현재 원장·unlink 큐 검증과 pending 삭제 재생을 수행해야 한다. pending(subject,now)는 현재 권위 큐에 조회해야 하며 optional no-op으로 대체하면 안 된다. await 이후 check는 transaction 밖에서 수행하고, transaction 안에서 현재 계정/세션 상태를 읽는다.

## #162 공통 command 확장

명시적 `{accountId,sessionHash,transport}` principal로 profile·사진 명령을 재검증한다. 기존 웹 actor의 transport 생략은 호환을 위해 web만 뜻한다. native hash를 web 저장소에서 받아들이거나 가짜 cookie로 바꾸지 않는다. 사진 decode 뒤에는 authority callback과 해당 transport의 현재 session을 다시 확인한다.

계정 삭제의 `execute`는 web 고정, `executeNative`는 native 고정이다. schema20의 별도 native deletion receipt는 동일 bearer/requestId의 삭제 완료 응답만 허용하고 계정 권한을 복구하지 않는다. receipt 유효기한은 원래 session 만료시각이며 재생으로 늘어나지 않는다. 복원 때 native session과 native 삭제 receipt를 모두 제거하고 웹 receipt는 유지한다. HTTP controller는 #162 별도 작업이다.
