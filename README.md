# Trip Court

친구들과 여행 중 가볍게 즐기는 재판 게임을 만들며 Codex 개발 하네스를 학습하는 프로젝트.

## 현재 상태

MVP 요구사항과 실행 이슈를 기준으로 게임 기능과 자동 회귀를 구현했다. 실기기·외부 운영·최종 인수는 아직 완료하지 않았다.
선택한 기술은 React/TypeScript + NestJS 내부 Web BFF + SQLite, 로컬 서버 + Cloudflare Tunnel이다.
실제 앱은 방·역할·벌칙 수락·동시 투표·재투표·기록을 제공하며, 합성 데이터의 독립 브라우저 다인 E2E를 검증한다. 기존 `ui/`는 참고 목업이다. 자동 시험 통과를 운영 배포나 MVP 최종 인수로 해석하지 않는다.

- [인수 상태·증거 기준](docs/acceptance.md)
- [사용 안내](docs/user-guide.md)
- [최신 제품 규칙](docs/design/00-current-rules.md)
- [MVP 범위·완료 기준](docs/mvp/scope-and-done.md)
- [실행 이슈 매핑](docs/mvp/github-issues.md)
- [GitHub 진행 상태](https://github.com/kukjun/trip-court/issues)

## 방향

- 작은 모바일 웹 게임을 목표로 한다.
- Codex가 맥락을 읽고, 구현하고, 실행 결과를 검증할 수 있는 개발 환경을 만든다.
- 검증 장치에도 결함을 주입해 실제로 오류를 잡는지 확인한다.
- 실제 갈등 해결이나 법률 판단을 위한 서비스가 아니다.

## 문서

- [제품 초안](docs/product.md)
- [하네스 학습 초안](docs/harness.md)
- [결정 기록](docs/decisions/README.md)
- [Codex 작업 안내](AGENTS.md)

## 공개 범위

공개 저장소다. 예시는 가상의 데이터만 사용한다. 인증정보, 실제 참가자 정보,
개인 대화·사진, 회사 코드·문서·내부 정보는 포함하지 않는다.

라이선스는 아직 선택하지 않았다. 공개 열람과 별개로 포괄적인 재사용 허가는 부여하지 않는다.

## 로컬 개발

React/Nest/SQLite 설치·빌드·실행은 [로컬 개발 안내](docs/local-development.md)를 따른다. 전체 자동 검사와 실제 인수의 차이는 [인수 안내](docs/acceptance.md)를 확인한다.
