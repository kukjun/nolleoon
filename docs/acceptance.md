# 인수 상태와 증거 기준 · MVP-32

현재 구현된 게임 기능과 자동 회귀 검증은 **최종 MVP 인수 완료가 아니다**. 로컬 합성 데이터 검증, 실기기, 외부 운영, 사용자 승인을 각각 구분한다.

## 안내 모음

- [사용 안내](user-guide.md), [로컬 개발](local-development.md)
- [최신 규칙](design/00-current-rules.md), [기능 범위](mvp/scope-and-done.md)
- [검증 하네스](harness.md), [다인 E2E](e2e-acceptance.md), [모바일 인수](mobile-acceptance.md)
- [재시작·내구성](durability.md), [SQLite 백업·복구](sqlite-backup.md)
- [운영 적용 준비](deployment-preparation.md), [외부 인수](external-acceptance.md), [독립 검토](independent-review.md)

## 남은 인수 조건

| 구분 | 미완료 이유 |
|---|---|
| #33 | 피고 퇴장 등 중단 게임 공개 정책 결정 필요. 현재는 보수적 비공개 |
| #36 | 해당 소스의 원격 CI 실행 근거 미확보 |
| #63 / #28 | 실제 iPhone Safari·Android Chrome 접근과 인수 미실행 |
| #65 / #29–30 | 승인된 운영 설정 적용과 외부 네트워크 인수 미실행 |
| #31–32 | 위 근거와 최종 사용자 인수를 포함하는 완료 조건 미충족 |

열린 이슈를 목록에서 지우거나 JSON에 승인했다고 적는 것만으로 해결되지는 않는다. 실제 상태는 GitHub 이슈와 원본 근거를 독립 검토한다.

## 같은 RC의 증거를 모으는 순서

1. 구현·문서·검증 도구를 최종 정리하고 추적 파일을 commit한다. 전체 40자리 RC commit과 소스 동결 시각을 기록한다.
2. 그 commit의 깨끗한 별도 checkout에서 의존성 설치·전체 검사를 실행한다. 실패하면 수정 commit을 만들고 새 RC로 다시 검사한다.
3. lint·계층·build·typecheck, 단위/API/DB, 내구성·백업복구, 브라우저 기능·E2E·모바일 에뮬레이션, 독립 리뷰의 원본 보고서를 연결한다.
4. 같은 RC의 원격 CI, 실제 단말, 실제 외부 배포·네트워크 근거를 확보한다. 로컬 HEAD만 보고 배포 commit을 추정하지 않는다.
5. 미결정 정책과 차단 이슈를 해결하고 사용자의 명시적 최종 인수를 받는다. 사용자 승인을 자동 생성하거나 추정하지 않는다.
6. 최종 검토 시각까지의 근거를 검토한다. **검사 뒤 추적 문서를 고쳐 같은 RC라고 주장하지 않는다.** 실행 보고서·증거 JSON·최종 결과는 무시된 artifacts 또는 PR comment에 남긴다.

## 오프라인 증거 형식 검사

```sh
node tools/deployment/acceptance-evidence.mjs /absolute/path/to/evidence.json
```

`deploy/templates/acceptance-evidence.example.json`은 미완료 빈 양식이다. 정상 릴리스의 증거가 아니며 기본 결과는 blocked다. 이 명령은 네트워크·배포·GitHub·사용자 승인 시스템에 접근하지 않는다.

필수 gate ID: `lint`, `layers`, `build`, `typecheck`, `unit`, `api`, `database`, `durability-backup-restore`, `browser-feature`, `gameplay-e2e`, `mobile-emulation`, `independent-review`, `physical-ios`, `physical-android`, `external-deployment`, `remote-ci`.

모든 gate와 사용자 인수는 동일한 `expectedCommit`을 가리켜야 한다. source는 같은 commit이며 dirty=false여야 한다. `window.notBefore`(소스 동결)부터 `window.notAfter`(검토 시각)까지의 UTC ISO 시각만 허용하며, 역전·잘못된 시각·현재보다 미래인 window/증거는 거절한다. 임의의 24시간 만료 규칙은 없다. 동일 불변 RC의 오래된 근거가 유효할 수 있지만, 단말·배포 환경 변화로 인한 낡은 근거인지는 사람이 별도로 판단한다.

시험 gate는 실제 통과 수가 0보다 크고 실패·skip·todo·flaky·cancel이 0이어야 한다. 빌드·리뷰처럼 시험 수가 없는 gate는 별도로 구분한다. 실기기 gate에는 `context.kind=physical`, `platform=ios`와 `browser=safari` 또는 `platform=android`와 `browser=chrome`, 비어 있지 않은 `browserVersion`·`osVersion`을 함께 기록한다. 이 문자열만으로 실제 장비나 버전을 인증하는 것은 아니다. 에뮬레이션으로 실기기를 대체하거나 외부 gate에 loopback/LAN/example 주소를 넣을 수 없다. 누락·중복 gate, 다른 RC, 미해결 blocker, 사용자 인수 누락을 완료로 인정하지 않는다.

출력은 `blocked`, `incomplete`, `ready-for-human-review` 중 하나이며 **항상 `verified:false`**다. 종료 코드 0도 형식이 검토 가능한 상태라는 뜻이지 release PASS가 아니다. 파일이 주장하는 commit·clean 상태·승인자·장비·네트워크·보고서의 진위와 접근 권한, evidenceRef의 실재를 인증하지 않는다. 실제 권한 및 독립 검토를 대신하는 우회 도구로 사용하지 않는다.
