# 아키텍처 기준선

[기술 ADR](../decisions/0002-mvp-architecture.md) · [정책](00-current-rules.md)

React/TypeScript 모바일 UI → NestJS 통합 BFF(HTTP controller, 입력 검증, 화면 DTO) → application(use case, transaction boundary, port) → domain(판결·역할·상태 규칙).

Infrastructure(SQLite repository, clock, random, session adapter)는 port를 구현하고 Nest provider/composition root에서 주입한다. domain은 Nest/DB/HTTP를 import하지 않는다. BFF는 판결 규칙을 복제하지 않고 use case 결과를 허용된 화면 DTO로 만든다. 별도 BFF 서버·추가 DB·캐시는 MVP에 없다.

Mac mini 단일 앱 인스턴스와 로컬 SQLite 파일. 프론트 정적 빌드와 /api는 같은 외부 origin으로 제공하는 배포 설계. 기존 Cloudflare Tunnel 방식에 별도 서비스 경로/포트/DB를 매핑한다. 실제 배포 설정은 배포 티켓에서 확인하고 기존 서비스는 건드리지 않는다.

인증 신원·게임별 권한은 서버에서 검사한다. 웹 화면의 버튼 비활성화는 보안 경계가 아니다. 도메인에서 결정한 공개 상태만 BFF에 전달하며 타인의 진행 중 표, 제출자 식별자는 응답에 넣지 않는다.
