# Trip Court

친구들과 여행 중 가볍게 즐기는 재판 게임을 만들며 Codex 개발 하네스를 학습하는 프로젝트.

## 현재 상태

MVP 요구사항과 실행 이슈 32개를 승인하고 순차 구현 중이다.
선택한 기술은 React/TypeScript + NestJS 내부 Web BFF + SQLite, 로컬 서버 + Cloudflare Tunnel이다.
현재 저장소 문서·기존 UI 시연은 완성된 다중 사용자 제품이나 운영 배포가 아니다.

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
