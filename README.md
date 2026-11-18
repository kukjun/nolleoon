# 놀러온

친구들과 여행 중 가볍게 즐기는 재판 게임을 만들며 Codex 개발 하네스를 학습하는 프로젝트.

## 현재 상태

서비스 주소는 https://nolleoon.kukjun.com 이다. 사용자에게 보이는 정식 이름은 **놀러온**이며 별도 영문 브랜드/새 로고는 확정하지 않았다.

2026-11-18 인계 기준 실제 운영 릴리스는 `d69867be50696dde8a56c532f07412d01221e73a`다. PR #145의 여행방·계정 개편은 별도 개발/검증 범위이며 도메인 변경이나 이 문서 갱신이 그 기능의 운영 출시를 뜻하지 않는다. 운영 상태를 이 문서 작업에서 새로 조회하지 않았다.

React/TypeScript + NestJS 내부 Web BFF + SQLite, 로컬 서버 + Cloudflare Tunnel을 사용한다. 기존 일회성 방의 재판·팀 나누기·제비뽑기와 새 영속 여행방을 구분한다. 실기기·실제 카카오 로그인·원격 CI·최종 인수는 각 증거를 별도로 확인해야 한다. 기존 `ui/`는 참고 목업이다.

- [브랜드·주소·호환 경계](docs/branding.md)
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
