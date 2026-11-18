# Flutter 초대 라우팅 · #164 부분 구현

`InviteLink`는 기존 HTTPS 초대 경로와 20–128자 base64url 토큰만 받아들인다. 다른 호스트/포트, HTTP, userinfo, query/fragment, percent-encoded 대체 경로를 거절한다. 이는 라우팅 검증이지 서버 권한 검증이 아니다. 실제 preview/join의 만료·폐기·현재 멤버십 검증은 서버가 한다.

`PendingInvitation`은 메모리의 초대 의도를 보관한다. 로그인 취소/재시도에서는 유지하고 명시적 취소 또는 해당 의도의 성공에서만 지운다. 늦은 이전 작업 결과가 최신 초대를 지울 수 없다. 진단 문자열에는 토큰을 포함하지 않는다. 계정 변경 시 초대 보유 자체가 참가 승인을 뜻하지 않는다.

검증: 모듈 부재로 4개 시험 RED(컴파일 실패), 구현 후 같은 4개 GREEN. canonical URL, 악성/변형 URL, 취소·새 초대·늦은 완료·명시적 초기화, 문자열 비노출 확인. 실제 OS Universal/App Links association이나 Flutter router/인증/입장 UI 통합은 아직 없다.

출시 게이트: 승인된 bundle/package와 release 서명 기준 AASA/assetlinks를 설정하고 cold/warm start 실제 링크탭 시험. 기존 웹 fallback 유지. Kakao SDK callback handler와 Flutter default deep-link handler 또는 app_links 중복 설치를 피한다. 운영 association/DNS/키 설정은 이번 변경에 포함하지 않는다.
