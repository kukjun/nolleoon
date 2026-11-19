# UI snapshot 새 버전 템플릿

상태: captured-candidate / 사용자 승인 대기

- snapshotId: YYYY-MM-DDTHH-mm-ss+0900 (Asia/Seoul, 실제 capture/assembly 근거 구분)
- 이전 기록/승인 기준 링크:
- before / after / fixture 전체 commit SHA:
- 자동 capture manifest: 캡처 전후 HEAD·dirty 상태·실행 환경·출력 PNG SHA를 함께 보존. 실행 전후 소스가 달라지거나 dirty이면 자동 승인/출처 일치로 처리하지 않는다. 수기로 적은 소스 SHA와 자동 실행 증거를 구분한다.
- 실제 캡처 시간 범위 및 mtime 출처:
- viewport / DPR / text scale / Flutter·browser 버전:
- 폰트 보정 정책 및 SHA (파일 배포 금지):
- 합성 상태·참가자·게임 단계:
- 요구사항·가정·미결정:

## 화면별 비교
| 화면 | 구성/상태 | 변경점 | 읽기 순서/CTA/뒤로/취소/메뉴 차이 | 코드 경로 | 수락/미검증 |
|---|---|---|---|---|---|

## 검증
원본 해시/개수/크기·링크·개인정보 검토 결과, 실제 실행한 기능 시험과 미실행 시험을 나눈다. API/OS/사용자 승인을 캡처 성공에서 추론하지 않는다.

## 승인 기록
사용자의 명시적 결정이 없으면 candidate 유지. 승인자/일시/대상 버전/승인 범위/남은 차이를 새 기록에 적는다.

## 회고/다음 버전
이전 이미지는 수정하지 않는다. 실패·기대 차이와 다음 비교 조건을 남긴다.
