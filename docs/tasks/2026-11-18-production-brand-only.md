# 운영 기존 기능용 놀러온 브랜드 변경

기준: 실제 운영 커밋 `d69867be50696dde8a56c532f07412d01221e73a`. 개발 여행방 통합 브랜치를 병합하지 않는다.

## 변경 경계
- 앱 코드 변경은 `apps/web/index.html`, `src/design/components.tsx`, `src/design/gallery.tsx`, `src/design/styles.css` 네 파일만.
- 공통 헤더/접근성 이름을 놀러온으로, 기존 tc 마크는 제거. 새 로고·기능 없음.
- 정적 title/description/application-name/OG/Twitter와 일반 랜딩 canonical을 추가. 개인 이름·사진·사건·벌칙·초대 token 없는 일반 설명. 실제 현재 origin 기반 초대 URL/query 생성은 변경 없음.
- `/travel`/Kakao/account/삭제·복구 등 신규 기능 코드 **추가하지 않음**. API/DB/쿠키/세션/헤더/패키지/서비스/운영 설정 변경 없음.
- 기존 launch/rooms 테스트는 브랜드 기대 문자열만 변경, 동작 assertions 유지.

## 검증/아티팩트
- 운영기반 기존 API fixture + 임시 SQLite를 별도 4190에 사용. 실제 사용자·운영 3101/3102를 건드리지 않는다.
- 새 브랜드/launch 테스트 2개 RED 확인 후 2/2 GREEN. 320/390 홈/디자인 미리보기 캡처를 `artifacts/production-brand`에 저장, 헤더 키보드 focus/접근성 이름/가로 overflow 검증.
- `npm run build`, `npm run test:unit` 77/77 PASS.
- 정적 산출물: 이 worktree의 `apps/web/dist/`. 배포 단계에서는 검토된 이 정적 디렉토리만 사용하며 API 산출물은 운영 교체 대상이 아니다.
- 외부 소셜 공유 캐시 및 실제 프로덕션 변경은 이 작업에서 수행하지 않는다. 독립 리뷰·운영 전환은 코디네이터가 별도로 수행한다.
- 기존 API integration 116/116, database 56/56 PASS. 전체 workspace typecheck와 변경파일 lint PASS.
- 기준 대비 apps/api/packages/package manifests/lock/tools diff 없음 확인. travel-app 및 travel account client 파일 없음 확인.
- 별도 4190 브라우저 광범위 회귀 95/95 PASS(7.7분): legacy UI, party, gameplay E2E, mobile 접근성 포함. 포트4179가 하드코딩된 rooms/session 파일은 이 95개 실행에서 제외했다. 제외 사실을 전체회귀 통과로 숨기지 않는다.
- 변경된 rooms 홈 링크는 `지연된 방 응답 도중 홈으로 이동하면 이전 대기실이 나타나지 않는다` 케이스만 4190에서 추가 실행하여 1/1 PASS를 확인했다.
