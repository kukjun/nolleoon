# #146 빌드 도구 취약성 일부 해소

상태: 별도 브랜치 검증 완료. 운영/전체 하네스 미실행.

## 범위와 근거

`d0947d1` 기준 `typescript-eslint`를 8.72.2에서 8.73.0으로 정확히 고정했다. npm registry의 8.73.0 typescript-estree 의존성은 `minimatch:^11.0.1`이며 Node24와 호환된다. [minimatch 공식 advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)는 >=7,<11.0.1 영향 및 11.0.1 패치를 명시한다. 기존 nested minimatch10.2.6이 제거되고 이미 있던 minimatch11.0.8을 재사용한다.

정상 npm lock 생성 과정에서 TS-ESLint 하위 패키지 11개도 8.73.0, eslint-plugin의 ignore는 7.0.14→7.0.16으로 갱신됐다. Vite8.3.8, picomatch4.0.7, ESLint10.15.0, TypeScript5.9.3, runtime 의존성 버전은 변경하지 않았다. force, overrides, audit fix, Vite downgrade를 사용하지 않았다.

## 남은 위험과 audit 해석

2026-11-18 확인한 [picomatch 공식 advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)는 <=4.0.7 영향, 패치 없음으로 표시한다. 당시 npm latest도4.0.7이다. 취약한 glob 입력이 빌드/린트 도구에 유입되는 경로를 피하고 후속 패치를 검토해야 한다. production audit 0은 모든 사용 조건에서 안전하다는 보장이 아니다.

- 변경 전: 영향 package entries11 (high5/moderate6), 직접 advisory2종.
- 변경 후: entries10 (high10/moderate0), 직접 advisory는 picomatch1종만 남음.
- production-only audit: 전후0.

high 항목 수 증가는 dependency-chain 분류 전파 결과다. 이 숫자를 5개의 새 취약점 도입 또는 전체 해소로 해석하지 않는다. #146은 picomatch가 남아 있으므로 닫지 않는다.

## 실제 검증

- lint, build, typecheck, 계층 검사 PASS.
- harness 계약25, workspace8, unit174 PASS.
- 깨끗한 worktree에서 처음 typecheck를 build보다 먼저 실행해 공유 contracts dist 미생성 오류가 났다. build 이후 동일 typecheck PASS. 설정/검사를 완화하지 않았다.
- 전체 하네스/API/DB/브라우저 회귀는 통합 후 담당자가 별도 실행한다. 브라우저 포트나 운영 환경을 사용하지 않았다.
