# 보안·권한·경합 회귀 (#25)

## 실제 수정과 회귀

종료 후 새 입장자의 일반 RoomSnapshot에서 과거 사건/벌칙을 가리더라도 이전 피고 역할·수락 revision·시작 조건이 남아 있었고 rosterEditable도 실제 서버 준비 조건과 달랐다. 실제 RED(rosterEditable=true, 기대false) 후 준비 단계에만 편집 가능 상태를 제공하고, 이전 게임 비참가자와 private 중단에는 과거 수락/초안 revision·피고 역할·시작 조건을 감춘다. 현재 방장 여부/닉네임/연결 상태는 현재 방 정보로 유지한다. 새 준비에서는 실제 새 준비 세대의 권한과 버전을 제공한다.

두 history decoder는 outer 요청 게임 ID와 nested game ID가 다르거나 완료/중단/진행 조합이 모순된 응답을 거절한다. 서로 다른 ID를 승인하던 실제 RED 두 곳을 공유 terminal detail helper로 수정했다. 직접 API 역할/actor 필드 사칭, cross-room, CSRF, 타입 coercion, 과대 본문과 반복 중복 투표 경합도 묶어 검사한다.

실제 저장된 합성 사건·벌칙·변론·이유의 HTML 문자열은 React 텍스트로 표시하고 script/onerror/onload가 실행되지 않는 브라우저 회귀를 추가했다. CSP나 배포 헤더 설정을 변경했다는 뜻은 아니다.

## 애플리케이션 요청 예산

단일 Nest 프로세스에서 60초 고정 창을 사용한다.

| 구분 | 같은 창의 상한 |
|---|---:|
| 유효 세션의 GET 조회 | 600회 |
| 유효 세션의 쓰기 명령 | 180회 |
| 그 세션의 방 만들기/참여 | 추가 30회 |
| 신원 미확인 요청 | socket IP별 read/write 각각 120회 |

3초 polling과 여러 탭은 읽기/쓰기 예산 안에서 동작하고 같은 IP의 다른 유효 세션은 분리된다. 위조·무작위 cookie는 새 세션 key로 쓰지 않고 익명 bucket에 묶는다. X-Forwarded-For를 신뢰하지 않으며 proxy/security 설정은 바꾸지 않는다. 익명 사용자가 reverse proxy 뒤에서 같은 socket IP로 보이면 예산을 공유할 수 있으므로 배포 환경에서 정상 그룹 크기와 함께 재검토해야 한다.

TTL이 지난 window는 제거하고 key는 최대 2,048개와 공유 overflow bucket 하나로 제한한다. 상한 초과는 안전한 RATE_LIMITED 429와 Retry-After 초 단위를 반환한다. 원문 cookie/IP/사용자 내용을 로그로 출력하지 않는다. 재시작 시 메모리 예산은 초기화되고 여러 프로세스 사이에 공유되지 않는다. 고정 창 경계에서 순간 요청이 몰릴 수 있다. 이는 실수/반복 요청을 줄이는 기본 앱 보호이지 분산 DDoS 방어, 방화벽 또는 CDN 제한 완료가 아니다.

## 본문·데이터 한계

애플리케이션 guard는 파싱된 JSON을 다시 직렬화한 UTF-8 크기가 65,536 bytes보다 크면413을 반환한다. 현재 설치된 Express 5.3.0/body-parser와 Nest adapter의 기본 JSON parser는 그보다 앞에서100KiB를 제한한다(설치 소스 확인 및110KB HTTP 시험). 따라서 원본 whitespace/전송 표현과 정규화 크기는 다를 수 있고 파싱 전 전송량을64KiB로 제한했다고 주장하지 않는다. 기존 사건/벌칙/변론/이유별 글자 수와 제어문자 검사는 별도로 유지한다. 기본 parser 상한은 [Express 5 공식 JSON parser 문서](https://expressjs.com/en/5x/api/express/#expressjson)와 설치 소스를 함께 확인했다. 요청 제한과 본문 제한이 깊은 JSON/네트워크 자원 공격 전체를 해결하지 않는다.

## 결함 검출 증거

[격리 결함 주입](security-mutations.md)은 컴파일 산출물을 소유 임시 폴더에 복사하고 합성 DB만 변이한다. 피고 허용·표 유일 키 제거·남의 비공개 이유 직렬화·기록 권한 검사 생략 각각에서 정상 대조군을 통과시키고 정확한 보안 assertion 실패로 mutant를 검출한다. import 오류 같은 무관한 실패는 성공으로 치지 않는다. 도구도 정적 lint 범위에 포함하고 unit 자동 발견으로 지속 실행한다.

실제 운영 DB·배포·네트워크/보안 설정·토큰 권한을 바꾸지 않았다. fixture는 합성 값만 사용한다. remote CI #36과 중단 공개 정책 #33은 이 회귀로 해결됐다고 주장하지 않는다.

경로 대소문자/끝 slash가 Express에서는 같은 명령인데 세부 방 참여 budget에서는 다른 요청처럼 분류되던 추가 RED(false, 기대 제한true)를 재현했다. rate 분류용 path를 소문자·끝 slash 제거로 정규화하고 같은 방 참여 상한을 적용했다. 실제 명령 라우팅/권한을 우회하거나 URL의 게임 식별자를 변경한 것은 아니다.
