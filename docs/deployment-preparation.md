# 운영 배포 준비: 아직 외부 서비스 배포 아님

## 상태와 승인 경계

MVP-29의 독립적으로 가능한 저장소 준비와 합성 로컬 production smoke만 수행한다. 실제 운영 변경 승인과 적용은 #65에서 추적한다. 실제 DNS·터널 route·계정 권한·LaunchAgent·네트워크/보안 설정은 변경하지 않았고 기존 서비스를 중지하지 않았다. #28의 실제 기기 인수도 blocked다. 이 문서나 템플릿의 존재가 외부 접속 또는 운영 배포 성공의 증거는 아니다. #29와 외부 확인 #30은 실제 조건 충족 전 OPEN이다.

읽기 전용 확인으로 기존 서비스가 쓰도록 설정된 loopback 포트와 사용자 서비스 등록의 존재만 확인했다. 새 앱은 별도 포트 **127.0.0.1:3101**을 제안한다. 확인 당시 이 포트는 listen하지 않았지만 실제 적용 직전에 충돌 여부를 다시 확인해야 한다. 기존 서비스의 현재 외부 장애 원인이나 과거 오류를 이 검사로 추정하지 않는다. 기존 route·프로세스·DB를 재사용하거나 덮어쓰지 않는다.

외부 hostname은 별도 결정/승인 대상이다. 공개 템플릿의 `tripcourt.example.com`은 실행할 실제 도메인이 아니다. 실제 hostname·기존 터널에 추가할 단일 route·포트·프로세스/DB/로그 위치·자동 시작 조건을 묶어 구체적으로 확인한 뒤에만 적용한다. 터널 ID/토큰/credential 경로·실제 사용자 경로는 저장소에 넣지 않는다.

## 로컬 production 구성

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm rebuild better-sqlite3
npm run build
# 아래는 위치를 바꿔야 하는 예시이며 운영 실행을 자동 수행하지 않는다.
API_HOST=127.0.0.1 API_PORT=3101 \
PUBLIC_ORIGIN=https://tripcourt.example.com \
DB_PATH=/absolute/private/data/trip-court.sqlite \
WEB_ROOT=/absolute/private/releases/current/apps/web/dist \
node apps/api/dist/main.js
```

React production build와 `/api`가 같은 Nest origin에서 제공된다. 기존 Vite 개발 서버는 운영 앞단이 아니다. PUBLIC_ORIGIN은 실제 최종 HTTPS origin과 정확히 같아야 한다. Cookie Secure/HttpOnly/SameSite와 Origin 검사 정책을 유지하며 임의 CORS·proxy trust를 추가하지 않는다. 외부 HTTPS termination을 위한 터널/도메인 설정은 위 명령이 대신하지 않는다.

WEB_ROOT를 생략하면 기존 API-only 실행이다. 지정한 경우 유효한 production build 디렉터리만 허용하며 DB는 그 외부에 있어야 한다. 소스·환경 파일·백업·로그를 정적 root에 넣지 않는다. `/api`의 unknown/error는 JSON 오류이고 index.html 200으로 감추지 않는다. 앱은 query 기반 경로를 쓰므로 임의 pathname에 SPA fallback을 제공하지 않는다.

[템플릿](../deploy/templates/)은 리뷰용이며 자동 설치 스크립트가 없다. 기존 서비스에 해당 조각을 통째로 덮어쓰지 않는다. 실제 runtime·현재 release·DB·로그 경로는 운영자가 정하고 검증한다.

## 시작·헬스·로그

1. 승인된 전용 DB/로그 디렉터리 존재와 디스크 여유, SSD 마운트 상태를 확인한다. 디렉터리 생성이나 권한 변경을 이 문서가 자동 수행하지 않는다.
2. 승인된 포트 충돌 여부, build 산출물과 고정한 의존성, backup 검증 이력을 확인한다.
3. 실제 승인 후에만 전용 프로세스를 시작한다. `/api/health` 응답과 `/` HTML/정적 asset을 각각 확인한다. health만 성공했다고 게임·외부 접속이 성공한 것은 아니다.
4. 환경 검증/DB 접근/포트 충돌 시작 실패는 nonzero exit와 정규화된 안내로 확인한다. 비밀값이나 DB 내용, cookie, 원시 SQL을 로그에 출력하지 않는다.
5. 운영 로그의 크기 제한·rotation·보관 기간은 아직 실제 설정하지 않았다. 무한 보관이나 자동 로그 회전을 약속하지 않는다.

## 재시작 조건

사용자 LaunchAgent는 로그인 이후 동작하는 방식이다. FileVault 잠금 해제 전, 로그아웃 상태, 외장 SSD 미마운트, 절전/네트워크 단절 중에도 서비스가 항상 가능하다고 보장하지 않는다. 이번 작업은 FileVault·절전·자동 로그인·KeepAlive 설정을 변경하지 않았다. 실제 도입 시 로그인/재부팅/SSD/잠금 조건과 장애 복구 책임을 확인한다. 템플릿은 자동 시작을 켜지 않은 검토용이다.

## 백업과 복구/롤백

[온라인 백업](sqlite-backup.md)을 먼저 검증한다. 실행 중 DB 본체만 복사하거나 WAL을 삭제하지 않는다. 복원은 새 파일로만 하며 운영 DB를 덮어쓰는 옵션은 없다. 백업 시점 이후 데이터는 이전 snapshot을 선택하면 사라질 수 있으므로 전환 전에 손실 범위를 확인한다.

운영 롤백은 앱 release와 DB schema의 조합을 함께 판단한다. 이전 앱이 새 migration을 모르면 실행을 거부할 수 있다. 임의 down migration이나 오래된 binary로 무조건 되돌리는 절차는 지원하지 않는다. 승인된 복구 계획은 별도 새 DB 복원 → 호환 build로 검증 → 승인된 전용 프로세스만 정지 → 새 경로로 시작 → health/본인 이력/외부 접속 확인 순서다. 실제 서비스 경로 전환·release 롤백은 이번 합성 로컬 시험과 별개이며 미실행이다.

## 실제 외부 인수의 남은 항목

- 실제 도메인과 DNS/터널 route 변경 diff 승인·적용
- 전용 지속 프로세스와 재부팅/로그인·SSD 운영 조건 확인
- 물리 기기 접근 #63 및 #28의 체크리스트
- 외부 네트워크의 HTTPS·cookie·초대 링크·다인 게임 #30
- 원격 CI 권한 #36, 최종 독립 리뷰·인수

localhost smoke나 합성 재시작 결과로 위 항목을 체크하지 않는다.

## 이번 실행 증거

실제 `apps/api/dist/main.js` 자식 프로세스의 `/`가 404인 RED를 확인하고 production 정적 제공을 연결했다. 실제 HTML/해시 asset/API/쿠키·Origin, 소유 프로세스 정지·동일 DB 재시작, 온라인 백업→새 경로 복원→동일 빌드 재기동의 신원·방 복구를 확인한다. 잘못된 환경·정적 root와 DB 겹침·symlink·소스/로그/백업 혼입·누락 build·점유 포트는 종료 코드 1과 고정 메시지로 실패한다. fixture는 임시 디렉터리와 소유 프로세스만 쓰며 기존 서비스에 신호를 보내지 않는다. 템플릿 4개 계약은 파일 부재 RED 후 통과했다. 과거 release 바이너리/이전 schema 롤백은 미실행이다. 최종 개수와 소스 상태는 clean source 보고서를 따른다.
