# 독립 검토와 제한된 가독성 정리 · MVP-31

독립 감사에서 최초 초대 조회·방 생성·참여 요청에 대기 종료가 없어 화면이 계속 로딩되는 결함을 재현했다. [진입 복구 기록](entry-recovery.md)에 RED/GREEN과 응답 유실의 한계를 기록한다. 이 수정은 생성 요청의 영속 멱등성을 새로 보장하지 않는다.

## 별도로 검증한 format-only 변경

`apps/api/src/application/rooms.ts`와 `apps/web/src/trial-controls.tsx`만 줄바꿈·들여쓰기를 정리했다. helper 추출, 조건 변경, hook 의존성 변경, 저장소 호출 순서 변경은 하지 않았다. Prettier 3.10.1을 공식 npm registry에서 확인해 일회 실행했고 의존성/lockfile을 추가하지 않았다.

정리 전 원문과 정리 후 원문을 TypeScript 5.9.3 `transpileModule`로 각각 ES2022/ESNext/react-jsx JavaScript로 변환한 뒤, 파싱한 각 노드의 SyntaxKind·식별자/리터럴 값·자식 순서를 재귀 비교했다. 주석/위치 정보와 괄호 포장 노드만 제외한 emitted AST가 두 파일 모두 동일했다. 따라서 JSX 공백이 실제 문자열·자식 노드 의미를 바꾸지 않는지도 비교에 포함됐다. 이것은 동작 회귀 시험의 대체가 아니다.

`web-bff.md`의 초기 합성 presenter 설명을 현재 제품 endpoint와 구분했다. 초기 scaffold를 현재 모든 권한 판단의 유일 구현으로 설명하지 않는다.

## 인수 상태

소스 감사와 자동 회귀 통과는 전체 제품 인수 완료가 아니다. 실제 iPhone/Android, 승인된 외부 배포·외부 네트워크 인수, 원격 CI, 미확정 중단 공개 정책 및 사용자 최종 인수는 해당 열린 이슈와 근거로 따로 확인한다. #31의 부분 검토 결과로 이 조건을 자동 면제하지 않는다. 최종 clean source 전체 검사 결과는 해당 PR/실행 보고서에서 정확한 소스와 함께 확인한다.
