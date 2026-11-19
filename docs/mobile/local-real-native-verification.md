# 로컬 실제 토큰 검증 서버 준비

이 runner는 실제 로그인 완료 증거가 아니다. 구현 검증은 fake fetch와 합성 계정/토큰으로만 수행했다. 사용자 본인 또는 지정 시험 계정의 실제 로그인과 앱 ID 일치 확인은 후속 승인/확인이 필요하다. Native 앱 키, Admin 키, 실제 토큰은 코드·문서·출력에 넣지 않는다.

## 실행 경계

- 별도 명시 실행: `node tools/mobile/native-real-verification.mjs --local-real-verification`
- `127.0.0.1:4189` 고정. 포트 충돌 시 실패하며 다른 포트/운영 origin으로 대체하지 않는다.
- 사용자 홈의 `Library/Application Support/Nolleoon/native-auth-test/native-kakao.env`를 읽는다. 이 작업에서는 실제 파일을 읽지 않았다.
- 파일은 소유자 본인의 일반 파일, 정확한 `0600`, 최종 경로 symlink 아님, 16 KiB 이하가 필요하다. `KAKAO_APP_ID=<양의 정수>` 하나만 서버 설정으로 추출한다. Native 앱 키 등 다른 값은 반환·사용·기록하지 않는다. 파일을 쓰거나 권한을 자동 수정하지 않는다.
- 서버는 `KakaoNativeTokenVerifier`의 정해진 Kakao access-token-info HTTPS API만 사용한다. 서버 시작만으로 provider 요청은 발생하지 않는다. 실제 token POST 시에만 검증한다. 임의 계정 사용 승인으로 해석하지 않는다.
- 앱 키와 app ID가 실제 시험 대상 앱에 속하는지 운영자가 확인해야 한다. 앱 ID 불일치 또는 provider 오류는 실패한다.

## 허용된 표면

POST `/api/native/auth/kakao`, `/api/native/auth/logout`, `/api/native/travel-rooms`.
GET `/api/native/account/session`, `/api/native/travel-rooms`, `/api/native/travel-rooms/:roomId`.

이외 메서드/경로는 404. 쿼리, trailing slash, 인코딩 별칭도 허용하지 않는다. 따라서 목록 pagination, 프로필 수정, 아바타, 게임, 기록, 초대, 방 삭제/복구, 계정 삭제, legacy API는 이번 서버에서 지원하지 않는다. 방 단건 조회 자체의 기존 권한 검사는 그대로 유지한다. 로컬 native logout은 로컬 bearer 폐기이며 Kakao logout/unlink가 아니다.

별도의 unlink provider를 주입하지 않는다. unlink/방 삭제/presence/settlement 주기 worker는 모두 끈다. CORS/ATS/cleartext/터널/방화벽/서명 설정을 변경하지 않는다. loopback은 같은 컴퓨터의 모든 프로세스에서 접근할 수 있으므로 실행 중 공유 컴퓨터/원격 공개 연결을 피해야 한다.

## 저장과 종료

설정 파일의 부모 디렉터리 아래 매번 `verification-run-*` 새 전용 디렉터리(0700)를 만든다. 기존 DB/원장/운영 설정을 복사하거나 이어 쓰지 않는다. 새 SQLite, 계정/방 삭제 원장, unlink outbox를 이 안에서 초기화한다. 이 초기 빈 원장은 **새 DB에만** 맞는 조건이며 운영 복원의 대안이 아니다.

SIGINT/SIGTERM은 서버와 DB 연결만 닫는다. 정상 종료·시작 실패 모두 생성한 저장소를 자동 삭제하지 않는다. 실제 개인 정보가 생길 수 있으므로 파일을 public artifact에 올리지 않고, 정리/삭제는 별도 승인 후 수행한다. runner는 계정 ID·subject·토큰·API 응답·설정값·DB 내용을 로그하지 않는다. 강제 종료 뒤에도 보존된다. 앱 단말 보관 세션은 별도의 테스트 origin namespace를 사용해야 한다.

## 합성 검증

`npm run build -w @trip-court/contracts && npm run build -w @trip-court/api`

`node --test tests/integration/native-real-verification.test.mjs`

테스트의 명시적 fixture hook만 임시 부모/가짜 fetch/임의 loopback 포트를 사용한다. CLI는 이 옵션을 받지 않는다. fixture는 실제 provider에 통신하지 않고 자신이 만든 합성 임시 파일만 정리한다. 실제 Kakao 로그인, 실기기/시뮬레이터 연결, 실제 파일 권한 확인 및 4189 실제 서비스 실행은 아직 수행하지 않았다.
