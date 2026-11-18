# #176/#177 native API 교차 계약 준비

## 목표와 경계
기준 backend integration8c02090. 기존 native-bff는 경로/권한/CAS/팀만, 기존 web game tests는 cookie 경로로 개별 게임을 확인했다. 추가 시험은 실제 native opaque 세션과 같은 SQLite 방에서 4게임 → 기록 → 탈퇴 영수증 → 삭제 전 snapshot 복원에 최신 journal 적용을 한 흐름으로 연결한다. Provider verifier만 명시적인 합성 provider ID를 반환하며 실제 Kakao/운영/키는 전혀 사용하지 않는다.

내장 native backend와 Flutter는 다른 commit에 있다. 선택적 도구 `tools/mobile/verify-native-corpus.mjs`는 시험이 생성한 합성 HTTP DTO corpus를 별도로 지정한 실제 Dart wire_models.dart로 디코딩한다. 원본 DTO의 SHA-256과 corpus hash, 성공 개수 및 unknown-field 거부 negative control 수를 출력한다. Flutter 구현 코드를 이 backend worktree로 복사/변경하지 않는다.

## 검증할 것
- 네이티브 토큰은 실제 애플리케이션에서 발급하며 provider token과 다름. 계정/멤버십/역할/방 버전은 실제 HTTP를 통해 생성한다.
- 팀 배정, 자신의 제비 공개만, 메뉴 비공개 후보, 재판 1차 동률/최후 변론/2차 동률 무죄를 실제 서버 엔진으로 통과한다.
- observer 재판 접근 거부, 투표 도중 타인의 이유 미노출, native cookie/web bearer 혼용 거부, 같은 계정의 정상 web/native 방 projection 일치.
- 합성 멤버 탈퇴 영수증을 같은 requestId/bearer로 확인하고 다른 requestId는 거부. 모든 관련 기록에서 자유입력을 지우고 숫자만 남긴다.
- 삭제 전 snapshot에 현재 실제 durable account/room/unlink journals를 적용해 복원. 원래 native 세션 모두 무효, 탈퇴 계정도 복구 불가, 살아있는 web 세션은 유지, 새 native 로그인으로 같은 살아있는 계정/기록 확인.

## 실행(별도 승인된 로컬 시험 창)
새 worktree에서 dependency 준비와 contracts/API build 후:
`NOLLEOON_NATIVE_CORPUS_PATH=/absolute/new-synthetic.json node --test tests/integration/native-integrated-journey.test.mjs`

출력 파일은 wx/0600이며 기존 파일을 덮어쓰지 않는다. 실제 발급 bearer/provider/초대 token은 corpus에 포함하지 않고 검사한다. 일반 suite에서 환경변수가 없으면 corpus를 쓰지 않는다.

별도 고정된 mobile commit의 wire_models.dart를 private temporary path로 materialize한 후:
`node tools/mobile/verify-native-corpus.mjs /absolute/sdk/bin/dart /absolute/pinned-wire_models.dart /absolute/new-synthetic.json`

최초 작성 시에는 준비 상태였고, 아래 좁은 실행 결과를 별도로 기록했다. OS picker, SDK login, OS secure storage, 실제 링크, 실제 기기/스토어, 운영 E2E를 대신하지 않는다. 전체 API/full harness는 별도 gate다.

## 실제 좁은 검증 결과
- Backend source: `8c02090c6c51f8a935b21b83050012d63e61a804`. 제품 소스 수정 없음. `npm ci --ignore-scripts`, 기존 sharp/better-sqlite3 rebuild, contracts/API build 성공.
- 실제 HTTP/Nest/SQLite/durable journal/backup/restore 단일 연속 시험 **1/1 PASS**, 최종 실행 전체 662.8ms(시험 본체518.6ms). provider verifier는 합성이며 unlink worker는 disabled다. 서버 포트는 127.0.0.1 임의 포트이고 tmp 디렉터리는 종료 시 정리했다.
- Mobile DTO source: `7dcaea97b842486a86f25d66ddb220bcebeb40a8`의 `apps/mobile/lib/data/wire_models.dart`. Flutter 3.50.0에 포함된 실제 Dart 실행기로 실행. **HTTP DTO 40개 decode PASS**, run unknown-field negative controls **27개 거부 PASS**.
- DTO source SHA-256: `163f70de11fb99c2980182bc100903e9e42c12b85d73d67810e998cddc96833b`.
- 최종 합성 corpus SHA-256: `5d7f1d68c15a3094edf7c6d12714ab3230f7956ad845ae8cb0f066d3acd6a84d`. corpus 자체는 임시 private0600 파일이며 저장소에 올리지 않는다. 재실행 때 실제 random IDs/timestamps로 hash가 달라지는 것은 정상이다.
- changed-files ESLint 및 diff check PASS. 초기 lint는 사용하지 않은 room GET 할당 한 곳을 보고했고 불필요한 read를 제거 후 API/Dart 검사를 재실행했다. Assertions/timeout/보호 장치는 약화하지 않았다.
- 이 변경은 기존 구현에 대한 회귀 보강으로 TDD 제품 구현 완료를 주장하지 않는다. 전체 API/full harness/Flutter UI 통합/실기기/SDK/스토어는 미실행이다. 성공해도 #176/#177의 물리 플랫폼 완료를 대체하지 않는다.

## 독립 리뷰 후 증거 입력 동결 보강
원래 도구는 외부 source/corpus 경로를 실행 시 재참조하고 source hash를 실행 뒤 읽어, 경로가 동시에 교체되면 검사한 bytes와 기록 hash가 다를 수 있었다. 기존 pinned materialization 실측의 hash는 일치했지만 도구 자체의 증거 정합성 P2로 수정했다.

현재 도구는 두 입력 bytes를 먼저 읽고 private temporary directory의 wx0600 복사본만 Dart에 전달한다. hash도 그 최초 bytes로 계산한다. 기존 DTO는 독립 파일이므로 import/export/part 키워드가 있는 소스는 보수적으로 거부한다(주석/문자열도 포함). 의존성이 생기면 전체 소스 graph를 별도로 동결하는 설계가 필요하며, 외부 상대 경로를 자동 탐색하지 않는다.

도구 회귀는 합성 runner 경계에서 원래 두 파일을 교체해도 private copies와 hash가 처음 bytes를 유지하는지 확인한다. 이전 동작에서 실제 RED 2건 → 변경 후 2/2 PASS, cleanup 및0600 확인. 이 두 단위 시험은 Dart 실행 성공을 흉내 낸 근거로 사용하지 않는다. 별도로 실제 Dart를 기존 합성 corpus에 다시 실행해40 decode/27 negative controls PASS와 이전 source/corpus hash 동일을 확인했다. 제품/API 재실행은 이 도구 수정 범위에 포함하지 않았다.
