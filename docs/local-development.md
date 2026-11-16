# 로컬 개발 기반 · MVP-02

이 단계는 React 화면 뼈대와 Nest 통합 BFF의 HTTP 헬스만 제공한다. 방/게임 기능은 구현하지 않았다. 브라우저 세션 발급·복구는 [세션 설계](browser-sessions.md)를 따른다. SQLite 저장소 기반은 [별도 문서](sqlite-storage.md)를 따른다. 기존 `ui/`는 참고 목업으로 보존하며 실제 앱과 혼동하지 않는다.

## 환경과 설치

Node 24.x, npm 11.x를 사용한다. 검증 환경은 Node 24.14.1 / npm 11.11.0이다. 저장소 루트에서 실행한다.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm rebuild better-sqlite3
npm run test:workspace
npm run check:layers
npm run build
npm run smoke:workspace
```

lockfile로 고정한 workspace 의존성만 설치한다. MVP-04부터는 선택한 better-sqlite3 네이티브 의존성만 명시적으로 rebuild한다. 이 단계의 명령은 기존 미추적 하네스에 의존하지 않는다. `check`/`test:harness`는 MVP-03에서 [검증 하네스](harness.md)로 연결했다. 전체 check에는 별도 Chromium 설치가 필요하다.

## 직접 기동

터미널 1:

```sh
mkdir -p data
API_PORT=3001 DB_PATH="$PWD/data/trip-court.sqlite" PUBLIC_ORIGIN=http://127.0.0.1:5173 npm run start:api
```

터미널 2:

```sh
npm run dev:web
```

API는 `http://127.0.0.1:3001/api/health`, 개발 UI는 Vite가 출력한 loopback 주소(기본 포트 5173)로 접속한다. 포트 점유 시 strictPort 실패이며 자동으로 다른 포트로 변경하지 않는다. 필요하면 `npm run dev -w @trip-court/web -- --port 5174`처럼 다른 로컬 포트를 지정한다. 각 터미널의 Ctrl+C로 종료한다. 현재 UI는 세션 발급/복구와 저장소 유실 안내를 제공한다. 게임 기능은 없다. Vite는 /api를 로컬 3001 API에 프록시한다. API 포트를 바꾸면 두 터미널의 API_PORT를 동일하게 지정하고, web 포트를 바꾸면 PUBLIC_ORIGIN도 맞춰야 한다.

`.env.example`에는 비밀 없는 값만 있다. 앱은 `.env`를 자동으로 읽지 않는다. 위처럼 환경변수를 지정하거나 예시를 복사해 실제 전용 DB_PATH를 넣은 뒤 `node --env-file=.env apps/api/dist/main.js`로 실행한다. DB_PATH 부모 디렉터리는 미리 만든다. API_PORT 누락/빈값/범위 밖/소수는 시작 전에 오류로 종료한다. API_HOST는 생략 또는 `127.0.0.1`만 가능하다. PUBLIC_ORIGIN은 브라우저가 접근하는 정확한 origin이고 외부 요청의 Host 헤더로 추정하지 않는다. HTTPS 또는 loopback HTTP만 허용한다. 이 로컬 단계에서는 외부 바인딩·Tunnel·배포를 수행하지 않는다.

## 구조와 검사

- `apps/web`: React + TypeScript, Vite 정적 빌드.
- `apps/api/src/presentation`: Nest controller가 화면 DTO를 구성하는 통합 BFF.
- `apps/api/src/application`: use case. `domain`에 의존 가능.
- `apps/api/src/domain`: 프레임워크 독립 타입/규칙.
- `apps/api/src/composition`: Nest module/provider 조립. 생성 책임을 domain에 넣지 않는다.
- `packages/contracts`: 외부 라이브러리 없는 공유 HTTP 타입, API가 사용. domain이 HTTP DTO에 의존하지 않는다.

계층 검사는 TypeScript AST로 정적 import/export, import(), 타입 위치의 import(), require(), import-equals를 확인한다. domain/application의 삼중 슬래시 참조는 우회 의존성을 막기 위해 금지한다. domain은 domain 내부, application은 domain/application 내부만 의존한다. 동적 문자열 의존성도 거절한다. 파일 누락은 검사 실패다. 이 검사는 악의적 JS 실행을 막는 샌드박스가 아니며 별칭·새 로더를 추가할 때 검사를 확장한다.

## 검증 범위와 버전 결정

`smoke:workspace`는 먼저 빌드 산출물이 없으면 실패한다. 잘못된 환경으로 API가 실패하는지, 정상 API의 JSON, Vite 개발 HTML/진입점과 실제 /api 프록시를 통한 세션 발급·조회을 임시 loopback 포트에서 검사하고 자신이 띄운 프로세스를 종료한다. 실제 브라우저 렌더·다인 E2E·실기기·외부 접속을 검증하지 않는다.

공식 npm registry 확인 후 React/react-dom 19.3.1, Nest 12.5.0, Vite 8.3.8을 고정했다. TypeScript 최신 7.0.2는 기존 compiler AST API를 제공하지 않아 구조 검사에서 실패했고, 검증한 안정 API가 있는 5.9.3으로 선택했다. Node 타입은 런타임에 맞춘 24.19.2다. 정확한 전이 의존성은 package-lock.json을 따른다.

제품 테스트 전체 합격을 뜻하지 않는다. 초기 환경/구조 계약 5개와 빌드/HTTP smoke만 이 단계의 인수 증거다.

## 운영 빌드의 로컬 smoke

`WEB_ROOT`를 검증된 `apps/web/dist`의 절대 경로로 지정하면 같은 loopback Nest에서 정적 React와 `/api`를 제공한다. 파일 경로 제한과 운영 적용 전 조건은 [배포 준비](deployment-preparation.md)를 따른다. `WEB_ROOT` 생략은 기존 API-only 개발 흐름을 유지한다. 이 기능은 DNS·터널·지속 실행 등록을 자동으로 변경하지 않는다.
