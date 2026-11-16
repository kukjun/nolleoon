# MVP 순차 실행 기록

상태: 진행

## 목표·범위
승인된 MVP-01~32를 GitHub 이슈로 생성한 뒤 선행 관계에 따라 계획 → TDD → 구현 → draft PR → 독립 리뷰·검증 → 완료 순서로 진행한다. 실제 완료·배포와 문서 초안을 구분한다. 필요한 추가 이슈를 기록하고, 중요한 미확정 결정은 `critical`로 보류해 독립 작업을 계속한다.

## 현재 결과
- GitHub #1~32 생성, 전체 목록에서 32개 OPEN 확인.
- 각 이슈에 범위·선행 이슈·REQ 추적·RED 사례·AC·검증란 포함.
- #33은 피고 퇴장 중단의 이력 공개 범위 결정이며 아직 미해결.
- MVP-01 기준선 작업 착수. 이전 미커밋 하네스와 UI 시연은 보존.
- 기존 하네스 자체 시험: `node --test tests/harness/*.test.mjs` 9/9 통과. 제품 수용 시험 아님.

## 승인·안전 경계
공개 저장소에는 가상 데이터와 프로젝트 코드/문서만 게시한다. 비밀·개인 데이터·DB·작업 증거 원문은 제외한다. PR 검증/리뷰 전 자동 완료하지 않는다. 외부 배포·네트워크/보안 설정·데이터 파괴는 별도 해당 승인 규칙을 따른다.

## MVP-01 검증
- 변경 전 문서 계약 시험 RED: 4개 실패, 종료 코드 1.
- 문서 정리 후 최종 GREEN: 6개 통과, 실패·skip 없음. 리뷰 회귀 2개 포함.
- 독립 리뷰 지적 2건(방장 개시 문구, 삭제된 참조) 수정 후 재리뷰 승인.
- 활성 문서 링크 및 공개 부적합 정보 검사, diff 검사 통과.
- 이 검증은 문서 기준선에 한정하며 제품 동작·배포 완료를 뜻하지 않는다.

## MVP-02 진행
- #1은 PR #34 병합 후 CLOSED 확인.
- 앱 부재/환경 검증/계층 검사 RED 3개 실패, 빌드 전 smoke 실패 확인.
- React/Nest/공유 계약 workspace와 루프백 실행 기반 구현.
- GREEN 환경·구조 계약 5개 통과, 의존성 검사·빌드·HTTP smoke 통과.
- 깨끗한 staged 소스 내보내기에서 npm ci·계층 검사·전체 빌드·HTTP smoke·문서 6개 시험 통과. 독립 리뷰의 type-import 누락 지적은 회귀 RED→GREEN 후 재승인.

## MVP-03 검증
- #2는 PR #35 병합 후 CLOSED 확인.
- 확장 시험 RED 12개 중 3개 실패, fake 대역 미구현 실패 확인 후 구현.
- 깨끗한 소스 복사본 npm ci 및 전체 check: 하네스 15·workspace 5·문서 6·unit 3·API 1·Chromium 1 통과. lint/계층/build/type 통과.
- 빈 시험·skip/TODO·실행불가·timeout은 통과하지 않으며 미구현 DB/게임/실기기/외부접속은 별도 미구성 표시.
- 원격 CI는 게시 후 별도로 확인하며 로컬 통과로 대체하지 않는다.
- 독립 리뷰 후 새·중첩 시험 자동 수집을 추가하고 회귀 RED→GREEN, 전체 하네스 재실행·재리뷰 승인.
- 최종 소스 재검증 중 제한된 실행 환경의 Chromium MachPort 권한 오류로 브라우저 검사가 실패했다. 코드 변경/보호 설정 변경 없이 허용된 정상 실행 환경에서 전체 check 재실행해 전부 통과했다.
- 실행 workflow 게시가 GitHub OAuth workflow 범위 부족으로 거부됨. #36에 차단 기록, 실행되지 않는 docs/ci 초안으로 보존. 원격 CI는 미실행/차단. #3 AC가 CI 초안과 원격 미실행 명시를 허용하므로 로컬 기반 완료와 최종 CI 인수 차단을 분리한다.

## MVP-04 검증
- #3은 PR #37 병합 후 CLOSED. 원격 CI 인증 #36은 별도 OPEN 유지.
- 실제 DB 기반 RED 후 저장소 구현. 지원하지 않는 스키마를 허용하던 결함은 RED→GREEN으로 수정.
- 독립 리뷰의 제약 시험 fixture 강화 후 DB 15개 통과. 복합 FK 2개/index 2개를 임시 빌드에서 제거한 변이 시험은 각각 실패했고 원복·재빌드했다.
- 깨끗한 소스에서 npm ci 및 better-sqlite3 네이티브 rebuild·빌드·DB 시험 검증. 전체 하네스와 독립 재리뷰 통과.
- Node ABI 137, better-sqlite3 13.2.0, 실제 SQLite 3.54.1. 백업 복원/실제 데이터 연결/인증·게임 기능/원격 CI는 이 성공에 포함하지 않는다.

## MVP-05 검증
- #4는 PR #38 병합 후 CLOSED 확인.
- 초기 `node --test tests/unit/sessions.test.mjs`는 구현 전 모듈 부재(ERR_MODULE_NOT_FOUND)로 tests 1/pass 0/fail 1, 종료 코드 1. assertion 실행 전의 RED임을 구분한다.
- 최종 깨끗한 소스 npm ci/native rebuild·전체 check 통과: self15/workspace5/docs6/unit4/API4/DB15/browser2와 lint/layers/build/types. 실제 main+Vite 개발 경로의 401→쿠키발급→복구 smoke 통과.
- 독립 리뷰 승인. 쿠키 flags/동일·신규 브라우저/위조·만료·CSRF/서버 재시작을 확인. 실제 모바일·외부 HTTPS·게임별 권한·원격 CI는 미검증.

## MVP-06 검증
- #5는 PR #39 병합 후 CLOSED 확인.
- 구현 전 브라우저 입력 탐색 timeout으로 expected0/unexpected1, 종료 코드1 RED 확인.
- 모바일 디자인 시스템과 세션 셸 구현 후 깨끗한 소스 npm ci/native rebuild·전체 check 통과, 브라우저5 포함. 독립 코드·시각 리뷰 승인.
- 390 모바일 홈, 320 갤러리·모달, 1440 데스크톱 스크린샷을 직접 확인. 입력 오류/비동기 실패/중복 방지/모달 반복·포커스/320x360 스크롤과 세션 회귀 검사.
- 에뮬레이션이므로 실기기 키보드·노치·VoiceOver 합격으로 주장하지 않는다. 기존 ui 원본은 보존했다.

## MVP-07 검증 · M1 완료
- #6은 PR #40 병합 후 CLOSED 확인.
- 초기 presenter 모듈 부재 RED(tests1/fail1/exit1) 후 계약 구현. 진행 이유 공개·전체 entity 직렬화·피고 투표 허용의 3개 보안 변이는 각각 시험 실패를 확인하고 원복.
- 깨끗한 소스 npm ci/native rebuild·전체 check 및 실제 main/Vite smoke 통과: unit14/API5/DB15/browser5와 self15/workspace5/docs6 및 정적 검사.
- 독립 개인정보 공개·권한·오류 리뷰 승인. 실제 게임 endpoint·마감 엔진은 후속 범위이고 action 표시는 명령 허가의 대체물이 아니다.
- M1 개발 기반 1~7 구현·검증을 마쳤다. #33 공개 결정과 #36 원격 CI 인증은 미해결이며 전체 MVP 인수는 미완료다.

## MVP-08 검증
- #7은 PR #41 병합 후 CLOSED, M1 마일스톤 0open/7closed 확인 후 종료.
- 실제 API 404≠201 RED 후 방 생성/참가 구현. 독립 리뷰의 같은 순간 폼 제출 2회 문제는 요청2≠1 RED 뒤 동기 mutex로 수정, 회귀 통과.
- 깨끗한 소스 설치·전체 check: unit16/API6/DB16/browser12와 self15/workspace5/docs6 및 정적 검사 통과. 3/5/6 독립 context에서 같은 방과 단일 방장 확인.
- 독립 리뷰 승인, 390px 실제 방 캡처 직접 확인. 명단·초대·새로고침 가로 잘림 없음. 자동 동기화/presence·게임·실기기·외부 배포는 아직 미완료.

## MVP-09 검증
- #8은 PR #42 병합 후 CLOSED 확인.
- 실제 DB connected 부재 RED 후 heartbeat/감지 구현. migration 1 원문 보존, version 2 backfill 추가.
- 깨끗한 소스 전체 check: unit18/API7/DB18/browser16 및 self15/workspace5/docs6·정적 검사 통과. 독립 리뷰 승인.
- 독립 서버 1초 sweep, 15초 무응답, 응답 뒤 3초 폴링, 6초 요청 제한. 가짜 시간 경계/실제 단절·복귀/역전 응답/숨김 탭 합성 이벤트/종료 정리 확인.
- 로컬 단일 측정 참여 반영 2837ms·단절 표시 15446ms는 SLA가 아니다. 390px 재연결 화면 직접 확인. 10분 퇴장·방장 이전·실기기·외부/원격 CI는 아직 미완료.

## MVP-10 검증
- #9는 PR #43 병합 후 CLOSED 확인.
- 실제 API 404≠201 및 DTO 거절 RED 후 초안 저장 구현. 별도 draft.version CAS, 방 버전 증가와 rollback 확인.
- 깨끗한 소스 전체 check: unit19/API8/DB19/browser20와 self15/workspace5/docs6·정적 검사 통과. 독립 코드·시각 리뷰 승인.
- 호스트 권한/잘못된 시간·길이/동시 저장/dirty 입력 보존/통신 실패/오래된 heartbeat·저장 응답/재방문 확인. 390px 설정 화면 직접 확인.
- 아직 게임 시작 전이다. 실제 이양은 #21, 투표 전 시간 조절 명령은 #14에서 구현하며 초안 endpoint의 진행 게임 잠금과 구분한다.

## MVP-11 검증
- #10은 PR #44 병합 후 CLOSED 확인.
- 실제 API 404 RED 후 역할/제외 구현. 독립 검토 중 실제 결함(제외 403 후 통신 오류에서 조작이 다시 표시됨)을 RED로 확인해 최신 성공 snapshot만 복구하도록 수정.
- 성공 응답의 excluded 초기화는 이미 존재했으며 새 결함으로 기록하지 않는다. 해당 초기화 제거 변이와 같은 브라우저 다른 탭의 새 멤버십 재참가 회귀를 추가했다.
- 깨끗한 소스 전체 check: unit19/API9/DB21/browser23 및 기존 self/workspace/docs·정적 검사 통과. 독립 리뷰 승인, 390px 방장=피고 화면 직접 확인.
- migration3 append-only, 역할 경쟁·양쪽 제외/heartbeat 순서·재참가 확인. 실제 수락은 #12, 게임 시작/10분 퇴장은 후속 단계.

## MVP-12 검증
- #11은 PR #45 병합 후 CLOSED와 체크리스트 반영 확인.
- API404 RED 후 현 피고 수락·거절 구현. 벌칙/피고 ABA 및 결정 CAS로 구버전·지연 동의 차단.
- 독립 리뷰에서 status 배열을 문자열처럼 허용한 DTO 강제변환을 RED로 재현해 strict type guard로 수정, 관련 변환 우회 회귀 통과.
- 최종 깨끗한 소스 전체 check: unit20/API10/DB22/browser26와 self15/workspace5/docs6 및 정적 검사 통과. 독립 리뷰 승인.
- 저장된 벌칙/미저장 수정 구분과 390px 수락 영역 직접 확인. 실제 게임 시작은 #13이며 실기기·외부/원격 CI는 미완료다.

## MVP-13 검증
- #12는 PR #46 병합 후 CLOSED와 체크리스트 반영 확인.
- 실제 시작 API404 RED 후 별도 StartTrial 유스케이스·migration5 요청 영수증·고정 명단 구현.
- 동일/상이 요청 동시 시작, 현재 수락·접속 경계, rollback/재기동 재시도, 5컨텍스트 시작과 늦은 관전자, 종료 뒤 신규 참가자 공개 차단을 검사했다.
- 독립 리뷰에서 game.status/self.role DTO enum 강제변환을 발견해 strict type guard와 회귀로 수정했다.
- 390px 시작 화면 직접 확인. 실제 변론/투표·다음 게임은 후속 단계이며 원격 CI #36·중단 공개 결정 #33은 미해결이다.
- 최종 깨끗한 소스 설치·전체 check 통과: unit20/API12/DB24/browser29 및 self15/workspace5/docs6·정적 검사. 최종 enum 수정도 독립 재리뷰 승인.

## MVP-14 검증
- #13은 PR #47 병합 후 CLOSED 확인, M2 0open/6closed로 종료.
- API404 RED 후 선택적 변론·방장 투표 개시·시간 조절을 별도 TrialProgress로 구현했다. migration6 변론/개시 영수증 추가, game ID와 버전으로 이전 요청을 격리한다.
- 단일 round/deadline, 중복 요청·재시작 마감 불변, 변론/시간 변경 경합, 별도 방장/피고, 실제 영어·줄바꿈 허용/제어문자 거절을 검사한다.
- 5컨텍스트 같은 deadline, 기기 Date.now 변경·오프라인 복귀·0초 대기 표시 검증과 390px 화면 직접 확인. 현재 투표 제출·정산은 #15/#16 후속 단계다.
- 시간 입력의 오래된 clean 값이 남는 결함은 실제 RED 후 최신값 동기화·dirty 보존·명시적 버리기·미저장 중 개시 차단으로 수정했다. 경합 시험은 양쪽 합법적 승리 순서를 모두 검증하도록 보강했다.
- 독립 리뷰가 발견한 지연된 과거 시간 저장 응답의 local input 역전도 RED로 재현해 game ID/version guard로 수정하고 재리뷰 승인받았다.
- 최종 깨끗한 소스 설치·전체 check 통과: unit21/API16/DB25/browser34 및 self15/workspace5/docs6·정적 검사. 독립 전체 검증과 수정 후 재리뷰 승인. 원격 CI #36은 여전히 미실행이다.

## MVP-15 검증
- #14는 PR #48 병합 후 CLOSED와 체크리스트 반영 확인.
- API404 RED 후 별도 SubmitVote 유스케이스로 고정 대상·게임/라운드·서버 마감·한 표 불변을 검사한다. 개인 표 저장은 공유 version/진행 표수를 증가시키지 않는다.
- 동일 key/의도 재시도는 원래 라운드 접수 envelope로 확인하며 새 라운드 접수로 오인하지 않는다. 같은 버전의 오래된 snapshot도 본인 접수 확인을 지우지 않는다.
- 독립 검토가 발견한 두 번의 clock 읽기 경계는 RED 재현 후 단일 now 검사/저장으로 수정했다. 유죄/무죄 이유 필수·기권 선택, rollback/재시작·동시 중복·입력 이스케이프를 검사한다.
- 390px 본인 접수 화면 직접 확인. HTML 형태 입력은 실행하지 않고 텍스트로 표시한다. 투표 정산은 #16, 실제 모바일/외부·원격 CI는 아직 미완료다.
- 서버가 마감을 확정했을 때는 DEADLINE_PASSED로 명확히 안내하며 불확실 네트워크 재시도와 구분한다. 이미 접수된 원래 요청은 마감 뒤에도 재확인된다.
- 최초 전체 브라우저 검사는 90초 timeout으로 실패했다. 이후 list 실행 38/38 약108초 통과를 측정해 전체 suite 예산만150초로 늘렸고 개별 assertion/test 제한은 약화하지 않았다.
- 추가 #49: Playwright 분리 그룹 fixture 잔존을 실행별 임시 lease/owner 생존 검사로 정리한다. 자기 fixture만 닫으며 timeout·owner 종료 detached 회귀 2개 통과, 다른 서비스/설정은 변경하지 않았다.
- 최초 clean-source 최종 검사에서 새 detached cleanup 시험의 no-unsafe-finally lint가 실패했다. 제품/browser38 및 다른 검사는 통과했지만 전체 통과로 보지 않았다. cleanup을 독립 t.after 훅으로 분리해 오류를 가리지 않게 수정하고 최종 재검증했다.
- 환경 연결이 끊긴 최종 실행은 보고서/완료 증거가 없어 중단으로 기록했다. Mac 재연결 후 같은 frozen clean 소스에서 다시 실행하여 최종 exit0 확인: self17/workspace5/docs6/unit22/API19/DB26/browser38와 lint/layers/build/types. 독립 최종 승인, 테스트 포트 정리 확인. 원격 CI #36 미실행은 별도다.

## MVP-16 검증
- #15 및 추가 #49는 PR #50 병합 후 CLOSED 확인.
- 순수 집계 모듈 부재 RED 후 마지막 표 저장과 정산의 동일 트랜잭션, 독립 1초 마감 monitor, migration7 불변 라운드 결과를 구현했다.
- 전원 기권·기권3/유죄1·퇴장 뒤 고정 총수·중복 정산·rollback·재시작을 검사한다. 미제출 기권은 집계에만 반영하고 가짜 본인 접수 영수증을 만들지 않는다.
- monitor가 먼저 마감한 뒤 POST도 DEADLINE_PASSED 안내가 되도록 RED→수정했다. 진행 중 집계/타인 이유는 여전히 비공개다.
- 390px 집계 화면 직접 확인. 실제 2차 흐름/최종 이유 공개는 #17/#18, 실기기/외부/원격 CI는 아직 후속·미해결이다.
- 최종 독립 clean-source 설치·전체 check exit0: self17/workspace5/docs6/unit24/API22/DB29/browser41와 lint/layers/build/types. 결과 화면·정산 경계 독립 승인, 테스트 포트 정리 확인. 원격 CI #36은 미실행이다.
