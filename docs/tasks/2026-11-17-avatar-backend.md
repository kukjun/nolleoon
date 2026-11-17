# Avatar backend · #82 / #83

상태: 진행

## 목표와 범위
브라우저 신원에 연결된 10종 기본 아바타와 사용자 사진. 기존 RoomSnapshot 계약을 변경하지 않는 전용 API. 현재 프로필을 방·게임·결과에서 일관되게 보여주며 과거 사진의 불변 기록은 만들지 않는다. 운영 데이터·배포·게임 규칙 변경 제외.

## 미결정과 가정
기본값 preset-01. 세션 쿠키 소실 시 닉네임으로 복원하지 않는다. 사진은 JPEG/PNG/WebP 입력 1 MiB, 4 MP 한도, 서버에서 256px 정사각 WebP로 재인코딩하고 64 KiB 이하만 저장. 원본/메타데이터는 저장하지 않는다. 현재 프로필 하나만 유지한다.

## 합격 기준
- 10종 저장·재조회, 버전 충돌 감지, 이전 BFF 계약 유지.
- 비회원·타인 신원 접근 거절, 사진을 공개 정적 자산으로 배포하지 않음.
- 잘못된 유형·과대 입력·위장 확장자·초과 화소 거절. 실패 시 기존 프로필 보존.
- 이전 마이그레이션 체크섬 보존, 빈 DB와 v9 DB 업그레이드 검증.

## 실행과 증거
프로필 HTTP 시험 2개 구현 전 실패(404) 확인. 후속 실제 실행 결과는 별도 기록.

### #82 프로필 검사
- 구현 전 HTTP 2개: 실패(404), 기능 미구현 상태 확인.
- 프로필 HTTP 2 + 단위 1 + v9→11/재시작/rollback DB 1: 4/4 통과.
- 전체 build, lint, 계층 검사 통과. 단위 59/59, API 98/98, DB 48/48 통과.
- 처음 전체 API 실행은 web/dist 미빌드로 production 시험 실패. 전체 build 후 동일 API 전체 재실행 통과. 미빌드 결과를 숨기지 않는다.
- 브라우저/실기기/운영 마이그레이션은 이 백엔드 단위에서 미실행.
- PARTY-03/04의 실제 마이그레이션 10 의존 커밋을 합친 뒤 전체 build, DB 51/51 및 프로필 HTTP 2/2 재검증 통과. 1..9 체크섬 보존 시험 포함.

### #83 사용자 사진 업로드
- 실패 우선: 이미지 HTTP 2개는 404, raster encoder 단위는 구현 모듈 없음으로 실패 확인 후 구현.
- 전용 raw PUT 경로만 1 MiB 허용. 기존 JSON 요청 제한은 높이지 않음. Origin/custom-header/세션 검증 후 본문 읽기.
- 세션당 사진 변경 6회/분, 전체 동시 읽기 16개, 디코딩 2개 제한. 읽기 및 디코딩 5초 제한. 세션당 현재 사진 1장, 전체 썸네일 64 MiB 저장 상한.
- PNG/JPEG/WebP 실제 magic 및 디코더 유형 일치, 4 MP 한도, 다중 프레임 거절. EXIF 방향 반영 후 중앙 정사각 crop; metadata 없는 WebP 256×256 저장. SQL 64 KiB 제약. preset으로 교체하면 사진 BLOB 제거.
- GET 사진은 세션 본인 또는 해당 방의 현재 멤버만 허용. no-store/nosniff/CSP 적용. 외부 URL·사용자 파일명·SVG·GIF를 받지 않음.
- 목록 응답은 사진 BLOB을 로드하지 않는 요약 조회. 출력 DTO에 sessionId를 포함하지 않음.
- [Sharp 공식 입력/limitInputPixels](https://sharp.pixelplumbing.com/api-constructor/), [출력 metadata 기본값](https://sharp.pixelplumbing.com/api-output/)을 확인하고 실제 EXIF/ICC 제거·방향·재인코딩 시험으로 검증.
- targeted avatar 9/9, 전체 build/typecheck 및 단위 61/61, API 101/101, DB 51/51 통과. lint 최초 신규 테스트의 ReadableStream 전역 선언 오류를 node:stream/web 명시 import로 수정 후 통과. 계층 검사 통과.
- 애니메이션 음성 시험의 최초 fixture는 두 프레임이 같은 색이라 encoder가 한 장으로 최적화했음. 서로 다른 픽셀의 2-frame WebP fixture로 수정하고 실제 pages>1 확인 후 거절 검증 통과.
- PARTY-04의 배포 전 migration10 NULL 제약 수정 의존 커밋 반영 후 DB 51/51 재검증. 운영 DB에는 어떤 마이그레이션도 실행하지 않음.

## API
- GET /api/avatar, PUT /api/avatar JSON {presetId,expectedRevision}
- PUT /api/avatar/image: raw image/jpeg|image/png|image/webp, X-Avatar-Revision 헤더. 기존 Origin 및 X-Trip-Court-Request: 1 필요.
- GET /api/avatar/image?v=N: 자기 사진. GET /api/rooms/:code/avatars: {members:[{memberId,avatar}]}.
- GET /api/rooms/:code/avatars/:memberId/image?v=N: 방 권한 검증 사진.
- avatar: {kind:'preset'|'image',presetId:string|null,revision:number,imageUrl:string|null}. 이미지는 현재 프로필의 인증된 상대 URL. 과거 결과의 사진을 고정하지 않는다.

## 운영 경계
이미지 저장 상한에 도달하면 신규 사진을 일시 거절하며 기존 사진·프리셋 선택은 보존한다. 기존 세션/프로필 삭제 정책은 추가하지 않았다. 업로드 원본은 메모리 처리 후 보관하지 않지만 SQLite의 이전 페이지·운영 백업에서 과거 썸네일이 즉시 물리적으로 사라진다고 보장하지 않는다. 실기기·브라우저 시각 검증 및 운영 배포는 상위 통합 단계에서 별도로 확인한다.
