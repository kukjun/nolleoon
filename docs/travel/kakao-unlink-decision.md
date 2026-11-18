# 카카오 연결 해제: 구현된 경계와 남은 결정

2026-11-18, 놀러온. **이 문서는 연결 해제 완료 또는 운영 설정 변경 기록이 아니다.**

## 공식 규격과 현재 차이

[카카오 REST 연결 끊기](https://developers.kakao.com/docs/en/kakaologin/rest-api#unlink)는 동의 철회와 발급 토큰 폐기를 수행한다. 서버 Admin key 방식은 고정 HTTPS endpoint에 user_id를 POST하고 응답 id를 확인한다. [오류 규격](https://developers.kakao.com/docs/en/rest-api/error-code)의 HTTP400/code -101은 해당 앱에 연결되지 않은 사용자를 뜻한다. [Admin key API 범주](https://developers.kakao.com/docs/en/reference/admin-key-api)에 따라 카카오 로그인 사용 권한이 필요하다. 이 권한이나 키를 실제로 생성·조회·요청하지 않았다.

현 로그인은 access/refresh token을 저장하지 않는다. 현 로컬 탈퇴는 provider identity/session을 제거하지만 카카오 연결 해제를 호출하지 않는다. 둘을 같은 완료로 표시하면 안 된다.

## 이번에 구현한 것

`KakaoUnlinkProvider`는 테스트 가능한 독립 transport다. 정확한 user ID, 고정 endpoint, redirect 금지, fetch 5초 AbortSignal, streaming 응답 64KiB 상한, 일치하는 성공 id 검증, 400/-101 별도 결과를 제공한다. 원문 오류/키/ID는 에러 메시지에 노출하지 않고 자동 재시도하지 않는다. `KAKAO_ADMIN_KEY` 설정 parser는 별도 함수이며 **bootstrap에서 호출하지 않는다**. 계정 삭제 endpoint나 운영 composition에 등록하지 않았다. 테스트는 주입한 가짜 fetch만 쓴다.

## 원자성 선택지

| 선택 | 장애/재가입 위험 | 개인정보 및 판단 |
|---|---|---|
| Remote-first, 이후 로컬 삭제 | 원격 성공 후 프로세스 종료·SQL실패 시 로컬 계정은 남을 수 있다. 불확실 응답 재시도 사이 재가입하면 새 동의를 다시 끊을 위험 | 저장량은 적지만 단순 두 호출로 원자성을 보장할 수 없어 권장하지 않음 |
| 로컬 삭제 + 기한 제한 durable outbox | SQL 삭제와 작업 등록을 원자화하고 같은 provider subject의 재가입을 작업 종료 전 차단해야 함. 재시도는 backoff, 오류별 제한, lease 필요 | 최소 subject를 재시도 기한까지만 별도 보관해야 하며 승인된 보관기간·만료처리·암호화/접근통제·백업 복원 정책 필요. **권장**, 아직 승인/구현 아님 |
| 별도 재인증 기반 연결 해제 후 탈퇴 | 새 토큰으로 현재 사용자 확인 가능하지만 추가 OAuth 상태/동의 흐름이 생기며 여전히 원격 성공과 로컬 SQL 사이 장애 처리가 필요 | 새 UX와 실패 중간상태, 재가입 경합 정책을 별도로 설계해야 함 |

권장 outbox에서도 provider ID를 영구 삭제 원장에 넣지 않는다. 기한 내 성공/이미 해제 확인 후 outbox subject를 지우고 비식별 상태만 남긴다. 기한 만료 시 조용히 성공으로 바꾸지 말고 별도 미완료 상태와 재처리 방식을 정의해야 한다. 복원은 오래된 outbox를 무작정 재실행해 신규 가입을 해제하지 않도록 현재 authoritative 작업 상태를 검증해야 한다.

## 출시 전 확정/검증

1. outbox 보관 기한 및 만료 시 처리, 재가입 대기/차단 정책 승인.
2. 별도 서버 전용 Admin key와 해당 앱/최소 API 권한을 승인된 비밀 공급 경로로 제공. 현재 일반 로그인 key/secret과 혼동 금지.
3. 실제 키가 올바른 앱에 속함을 검증. 다른 앱의 -101을 이 앱의 성공으로 오인하지 않아야 함.
4. 원장·SQL·원격 HTTP 각 crash 지점, 네트워크 timeout, 동시 탈퇴/로그인, 재가입·백업 복원을 통합 시험.
5. 별도 승인된 시험 계정으로 live unlink 확인. 현재는 합성 검증뿐이며 실계정 호출은 하지 않았다.
