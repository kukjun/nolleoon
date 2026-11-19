# Flutter 시각 회귀: 제안 기준, 명시 실행

`tests/visual/native-proposed/`의 합성 PNG 6장은 아직 사용자 승인되지 않은 제안 기준이다. `c010a86` 기록 시점의 제품 `de56652` 렌더이며, manifest에 파일 SHA-256·Flutter framework/engine·Dart·플랫폼·폰트 해시·390×844/1배율을 고정한다. 폰트 파일/개인 자료는 저장하지 않는다. 이 디렉터리 용량은 약232 KiB다.

## 실행

```sh
node tools/mobile/native-visual-regression.mjs capture \
  artifacts/visual-review/new-candidate '<flutter-sdk>'
node tools/mobile/native-visual-regression.mjs compare \
  tests/visual/native-proposed artifacts/visual-review/new-candidate \
  artifacts/visual-review/new-diff
node --test tests/visual/native-visual-regression.test.mjs
```

모든 출력 경로는 새 디렉터리여야 한다. 기준을 자동 갱신하는 명령은 없다. candidate는 실제 MyApp 합성 widget fixture를 다시 렌더한다. 서버/운영/실계정/시뮬레이터는 사용하지 않는다. 동일 시스템 한글폰트, 미지정 폰트 family 보정, 실제 공개 webp decode 대기 및 이미지 nonnull assertion을 적용한다. 실제 OS 스크린샷이나 API 검증은 아니다.

비교는 디코딩한 RGBA의 **정확한 픽셀 차이**다. threshold/무시 영역/자동 허용은 없다. 각 장의 changedPixels, 총픽셀329160, candidate hash를 summary.json에 쓰고 차이 픽셀은 분홍, 나머지는 어둡게 표시한 diff PNG6장을 남긴다. PNG는 브라우저 canvas로 디코딩하며 네트워크는 차단한다.

- `unchanged`: 6장 모두0픽셀, exit0.
- `changed`: 하나라도 변화, exit1. 오류/의도된 디자인 변경인지 사람 검토가 필요하다.
- `blocked`: 폰트/SDK/renderer/플랫폼 manifest 불일치, exit1. 기준을 자동 갱신하지 않는다.
- manifest 누락·PNG해시 불일치·크기 오류·누락파일은 실패한다.

모든 상태에서 acceptance=false다. 결과는 로컬 도구의 판정이며 파일 출처/manifest 작성자의 진실성을 인증하지 않는다. 같은 환경이라고 파일에 기입하는 것만으로 실제 환경이 증명되지는 않는다. capture 명령이 해당 환경의 해시를 직접 기록한 실행 근거와 함께 검토한다.

## 기준 변경

사용자/담당자의 명시적 디자인 승인과 독립 리뷰가 있기 전 기준을 덮지 않는다. 새 candidate+diff+변경 설명을 PR에 붙이고, 승인받은 변경만 새 snapshot 버전과 관련 baseline 갱신 커밋에 포함한다. 이전 docs/ui-snapshots 버전은 append-only로 보존한다. 기준 이미지의 흥미로운 차이를 줄이려 threshold를 올리거나 테스트를 생략하지 않는다.

이 도구/시험은 opt-in이다. 기존 npm check 필수 gate에 연결하지 않았으며 원격 CI도 구성하지 않았다. 원격 폰트·렌더러가 다르면 별도 기준 또는 동일 환경 확보를 먼저 결정해야 한다.

## 실제 검증 기록

독립 `nolleoon-native-visual-regression` worktree에서 c010a86 실제 재렌더6장 → 6장 모두0픽셀. 복사본끼리만 비교한 결과가 아니다.

그 worktree의 AppTokens.canvas만 cream→red로 의도 변경 후 실제 재렌더: auth309483, home248567, lobby227019, selection193544, ready209753, result183995 픽셀 변화. compare는changed/exit1을 반환했다. 해당 파일만 git restore한 뒤 재렌더6장은 다시 전부0픽셀/unchanged였다. 제품 수정은 커밋하지 않았다.

자체 시험3개: 동일 합성 이미지 정확 비교/재출력 거부, 폰트 불일치 blocked, manifest누락·기준PNG변조 거부 PASS. 전체 앱/원격 CI/실제 사용자 디자인 승인은 이 기록에 포함되지 않는다.

## 캡처 출처 결속 보강

캡처 시작 전에 Git HEAD/dirty 여부, 모바일 tracked+untracked(ignored 제외) 소스와 캡처 도구의 내용 digest, 폰트/SDK/플랫폼 환경을 읽는다. 캡처 종료 뒤 같은 값을 다시 읽어 하나라도 달라지면 유효 manifest를 만들지 않고 실패한다. 성공 manifest에는 시작·종료 UTC 시각, 동일성 확인, 소스 commit/dirty/digest와 생성 PNG6장의 SHA-256을 자동 기록한다. 비교 시 candidate와 baseline 양쪽 PNG hash를 검증한다. dirty=true도 숨기지 않고 기록하므로 승인된 clean RC로 오해하지 않아야 한다. 이 검사는 전후 상태 결속이며 실행 중 변경 후 완전 원복된 악의적 ABA 변경까지 인증하는 샌드박스는 아니다.

후속 검증: 실제1픽셀 변경 후보는 정확히1 changedPixel로 검출, 원본 복원 시0. 소스 commit/dirty/digest/폰트 환경 변경 거절 포함 자체5시험 PASS. 보강된 capture로 실제 다시 렌더한 후보도6장0픽셀이다. 최초 실제 canvas색 실험은 c010a86 기반 f899042 작업 트리에서 수행했고, AppTokens.canvas가 차지하는 전체 배경 영역 변화가 각 화면에 검출됐다(문서의 화면별 실제 수치 참고). 현재 제품 소스는 원복됐으며 제품 파일 diff는 없다.

버전별 18장 비교 기록과 구조 설명은 [첫 캡처 데이터셋](../ui-snapshots/2026-11-19T13-36-32+0900/README.md)을 참고한다. 두 기준(after PNG와 proposed baseline)의 해시가 같아야 한다. 데이터셋과 기준 모두 사용자 미승인 상태이며 이미지 보존 자체가 디자인 수용을 뜻하지 않는다.
