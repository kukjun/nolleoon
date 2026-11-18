# 놀러온 사용자 화면·메타데이터 (#147, #148)

상태: 구현 및 로컬 검증, 독립 리뷰 대기

## 변경/유지 경계
| 대상 | 처리 |
| --- | --- |
| design/components.tsx Layout 헤더 h1/홈 aria-label | 놀러온 / 놀러온 홈. 기존 tc 마크 제거, 별도 새 로고 없음 |
| travel-app.tsx 여행방 헤더 | 놀러온 여행방, 링크 접근성 이름 놀러온 여행방 홈 |
| design/gallery.tsx 설명 | 놀러온 공통 화면 재료 |
| index.html title/application-name/description/OG/Twitter | 일반 서비스 소개만, ko_KR, 놀러온 |
| canonical 및 og:url | https://nolleoon.kukjun.com/ 일반 랜딩 식별자. 실제 URL/초대 token/history/navigation은 변경하지 않음 |
| 사건·재판·피고·원고 등 규칙 | 유지 |
| API/CSRF header/cookies/DB/workspace package/internal paths | 변경 없음. 저장된 세션·방·기록 재생성 없음 |
| manifest/PWA/favicon/OG 이미지 | 기존 없는 자산/기능 새로 추가하지 않음 |

모든 index 메타는 정적인 서비스 설명이다. 이름·사진·초대 token·사건·벌칙 등을 삽입하지 않는다. 일반 canonical은 공유 크롤러의 랜딩 표현에만 쓰며 초대 링크 생성은 기존 current origin을 유지한다. 기존 result-view는 location.href 기반 room query, travel-rooms는 window.location.origin 기반 invitation path다. 다른 링크 생성/복사 구현도 변경하지 않았다. Web source에서 localStorage/sessionStorage/IndexedDB/Cache API 사용은 발견되지 않았고 새 저장소를 만들지 않았다.

## 검증
- 테스트 2개 RED(이름/메타) 확인 후 변경.
- 실제 Nest + production staticWeb + 임시 SQLite/synthetic provider를 isolated 4190에 띄워 launch/브랜드/메타 3/3 PASS. 320/390의 /, /?view=design, /travel 헤더·접근성 이름·키보드 focus·가로 overflow 확인 및 artifacts/rebrand에 캡처.
- 기존 launch/rooms.spec은 기대 브랜드 문자열만 교체했고 동작 assertions 유지. rooms 전체 회귀는 통합 단계에서 실행할 항목.
- npm run build, web typecheck, scoped ESLint PASS.
- 처음 old apiFixture static server로 /travel 검사하여 404가 났으나 그 fixture가 travel SPA를 지원하지 않는 테스트 구성 문제였다. production staticWeb 기반 fixture로 바꾼 후 검증했다.
- 실제 외부 소셜 서비스 공유 미리보기/캐시 갱신과 운영 origin에서의 링크 생성은 여기서 확인하지 않았다. 저장된 동적 URL을 운영 origin으로 강제하지 않았다.
- 배포·네트워크·repo rename은 이 변경에 포함되지 않는다.
