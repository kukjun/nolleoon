# Native 합성 loopback staging

이 runner는 실제 Kakao 로그인·운영 staging이 아니다. `e53d3ca` 기반 별도 개발 worktree에서 실행한다. 실제 사용자 DB/환경파일/키를 읽거나 복사하지 않는다.

## 실행

Node24 및 저장소 잠금 의존성을 준비한 뒤:

```sh
npm run build -w @trip-court/contracts
npm run build -w @trip-court/api
node tools/mobile/native-loopback-staging.mjs --synthetic-only
```

주소는 **http://127.0.0.1:4188** 고정이다. 이미 사용 중이면 실패하며 다른 서비스 종료/포트 대체를 하지 않는다. 외부 host/origin/DB 경로 옵션이 없고 기존 운영 환경변수도 runner 구성에 사용하지 않는다. 정상 종료(SIGINT/SIGTERM) 시 자신이 생성한 임시 DB·ledger·outbox만 제거한다. SIGKILL/시스템 종료는 임시 파일을 남길 수 있으며 자동 광역 청소를 하지 않는다. 재실행은 항상 새 임시 저장소로 시작한다.

native `POST /api/native/auth/kakao`의 accessToken은 정확히 `synthetic-provider-a`부터 `synthetic-provider-e`까지만 허용한다. 이것은 공개된 합성 fixture이며 실제 provider 인증이 아니다. 실제 Kakao token은 거부한다. 반환되는 native session token은 로그/문서에 저장하지 않는다. 테스트 계정/방 데이터만 만든다. 운영 Admin 키/provider는 주입하지 않고 외부 unlink worker는 비활성이다.

실제 세션 발급/권한/SQLite migration/게임 엔진을 사용한다. provider 검증만 합성이며 앱 OS 인증 성공을 뜻하지 않는다. DB와 account/room 삭제 원장, unlink outbox/checkpoint는 모두 같은 새 임시 폴더에 만든다. presence/settlement 모니터는 실행하지만 영구삭제/외부 unlink 자동작업은 끈다.

Android 에뮬레이터와 연결하려면 앱의 별도 승인된 시험 origin 구성/명시적 포트 전달이 필요하다. 이 runner는 adb reverse, 터널, DNS, 방화벽, cleartext 설정을 변경하지 않는다. 운영 origin을 fallback으로 사용하지 않는다. 시험 앱은 요청 origin을 별도로 검증해야 하며 이 runner 자체가 Flutter의 목적지를 강제하지는 못한다.

## 검증 기록

추가 테스트 첫 실행은 runner module 없음으로 loader1 FAIL(RED)이었다. 구현 뒤 실제 loopback ephemeral port에서 native 합성 로그인/방 생성, 잘못된 provider token 거부, 임의 host/DB/origin/운영 포트 옵션 거부, 소유 임시 저장소 제거를 확인했다(2 PASS). API/contracts build PASS. 실제 Kakao/공개 주소/실기기/운영 DB에 대한 호출은 없다.
