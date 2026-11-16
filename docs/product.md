# Trip Court

친구들이 방 링크로 모여 사건·벌칙을 정하고 피고 변론과 익명 투표로 판결하는 모바일 웹 게임이다. 한 방에서 여러 게임을 순서대로 진행한다.

제품 정책 원본: [현재 규칙](design/00-current-rules.md). 설계 지도: [설계](design/README.md). 기술 선택: [ADR](decisions/0002-mvp-architecture.md). 구현 순서: [MVP 이슈 초안](mvp/issue-drafts.md).

React/TypeScript + NestJS 통합 BFF + SQLite, Mac mini와 Cloudflare Tunnel 기반 외부 접속을 목표로 한다. 개발 기반·SQLite·브라우저 세션의 일부 시험은 수행했지만 전체 게임 인수·배포는 아직 미완료다. 초기 목업과 하네스 통과를 실제 다인 앱 완료로 보지 않는다.

사용자가 승인한 최신 규칙은 현재 문서에서만 관리한다. 과거 차수별 의사결정은 [이력](design/history/pre-mvp-01/README-history.md)에 보존했다. 미정인 피고 퇴장 중단 기록 공개는 [#33](https://github.com/kukjun/trip-court/issues/33)에서 확정한다.
