# #160 네이티브 카카오 토큰 검증 포트

상태: 검증 완료, 독립 리뷰 대기

## 목표와 범위
Flutter SDK가 받은 access token을 서버에서 검증하는 독립 포트/adapter를 구현한다. 기존 웹 OAuth, HTTP endpoint, session, DB migration, 운영 설정은 변경하지 않는다.

## 미결정과 가정
서버 expected app ID는 같은 웹/네이티브 Kakao 앱의 숫자 ID이며 실제 값은 읽지 않는다. 네이티브 key나 REST API key 문자열과 혼동하지 않는다. 후속 #161/#162가 계정 연결·세션·endpoint를 담당한다.

## 합격 기준
- 고정 HTTPS access_token_info GET, Bearer header만 token 전달, redirect 금지.
- app_id가 서버 설정과 같고 id는 양의 safe integer, expires_in은 양의 safe integer여야 한다.
- 잘못된/만료/다른 앱/누락/형변환 응답 거절. token이나 원문 provider 오류를 로그·예외에 남기지 않는다.
- HTTP와 body 전체를 합쳐 5초, 응답64KiB 상한. 합성 fetch만 사용.

## 실행과 증거
- RED: 새 adapter가 없는 상태에서 `node --test tests/unit/native-kakao-verifier.test.mjs` 실패 확인.
- GREEN: 신규8개 테스트 및 기존 웹 provider3개 회귀. 다른 app의 동일 subject도 거절, 서버 config 객체 외부 변경도 검증 앱을 바꾸지 못함.
- `npm run build`: contracts/API/web 성공.
- `npm run test:unit`: 209/209 성공, skip0.
- `npm run lint`: 성공.
- 네트워크는 주입한 가짜 fetch만 사용. stalled fetch/body는 mock timer로 전체5초 제한 확인. 실제 Kakao token·앱 ID는 조회하지 않음.
- API/session/DB/Flutter UI 및 실기기/live 호출은 범위 밖이며 검증하지 않음. push/PR/merge/issue close 없음.

포트: `NativeKakaoTokenVerifier.verify(token)` → `{subject,expiresInSeconds}`. config parser는 `KAKAO_APP_ID`를 읽도록 작성했지만 bootstrap에 연결하지 않았다. 누락은 parser에서 undefined이며 adapter에 유효 설정 없이 생성하면 거절한다. 후속 조합부가 미설정 verifier를 사용하지 않도록 failclosed해야 한다.

공식 규격: https://developers.kakao.com/docs/en/kakaologin/rest-api#token-info

## 회고
실제 Kakao 앱 설정과 실기기 로그인 검증은 이번 포트 단위 시험이 증명하지 않는다.
