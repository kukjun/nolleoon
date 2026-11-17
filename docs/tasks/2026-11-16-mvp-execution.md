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

## MVP-17 검증
- #16은 PR #51 병합 후 CLOSED와 체크리스트 반영 확인.
- 명시적 roundNumber 요청 RED 후 변론/개시/영수증을 라운드별로 격리했다. 1차 동률 뒤 새 최후 변론·무응답/skip·같은 투표 대상/시간의 2차 개시를 연결했다.
- 1차 공개 이유는 2차 중에도 유지하며 미완료 2차 이유는 숨긴다. 표시 순서는 공개 문자열만으로 결정하고 신원·제출시각/순서를 반환하지 않는다.
- 독립 검토의 집계/공개 필터 불일치는 비대상·기한후 DB 행의 이유가 포함되는 RED 후 acceptedVotes 공유로 수정했다.
- 전체 모바일 결과 캡처에서 양 라운드 구분·텍스트 가독성을 직접 확인했다. 결과 중심 배치는 #18에서 다듬으며 전체 인수·실기기·외부/원격 CI는 아직 미완료다.
- 최종 독립 clean-source 설치·전체 check exit0: self17/workspace5/docs6/unit25/API25/DB30/browser43와 lint/layers/build/types. 최종 browser154.9초를 확인했고 측정에 따른 suite180초 조정만 했으며 개별 timeout은 유지했다. 독립 승인·테스트 포트 정리 확인.

## MVP-18 검증 · 내부 알파
- #17은 PR #52 병합 후 CLOSED 확인.
- 벌칙 결과 영역 부재 RED 후 판정·표수·벌칙 여부를 최상단에 배치하고 사건/합의 벌칙 기록·방 정보는 명시적 상세로 분리했다. 2차 동률 무죄의 근거도 안내한다.
- 독립 5세션의 일반 판결·동률/재투표·전원 기권과 각 결과 화면, 제공된 기권 이유만 공개·타인 접수 비공개·종료 후 새 참가자 내용 차단을 실제 API/브라우저로 확인한다.
- 320px 유죄·390px 2차 무죄 캡처 직접 확인. 이유 문자열/소수 인원으로 신원을 추론할 수 있다는 한계를 안내하며 익명성을 과장하지 않는다.
- 내부 알파와 운영 MVP를 구분한다. 연결/퇴장·다음 게임/이력·내구성·전체 E2E·실기기·외부 배포 및 #33/#36 결정/승인은 후속 범위다.
- 최종 독립 clean-source 설치·전체 check exit0: self17/workspace5/docs6/unit25/API27/DB30/browser46와 lint/layers/build/types. browser183.9초, suite210초 조정 근거와 개별 제한 유지 확인. 결과 화면·5세션 내부 알파 독립 승인, 테스트 포트 정리 확인.

## MVP-19 검증
- #18은 PR #53 병합 후 CLOSED, M3 0open/5closed 종료로 내부 알파를 확인했다.
- 안전한 기존 세션 갱신 endpoint RED 후 유효 토큰만 연장하며 누락/만료 시 신규 행·쿠키를 만들지 않도록 구현했다. 신규 신원은 명시적 시작 요청만 허용한다.
- 같은 브라우저의 유예 내 재접속은 멤버십·접수·deadline을 유지한다. 10분 이상 퇴장 처리는 #20의 범위다.
- 취소된 오래된401 통지 RED, 인증/probe 세대 경계, 실제 갱신 Set-Cookie 지연 응답 취소 회귀를 보완했다. 최초 미발급은 기존 신원 상실과 구분한다.
- 신원 상실390px 화면에서 이전 게임 내용 제거·복구 한계·명시적 시작 안내를 직접 확인했다. 실제 Back/Forward와 합성 pageshow/visibility를 구분하며 실기기 BFCache/OS 잠금 검증을 주장하지 않는다.
- 최종 독립 clean-source 설치·전체 check exit0: self17/workspace5/docs6/unit29/API30/DB30/browser51와 lint/layers/build/types. browser207.4초, 전체 suite240초이며 기존 개별 제한 유지. 소스·복귀/신원 경계·화면 독립 승인, 테스트 포트 정리 확인.

## MVP-20 검증
- #19는 PR #54 병합 후 CLOSED와 체크리스트 반영 확인.
- 멤버십에 바인딩한 퇴장 재시도, 감지 시각+600000ms 만료와 요청 전 유지보수를 구현했다. 실패 명령 rollback이 이미 효력 발생한 만료를 되돌리지 않는다.
- deadline과 피고 퇴장 효력시각의 선후/동일 및 두 monitor 순서를 검증한다. 먼저 종료한 최종 판결은 유지하며, 동률 후 피고 퇴장 시 불변 1차 결과는 저장만 보존하고 #33 공개는 보수적으로 차단한다.
- 동결 투표 집합·기존 표는 유지하며 재가입은 새 멤버십·관전자다. 같은 브라우저의 중복 참여 행을 사람 수에 중복 계산하지 않는다.
- 독립 리뷰의 maintenance/touch 서로 다른 시각 문제는 증가 시계 RED 후 요청당 captured now로 통일했다. 예전 유예 fixture는 599999ms로 옮기고 새 600000ms 거부 회귀를 추가해 검증 의도를 보존했다.
- 320px 퇴장 화면 직접 확인. 방장 공석은 정직하게 표시하며 랜덤 이양 #21·전원 퇴장 폐쇄 #22와 구분한다. 실제 10분 대기·실기기·외부/원격 CI는 주장하지 않는다.
- 최종 독립 clean-source 설치·전체 check exit0: self17/workspace5/docs6/unit31/API43/DB30/browser54와 lint/layers/build/types. browser212.6초, skip/flaky/unexpected0. 소스·시간순서·퇴장 화면 독립 승인, 테스트 포트 정리 확인.

## MVP-21 검증
- #20은 PR #55 병합 후 CLOSED와 체크리스트 반영 확인.
- 방장 퇴장 후 공석 RED에서 시작해 RandomSource 포트·crypto adapter와 트랜잭션 내 후보 선정, 만료 후 승계·공석 복귀를 구현했다. 유예 중에는 방장을 유지하며 피고/관전자도 연결 후보가 된다.
- 공유 초안·역할·동결 명단·기존 표는 승계와 독립적이며 이전 방장 복귀는 권한을 탈환하지 않는다. 후보0·동시복귀·만료/개시 경합·rollback·재개방을 검사한다.
- 독립 실제 HTTP 검토에서 끊긴 방장이 자신이 빠진 명단으로 시작 가능한 결함을 재현했다. 연결된 방장 포함 조건으로 201→409 RED/GREEN을 확인하고 heartbeat 복귀 후 4명 시작·기존 receipt 재확인 회귀를 보완했다. 잘못된 난수 반환 rollback도 검사했다.
- 390px 새 방장 화면에서 초안 보존·설정 권한·별도 역할 표시를 직접 확인했다. 전원 퇴장 폐쇄는 #22, 실제 기기·외부 배포·원격 CI #36은 미완료다.
- 최종 독립 clean-source 설치·전체 check exit0: self17/workspace5/docs6/unit31/API52/DB30/browser55와 lint/layers/build/types. 소스·방장 시작 경계·화면 독립 승인 및 포트 정리 확인. 원격 CI #36 미실행.

## MVP-22 검증
- #21은 PR #56 병합 후 CLOSED와 체크리스트 반영 확인.
- 종료 endpoint 부재 RED 후 수동/전원 퇴장 종료, 유예 인원 유지, 마지막 만료 효력시각과 마감 우선순위를 구현했다. 종료 뒤 명령은 ROOM_CLOSED로 거부하고 완료 결과는 보존한다.
- migration8로 최초 중단 원인·방 종료 기록을 불변 저장한다. 과거 원인 불명은 legacy-private으로 이전하며 created_at 대체값을 실제 중단시각으로 주장하지 않는다. #33의 피고 퇴장 공개 범위는 이후 방 종료로 넓어지지 않는다.
- 종료 재시도 소유권·마지막 표/참여 경합·중간 저장 rollback/재개방을 검사한다. UI 시험에서 중복 React key로 생긴 버튼 중복을 발견해 분리했다.
- 320px 실제 화면에서 종료·판결 없음·허용 사건만 표시되는 것을 직접 확인했다. 이력 목록·실기기·외부 배포·원격 CI는 후속/미완료다.
- 최종 독립 clean-source 설치·전체 check exit0: self17/workspace5/docs6/unit31/API63/DB32/browser58와 lint/layers/build/types. browser232.2초, failed/skipped/flaky0. 소스·종료 공개 경계·화면 독립 승인 및 포트 정리 확인. 원격 CI #36 미실행.

## MVP-23 검증
- #22는 PR #57 병합 후 CLOSED와 체크리스트 반영 확인.
- 다음 준비 endpoint 부재 RED 후 migration9 준비 세대·이전게임 marker·영속 receipt를 구현했다. 링크/멤버십 유지, 역할/피고/수락 재설정, 빈 초안과 기본3분이며 기존 게임 기록은 변경하지 않는다.
- 증가하는 draft/role/penalty revision과 역할/제외의 세대 검사로 옛 명령·같은 피고/벌칙 수락 재사용을 차단한다. 옛 start/open/vote 재확인은 현재 snapshot과 원래 receipt를 구분하고 이전 기록은 독립 상세 DTO로 조회한다.
- 실제 두 판·다른 피고·중복 클릭/응답 유실·지연된 옛 투표개시 응답을 검증했다. 390px 두 번째 결과 화면 직접 확인.
- 신규 긴 시나리오 최초15초 초과와 신규3개32.5초 측정값을 기록했다. 직전 전체232.16초에 신규 시험을 더해 suite300초로 조정하고 기존 시험/assertion 제한은 유지했다. 전체 이력 목록·실기기·외부 배포·원격 CI는 미완료다.
- 최종 독립 clean-source 설치·전체 check exit0: self17/workspace5/docs6/unit32/API69/DB33/browser61와 lint/layers/build/types. browser263.8초, failed/skipped/flaky0. 세대 격리·현재/이력 분리·화면 독립 승인 및 포트 정리 확인. 원격 CI #36 미실행.

## MVP-24 검증
- #23은 PR #58 병합 후 CLOSED와 체크리스트 반영 확인.
- 기록 endpoint 부재 RED 후 실제 게임 참여자의 서버 필터·중복 멤버십 제거·20개 keyset 페이지·개별 상세를 연결했다. 후발 관전은 포함하며 종료 후 참가·동일닉네임·다른 신원은 과거 권한을 얻지 않는다.
- private 중단은 목록 제목/snippet도 차단하고 진행 게임 상세에는 사건/상태만 제공한다. 완료 판결 null은 무판결로 날조하지 않고 기록 확인 필요로 표시하는 RED/GREEN을 보완했다.
- 실제 API/SQLite 26개 페이지와 새 항목 삽입, 두 라운드 이유, cross-room/cursor, 닫힘/퇴장·신원 만료를 검사한다. 브라우저 두 게임·reload·다른 신원·늦은 응답을 검증하고 페이지 UI fixture는 실제 21게임 수행 증거와 구분한다.
- 320px 개인 기록 화면 직접 확인. 쿠키 신원 정책과 서버 초기 무삭제/영구보관 비보장을 안내한다. migration 없음, 실제 기기·외부 배포·원격 CI는 미완료다.
- 최초 clean 전체 검사는 browser63/64에서 기존 320px 결과 우선 배치 회귀가 실패했다(y<180 기대, 실제189). 새 개인 기록 버튼이 결과를 밀어낸 결함이며 assertion을 낮추지 않고 버튼 배치를 수정 후 재검증한다. timeout이 아니며 나머지 정적/unit/API/DB gate는 통과했다.
- 수정 후 최종 독립 clean-source 설치·전체 check exit0: self17/workspace5/docs6/unit34/API76/DB33/browser64와 lint/layers/build/types. browser276.9초, failed/skipped/flaky0. 원래 y<180 유지, 최종 clone의 최신 안내문320px 캡처 독립 확인 및 포트 정리. 원격 CI #36 미실행.

## MVP-25 검증
- #24는 PR #59 병합 후 CLOSED, M4는 0open/6closed로 종료 확인.
- 종료 후 비참가자 snapshot의 이전 역할/수락 revision·편집 상태 노출과 이력 내부/외부 ID 불일치를 실제 RED 후 수정했다. 준비 단계·현재 방 정보와 이전 게임 metadata를 구분한다.
- 실제 텍스트 XSS, actor/cross-room/CSRF/입력·반복 경합을 검사한다. 임시 컴파일 복사본+합성 DB에서 정상4개 대조군 통과, 의도한 보안 assertion으로 mutant4개 검출을 unit에 포함했다. 운영/원본 소스는 변이하지 않는다.
- bounded 앱 요청 예산·Retry-After와 post-parse JSON64KiB, 기존 parser100KiB를 구분한다. proxy 공유 IP/고정 창/재시작/단일 프로세스 한계를 기록하며 DDoS 보호·배포 설정 완료를 주장하지 않는다.
- Express 동등 경로의 대소문자/끝 slash가 세부 참여 예산을 우회하는 RED도 정규화로 수정했다. migration 없고 기존 보안/네트워크 설정·인증 권한은 바꾸지 않았다.
- 최종 독립 clean-source 설치·전체 check exit0: self17/workspace5/docs6/unit39/API86/DB33/browser65와 lint/layers/build/types. unit에 대조군4/4·mutant4/4 검출 포함, browser284.6초 failed/skipped/flaky0. 독립 승인 및 포트 정리 확인. 원격 CI #36 미실행.

## MVP-26 검증
- #25는 PR #60 병합 후 CLOSED와 체크리스트 반영 확인.
- backup module 부재 RED 후 SQLite online backup·검증·동일 파일시스템 no-clobber 게시와 새 경로만 복원을 구현했다. manifest가 정상이어도 실제 table/index 누락을 허용하던 RED를 trusted in-memory schema 대조로 차단했다.
- WAL 커밋/미커밋·손상/부분파일/미래/불완전schema·symlink/경합 대상·원래 입력 보존·CLI 출력 비식별을 실제 합성 DB로 검증했다. 운영 DB/기존 서비스/권한은 바꾸지 않았다.
- 실제 usecase transaction의 쓰기 뒤 IPC 장벽에서 소유 child만 SIGKILL하고 표/정산/이양 rollback을 확인했다. 재시작 시 마감/만료 선후·동시 및 동률 중단·유예 복구를 검사했다.
- 백업을 새 DB 경로로 복원해 새 Nest 서버에서 원래 쿠키로 동일 이력을 HTTP 조회했다. 프로세스 장애는 전원손실 증거가 아니며 디스크 실제소진/디렉터리 metadata 내구성·자동 백업/암호화·운영 전환은 미실행이다.
- migration/browser 신규 없음, 실제 기기·외부 배포·원격 CI는 후속/미완료다.
- 최종 독립 clean-source 설치·전체 check exit0: self17/workspace5/docs6/unit39/API94/DB47/browser65와 lint/layers/build/types. API5.14초/DB0.485초/browser284.6초, failed/skipped/flaky0. 독립 승인 및 포트·소유 시험 child 정리 확인. 원격 CI #36 미실행.

## MVP-27 검증
- #26은 PR #61 병합 후 CLOSED와 체크리스트 반영 확인.
- 별도 gameplay gate 부재·분리 계약 RED3 후 feature65와 @e2e3을 상호배타적으로 집계한다. retries0, feature300초·E2E150초, 신규 E2E에만 실패 trace를 적용하고 실기기/외부 gate는 미구성으로 유지한다.
- 실제 UI에서 5인 일반판결→새 피고/방장 겸임→동률/최후변론/재동률 무죄→기록, 5→6인 관전/접수복구/임의승계/피고중단/전원퇴장, 3인 전원기권 기록을 연결했다. 추가 HTTP는 읽기 확인만 사용한다.
- 최초 fixture는 생성 응답 전 URL을 읽어 1failed/1interrupted/1미실행, 다음 실행은 방장 화면 동기화 전 개시 CAS409로 2failed/1passed였다. trace로 시험 동기화 오류를 확인해 수정했으며 제품 보호·assertion을 완화하지 않았다.
- 최종 targeted E2E3/3 39.8초. 320px 재동률 무죄·390px private 중단을 직접 확인했다. 실제10분·물리기기·외부 배포 증거로 확대하지 않는다. AGENTS는 검사 범위 사실 설명만 갱신했다.
- 최종 독립 clean-source 설치·전체 check exit0: self20/workspace5/docs6/unit39/API94/DB47/feature-browser65/gameplay-e2e3와 lint/layers/build/types. feature288.2초/E2E39.4초, 두 gate failed/skipped/flaky0. 최종 중단 캡처·독립 승인·포트/child 정리 확인. mobile/external NOT CONFIGURED 및 원격 CI #36 미실행 유지.

## MVP-28 부분 검증 · 실기기 차단
- #27은 PR #62 병합 후 CLOSED, M5 0open/2closed 확인.
- 읽기 전용 장치 확인에서 실행 가능한 물리 iPhone/Android를 확보하지 못했다. 라이선스/페어링/프로파일/OS 설정은 변경하지 않고 critical #63과 #28 OPEN을 유지한다.
- Chromium @mobile 별도 gate를 추가하며 실제 mobile-device는 BLOCKED로 구분한다. touch/viewport/회전/축소높이/계산폰트 확대는 실제 키보드·브라우저확대·잠금·셀룰러전환 증거가 아니다.
- 중복 닉네임 오류의 입력 aria-invalid/오류 연결 누락을 실제 RED 후 Input error+focus로 수정했다. 실제 최대 장문은 기존 wrap으로 가로 넘침이 재현되지 않아 CSS를 바꾸지 않았다.
- root font200%가 px본문을 확대하지 못한 시험 가정을 수정해 원래 computed font의2배를 직접 확인했다. 장식 로고 넘침/타이머 줄바꿈은 근사에서 경미 잔여로 기록하며 전면 접근성 합격을 주장하지 않는다.
- targeted mobile3/3 3.6초·기존 관련2/2 통과. 320px 실제 대기실 직접 확인. PR은 Refs #28이며 물리 인수 전 이슈를 닫지 않는다.
- 부분 구현 최종 독립 clean-source check exit0: self21/workspace5/docs6/unit39/API94/DB47/feature65/E2E3/mobile-emulation3와 lint/layers/build/types. feature287.8초/E2E39.5초/mobile3.8초, failed/skipped/flaky0. 최종320px·포트/child 정리 확인. 실제 mobile-device BLOCKED·external 미구성·전체인수 미완료 유지, #28/#63은 OPEN.

## MVP-29 부분 검증 · 운영 적용 차단
- #28 부분 PR #64 병합, 실기기 #28/#63 OPEN 유지.
- production entry `/` 404 RED 후 유효 WEB_ROOT startup snapshot만 같은 origin으로 제공한다. DB/비밀/로그/backup 혼입·symlink/임의 경로/누락 build를 차단하며 unknown API를 SPA200으로 가리지 않는다.
- 실제 소유 child의 HTML/asset/API/cookie/Origin, 동일 DB 재시작과 온라인 backup→새 경로restore→호환 build 재기동을 검증한다. 기존 서비스/운영 DB/설정은 변경하지 않았다.
- 템플릿 부재 RED 후 origin/포트/전용process·DB·로그를 분리한 검토용 env/Tunnel/LaunchAgent 템플릿과 운영 runbook을 추가했다. 공개 값은 placeholders이며 실제 credential/경로를 넣지 않았다.
- 읽기 전용 기존 ingress/등록만 확인했다. 제안 포트는 적용 직전 재확인이 필요하고 과거 오류/일시 listener 관측으로 현재 장애 원인을 추정하지 않는다. 실제 DNS/Tunnel/지속 프로세스 적용은 critical #65 대기다.
- FileVault/로그인/SSD/절전·logrotation·실제 운영 rollback 및 외부HTTPS는 미검증이다. PR은 Refs #29, 이슈 OPEN 유지.
- 부분 구현 최종 독립 clean-source check exit0: self21/workspace5/docs6/unit43/API96/DB47/feature65/E2E3/mobile-emulation3와 lint/layers/build/types. API5.38초/feature287.4초/E2E39.6초/mobile3.8초, failed/skipped/flaky0. 독립 승인·포트/child 정리 확인. 실기기 BLOCKED·운영 미적용·외부 미구성·전체인수 미완료 유지.

## MVP-30 부분 검증 · 외부 인수 차단
- #29 부분 PR #66 병합, 운영 적용 #29/#65 OPEN 유지.
- 검사기 부재 RED 후 외부 증거의 오프라인 형식·누락 검사를 구현했다. 빈 target은 blocked이며 주장만 있는 기록/commit 불일치/필수 관측 누락을 거부한다.
- five-player-vote 관측 kind 존재를 검사할 뿐 실제 다섯 신원이나 증거 진위를 확인하지 않는다. 완비된 합성 입력도 ready-for-independent-review 및 verified:false이며 외부 PASS가 아니다.
- 실제 네트워크 요청·추정 hostname 방문·운영 방 생성은 0회다. 빈 템플릿과 승인 후 절차만 추가하고 하네스 external-deployment를 BLOCKED로 명시한다.
- 독립 소스 검토 통과. #30/#65는 OPEN 유지하고 PR은 Refs를 사용한다.
- 부분 구현 최종 독립 clean-source check exit0: self22/workspace5/docs6/unit49/API96/DB47/feature65/E2E3/mobile-emulation3와 lint/layers/build/types. feature287.9초/E2E39.6초/mobile3.8초, failed/skipped/flaky0. 독립 승인·포트/소유 child 정리 확인. 실기기·외부 BLOCKED, 원격 CI #36 미실행, #30/#65 OPEN 유지.

## MVP-31 부분 검토 · 독립 감사 결함 수정
- #30 부분 PR #68 병합, 외부 #30/#65 OPEN 유지.
- 독립 교차 모듈 감사에서 최초 방 조회/생성 무기한 pending을 실제 Chromium으로 재현해 추가 #67을 만들었다. 최초2건 및 실제 접수 후 NETWORK_ERROR 안내 RED 후 새5개 회귀를 구현했다.
- 조회/생성/참여는6초 뒤 대기를 해제하고 닉네임을 보존한다. 자동 POST 재시도 없이 명시적 재시도만 제공하며, 이미 서버 처리됐을 수 있고 생성 재시도는 새 방을 만들 수 있음을 알린다. 생성 영속 멱등성을 추가한 것은 아니다.
- 미리보기 이동/쿠키 소실/새 신원 뒤 옛 성공 응답이 화면을 바꾸지 않는 시험도 포함한다.
- application rooms와 trial-controls는 서식만 정리하고 TypeScript5.9.3 emitted AST 동등성을 두 파일 모두 확인했다. helper/정책/호출 순서 변경 없음.
- 기존 feature65 287.9초에 실제6초 timeout회귀가 추가돼 suite예산만300→360초로 조정했다. assertion/retries/개별 한계는 완화하지 않았다. 실제 전체 결과는 후속 clean 검증에 기록한다.
- 최초 clean 전체 검사에서 feature는 실행 전 설정 오류로 실패했다. runner허용상한300초와 새360초 설정의 불일치였으며 browser실행시간0·개수null을 통과로 세지 않았다. 실제360초 설정 실행/360001거부 RED 후 runner상한을 일치시키고 자체 회귀를 추가했다. 나머지 gate 통과는 feature70 통과를 의미하지 않는다.
- 수정 후 독립 clean-source check exit0: self23/workspace5/docs6/unit49/API96/DB47/feature70/E2E3/mobile-emulation3와 lint/layers/build/types. feature308.5초/E2E40.0초/mobile3.9초, failed/skipped/flaky0. 실제 feature가 기존300초를 초과했음을 확인. 독립 소스 재리뷰·두파일 AST동등성 재확인·포트/child 정리 승인. 원격CI/실기기/외부 인수는 미완료이며 #31 OPEN 유지.

## MVP-32 부분 준비 · 최종 RC 검증 방식
- #31 부분 PR #69 병합, 실제 발견 결함 #67 CLOSED. #31 인수 선행과 #28–30은 OPEN 유지.
- 오래된 안내·검사기 부재·홈 미래 기능 문구의 RED3 후 최신 사용 가이드/인수 허브/오프라인 증거 검사를 구현했다.
- 같은 RC·clean 상태·동결/검토 시각 범위·필수 gate·실제 시험 개수·실기기/외부 분리·미해결 blocker·사용자 인수 항목의 형식 누락을 검사한다. 임의24시간 만료나 승인 자동 생성은 없으며 항상 verified:false다.
- 빈 실제 템플릿은 blocked이며 완전한 합성 입력도 ready-for-human-review까지만 가능하다. 진위/실제 배포/권한/사용자 동의를 검증했다는 주장이 아니다.
- 320px 홈 안내 직접 확인. 추적 파일을 먼저 commit하고 같은 정확한 RC의 깨끗한 checkout에서 최종 전체 검사를 실행한다. 그 뒤 보고서·실측 결과는 artifacts/PR comment로 남기고 이 문서에 성공 결과를 선기록하지 않는다.
- 원격 CI #36, 중단 공개 정책 #33, 물리기기 #63, 실제 운영/외부 #65와 사용자 최종 인수는 미완료다. #32는 준비 부분이며 전체 MVP 완료로 닫지 않는다.

## UX #71 · 모바일 설정·투표 동선
- 실제 독립3신원의320/390px 화면에서 설정저장·투표제출 버튼 위치를 측정하고 전후 합성 캡처를 보존했다.
- 설정저장 위치 RED2 후 단계 중심 배치·보조정보 disclosure·44px 이상 radio 선택으로 개선했다.320px 저장1570→745px, 제출2011→878px. 시작은 dirty혼동/DOM순서를 피하려고 설정 뒤에 유지하며2235→1460px까지만 줄였다.
- 신규3시험과 기존18대상의 첫15통과/3실패 후 관련8재검증을 구분해 기록했다. 기존 정보검증은 명시적 disclosure 펼침 후 동일assertion을 유지했다.
- 최종 정확 commit의 clean전체 검사와 독립 리뷰를 통과한 뒤에만 완료 처리한다. 실기기 검증으로 확대하지 않는다.
- 독립 검토에서90 UTF-16 위치의 이모지가 반으로 잘리는 표시 결함을 재현했다. 순수 preview helper의 실제RED 후 code point 기준 절단으로 수정, unit58/build/lint 통과. 복합 이모지의 grapheme 묶음까지 보장한다는 주장은 하지 않는다.
