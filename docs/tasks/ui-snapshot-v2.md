# #220 새 UI 후보 시각 증거 준비

상태: 진행 · 최종 UI 소스 대기. 캡처/디자인 승인 아님.

## 목표와 범위

새 UI 구현이 고정되면 실제 MyApp 합성 renderer로 6개 상태를 다시 찍고 GitHub에 보존 가능한 append-only timestamp 기록을 만든다. 앞선 #216 기록 `docs/ui-snapshots/2026-11-19T13-36-32+0900/`와 proposed baseline은 수정하지 않는다. UI 구현, 실제 사용자 앱·서버·운영·인증키·OS 권한은 이 작업 범위가 아니다.

작업 기준은 `7e5af66f5c2621106d09fcf2811e492971f2cb69`, 전용 branch `docs/ui-snapshot-v2`. 다른 작업 트리의 미커밋 수정은 가져오지 않는다.

## 미결정과 가정

- 최종 UI SHA와 구현 측 변경/요구사항 설명이 필요하다. 그전 캡처는 새 디자인 증거로 취급하지 않는다.
- 6장 표준 capture는 기존 390×844, 배율1, 시스템 한글폰트/MaterialIcons 해시, Flutter-test RepaintBoundary를 유지한다.
- 320px·큰 글씨는 별도 fixture 및 별도 manifest가 필요하다. 기존 비교 도구가 390×844를 엄격히 요구하므로 다른 크기를 표준6장처럼 위장하거나 제한을 느슨하게 바꾸지 않는다. 구현 측 해당 fixture 검증이 있으면 명령/결과를 정확히 인용하고, 추가 캡처가 필요하면 새 isolated target으로 기록한다.
- 모든 PNG는 합성 계정/방/응답을 쓰는 Flutter 렌더이며 실기기·OS picker·카카오·운영 API 성공 증거가 아니다.

## 합격 기준

1. 이전 snapshot 디렉터리 Git tree/PNG hash가 그대로다. 새 디렉터리만 추가한다.
2. 최종 UI SHA를 명시하고 캡처 전후 source commit/dirty/digest·환경이 같아야 한다. dirty면 사유와 파일을 기록하며 clean 제품 RC라고 부르지 않는다.
3. `native-visual-regression.mjs capture`가 생성하는 startedAt/finishedAt UTC를 보존하고 같은 시각의 KST도 기록한다. 폴더 timestamp는 새 실행 시점에서 생성하며 예전 mtime을 재사용하지 않는다.
4. auth/home/lobby/selection/team-ready/team-result 6장과 각 SHA-256, 상대 링크, 변경 설명을 보존한다. 비교는 exact pixel이며 변화는 승인으로 취급하지 않는다.
5. 문서에 화면별 component, 연결된 요구사항, #216 대비 변화, 남은 제약, 실제 수행/미수행을 구분한다. 참고 서비스의 이미지·폰트·문구를 복사하지 않는다.
6. 최종 시각 직접 확인과 independent review 뒤에도 `captured-candidate`, `acceptance=false`를 유지한다. 사용자 디자인 승인은 별도다.

## 실행과 증거 계획

- 준비 확인(2026-11-19 06:41:39 UTC / 15:41:39 KST): 기존 도구와 fixture를 읽었다. 캡처 실행은 아직 하지 않았다.
- SDK: 기존 Flutter 3.50.0 경로 사용. 시스템 폰트는 로컬에서 읽고 배포하지 않는다.
- 새 worktree에 node_modules 및 Flutter package_config가 아직 없다. 캡처 전 lockfile을 바꾸지 않는 의존성 준비 후 소스 상태를 다시 고정한다.
- 명령: `node tools/mobile/native-visual-regression.mjs capture NEW_DIR FLUTTER_SDK`.
- 비교: `node tools/mobile/native-visual-regression.mjs compare tests/visual/native-proposed NEW_DIR NEW_DIFF_DIR`. UI 변경이므로 exit1/changed는 예상 가능한 관찰값이지 실패 은폐나 승인 사유가 아니다.
- 자체 시험: `node --test tests/visual/native-visual-regression.test.mjs`.
- 최종 폴더에는 capture 원본 manifest와 별도 dataset manifest/README를 함께 보존한다. source 전후 자동 결속을 손으로 다시 쓴 설명으로 대체하지 않는다.

## 회고 / 남은 작업

최종 UI 커밋 수신 → 의존성 준비/상태 고정 → 새 timestamp capture → exact 비교/시각 검토 → 문서/PNG 링크 검증 → 별도 commit 보고. 현재는 계획과 환경 확인만 완료했다.
