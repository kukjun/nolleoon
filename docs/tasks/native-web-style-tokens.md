# Current web travel tokens in Flutter

상태: 검증

## 목표와 범위
Map actual current travel CSS to shared Flutter theme/design tokens; preserve all app behavior. Owned theme.dart and lib/design only, plus synthetic tests/docs. No credentials, auth, backend, simulator changes.

## 미결정과 가정
Pixel-identical browser/native font shaping is not claimed. Current travel palette wins over legacy scoped party styles. Read-only CSS mapping is documented in lib/design/README.md. Feature screen layout is another worker's scope.

## 합격 기준
Exact travel surface/ink/shared CTA values, heading/body metrics, white border20 card, button14/min48 target, >=4.5 contrast; existing design interaction and320px large-text tests remain valid.

## 실행과 증거
RED new AppTokens absent; GREEN focused7 tests including token contracts, contrast and shared component interactions. Final full suite below.

## 회고
Seed-generated Material colors and pill buttons cannot express exact existing web colors/geometry. Explicit web mapping also avoids accidentally applying older party blue to travel green text/surfaces.

Final verification: **277 Flutter tests passed**, zero failures, analyze clean. Initial full suite had2 photo picker fixture failures: changed typography left cancel text center at y608 beyond the600px test viewport after an edge-visible scroll. Approved fixture fix explicitly centers the existing scrollable target, asserts its center is in viewport and hit-testable, then taps; all original cancel/upload behavior assertions retained. No test or product rule relaxed. Reviewer actual web computed CTA confirmed rgb(36,92,226),white,radius14.
