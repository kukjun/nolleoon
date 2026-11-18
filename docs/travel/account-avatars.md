# 계정 사진 · #124 구현 선택과 보안 경계

## 사용자 동작과 분리

카카오 사진을 가져오지 않는다. 기존 anonymous profile 사진도 자동 연결하거나 삭제하지 않는다. 사용자가 계정 프로필에서 **직접 선택·업로드**한 사진만 account namespace에 저장한다. schema14 `account_avatars`는 accounts FK 및 별도 revision/bytes를 사용한다. 기존 `avatar_profiles`는 그대로다. 계정 탈퇴·공동기록·장기 보관 결정(#138/#140/#116)은 여기서 처리하지 않는다.

GET/PUT `/api/account/avatar`, PUT/GET `/api/account/avatar/image`를 제공한다. 기본 아바타 PUT은 `{expectedRevision,presetId}`, 사진 PUT은 raw raster body와 `X-Avatar-Revision`이다. 응답은 기존 Avatar DTO와 같은 `{kind,presetId,revision,imageUrl}`이며 URL은 인증이 필요한 앱 상대 경로다. 외부 URL이나 파일명을 저장하지 않는다. session/profile account DTO에는 현재 `avatar`를 추가한다. avatar revision과 profile revision은 별개이며 사진/기본 아바타 교체 시 profile revision도 증가한다.

프로필 이름 수정과 현재 presetId 유지 요청은 사진을 보존한다. presetId를 다른 값으로 바꾸면 명시적 preset 교체로 사진을 비운다. 같은 preset으로 사진을 대체하려면 avatar PUT을 사용한다. UI는 avatar 저장 후 최신 account session/profile을 재조회하여 이름 편집 CAS를 갱신해야 한다.

## 기존 처리기 재사용

기존 Sharp 처리기를 한 AppModule 안에서 legacy/account 양쪽이 공유한다. 합계 동시 decoder 2개, 원본 1MiB/4MP 이하, JPEG/PNG/WebP 실제 magic와 MIME 일치, 단일 frame만 받는다. 256×256 WebP로 새로 인코딩하며 EXIF/ICC/원본 이름·원본 bytes를 저장하지 않는다. 결과는 64KiB 이하로 검사한다.

기존 bounded raw body reader를 공용 모듈로 추출했고 두 endpoint가 최대 16개 업로드 admission gate를 공유한다. 5초 body 제한과 1MiB 스트림 상한은 유지한다. account image도 별도 요청 budget의 업로드 6회/분을 사용한다. 이 값들은 해당 구현의 논리적 제한이며 OS/프로세스 전체 메모리 상한이 아니다.

## 저장 공간 결정

**위임된 구현 선택:** 기존 사진 64MiB 논리적 BLOB quota를 변경하지 않고 신규 account 사진에는 더 낮은 16MiB 별도 quota를 적용한다. 이는 기존 익명 사진의 저장 공간을 계정 확장으로 갑자기 소모하지 않고 초기 계정 기능에 보수적인 한도를 주기 위한 것이다. 최대 두 namespace의 이미지 BLOB 예산은 80MiB이며 SQLite 파일/WAL/삭제 후 free page/다른 데이터/백업까지 포함하는 디스크 상한이 아니다. #116/#140 완료 증거로 쓰지 않는다.

현재 합계에서 본인의 이전 사진 크기를 빼고 신규 정규화 사진 크기를 더해 transaction 안 검사한다. quota/CAS 실패는 account profile revision과 bytes 저장을 함께 rollback한다. HTTP 요청 제한 또는 decoder 거절은 기존 사진을 바꾸지 않는다.

## 권한과 재인증

계정 세션으로 자기 사진을 읽는다. 여행방 사진 목록/asset은 `/api/travel-rooms/:roomId/avatars` 및 `/api/travel-rooms/:roomId/avatars/:membershipId/image`이며 열려 있는 방의 **현재 참가자만** 현재 참가자의 사진을 볼 수 있다. 방 밖 계정, 과거/내보내진 참가자, 다른 방의 membership ID, 미인증 접근은 거절한다. 종료 방에서는 보수적으로 사진을 제공하지 않는다. 공개 추측 URL은 인증을 대체하지 않는다.

이미지 decode는 transaction 밖에서 수행한다. 저장 직전 transaction 안에서 계정 활성·원래 account session의 revocation/expiry/소유권을 다시 검사하여 decode 중 logout/expiry 뒤 저장하지 않는다. 서버 내부 actor에만 전달되는 session hash는 응답 DTO나 URL에 넣지 않는다. 모든 image 응답은 no-store/nosniff/CSP sandbox이고 content type은 image/webp다.

## 검증 범위

초기 신규 모듈 부재 RED 후 구현했다. 실제 HTTP 3개는 정규화/EXIF 제거/프로필 동작/잘못된 MIME·SVG·크기·Origin·401/권한을 검사한다. native SQLite 3개는 정확한 16MiB 경계 거절, 저장·재개방·기존 익명 bytes 불변, decode 중 logout/만료, 동시 CAS, 실제 legacy+account 혼합 3개 4MP 이미지의 2성공/1입장거절을 검사한다. 반복 실패는 안전한 코드만 반환한다.

이 문서는 실사용 사진/실기기/카카오 콘솔 인증/운영 배포 성공을 주장하지 않는다. 단색 synthetic 이미지의 동시 admission 시험은 적대적 모든 이미지의 최악 RAM 측정이 아니다. 현재 사용자 브라우저 UI 합성 및 전체 browser 검증은 coordinator의 정확한 RC에서 별도로 수행한다.
