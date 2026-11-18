# 놀러온

친구들이 방 링크로 모여 사건·벌칙을 정하고 피고 변론과 익명 투표로 판결하는 모바일 웹 게임이다. 한 방에서 여러 게임을 순서대로 진행한다.

제품 정책 원본: [현재 규칙](design/00-current-rules.md). 설계 지도: [설계](design/README.md). 기술 선택: [ADR](decisions/0002-mvp-architecture.md). 구현 순서: [MVP 이슈 초안](mvp/issue-drafts.md).

현재 주소는 https://nolleoon.kukjun.com 이다. React/TypeScript + NestJS 통합 BFF + SQLite, Mac mini와 Cloudflare Tunnel을 사용한다. 기존 운영 릴리스와 PR #145의 여행방 개편 검증은 별개이며 [현재 브랜드·운영 기준](branding.md)을 따른다. 초기 목업과 하네스 통과를 운영 출시·최종 인수로 보지 않는다.

사용자가 승인한 최신 규칙은 현재 문서에서만 관리한다. 과거 차수별 의사결정은 [이력](design/history/pre-mvp-01/README-history.md)에 보존했다. 미정인 피고 퇴장 중단 기록 공개는 [#33](https://github.com/kukjun/trip-court/issues/33)에서 확정한다.

## 영속 여행방 개편 (진행 중)

새 계정·여행방 범위와 과거 일회성 규칙의 구분은 [여행방 현재 규칙](design/travel-current-rules.md)을 본다. 구현/검증 상태는 [#117](https://github.com/kukjun/trip-court/issues/117)에서 추적하며 이 링크 추가는 새 기능 출시 완료를 뜻하지 않는다.
