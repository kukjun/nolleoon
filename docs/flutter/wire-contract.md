# Flutter 소비자용 기존 API 계약 (#159)

기준 코드: `f955209` (`origin/main`, PR #145 병합). 동반 fixture는 `contracts/flutter/wire-fixtures.json`이며 **전부 합성 데이터**다. 계약 추출과 Node 검증만 완료했다. Dart DTO/HTTP client, 기기 저장소, timeout UI, 네이티브 인증 어댑터 #162는 **아직 구현하지 않았다**. 이 문서는 현재 웹 쿠키 프로토콜을 네이티브 토큰 프로토콜로 간주하는 승인이 아니다.

## 출처와 전송 경계
- 경로/메서드: `apps/api/src/presentation/{account,travel}.controller.ts`. 전역 `/api` prefix.
- 실제 public projection: `application/account-auth.ts`, `travel-rooms.ts`, `travel-runs.ts`, `travel-*-engine.ts`.
- JSON command 검증: `presentation/commands.ts`. 현재 mutation은 정확한 configured Origin, `X-Trip-Court-Request: 1`, `application/json` 객체가 필요하다. Sec-Fetch-Site가 있으면 same-origin이어야 한다. 이 제약을 Flutter를 위해 완화하거나 임의 Origin/쿠키를 합성하지 않는다.
- 현재 인증은 HttpOnly/Secure 계정 쿠키다. session JSON에 인증 토큰/카카오 provider ID는 없다. #162가 확정되기 전 native login/refresh/logout route, bearer token, cookie 복사/추출 방법을 만들지 않는다.
- 응답은 no-store. 상태 GET도 room/run 연결 감지·기한 유지 처리를 할 수 있으므로 임의의 무한 poll이나 캐시 기반 권한 복원을 피한다.
- nullable과 생략은 다르다. 날짜는 `YYYY-MM-DD|null`, timestamp는 UTC epoch **milliseconds integer**. `version`/`revision`은 0 이상 정수이며 숫자 문자열/배열 coercion은 거절한다. 64-bit Dart int로 보관하고 double로 경유하지 않는다.

## 명시적 DTO 모양
`[]`는 배열, `?`는 optional key, `null`은 명시적 null이다. 아래 타입은 반환 projection이며 서버 내부 state/settings/할당 원본이 아니다.

```text
Session = {authenticated:false}
        | {authenticated:true,account:{id:string,displayName:string,
             presetId:'preset-01'..'preset-10',revision:int,avatar:Avatar}}
Avatar = {kind:'preset'|'image',presetId:string|null,revision:int,imageUrl:string|null}
InvitePreview = {available:true,loginRequired:true}       // 정확히 2키
Room = {roomId,title,startDate:date|null,endDate:date|null,status:'open'|'closed',
        version:int,self:{membershipId,isAdmin:bool},
        members:[{membershipId,nickname,presetId,connected:bool,isAdmin:bool}],
        activeRun:null|{runId,type,status,facilitatorMembershipId}}
RoomList = {items:[{roomId,title,startDate,endDate,status,version,isAdmin,memberCount}],
            nextCursor:string|null}
Run = {runId,roomId,type:'team'|'draw'|'trial'|'menu',
       status:'draft'|'active'|'completed'|'incomplete'|'interrupted',version:int,
       facilitatorMembershipId:string|null,selectedMembershipIds:[string],
       createdAt:int,startedAt:int|null,endedAt:int|null,isParticipant:bool,
       game:null|Team|Draw|Trial|Menu|Redacted}
History = {items:[Run],nextCursor:string|null}
Team = {kind:'team',teamCount:int,assignments:[{membershipId,team:int}]}
Draw = {kind:'draw',winnerCount:int,penaltyText:string,revealed:[{membershipId,winner:bool}],
        self:{participating:bool,revealed:bool,canReveal:bool},
        blockedPolicy:null|'departure-policy-unresolved'}
Menu = {kind:'menu',phase:'draft'|'collecting'|'completed'|'incomplete',
        self:{eligible:bool,submission:null|{kind:'pass'}|{kind:'candidate',menu:string}},
        result:null|{outcome:'no-choice'}|{outcome:'selected',menu:string}}
TrialRestricted = {kind:'trial',restricted:true,phase:null|TrialPhase}
TrialInterrupted = {kind:'trial',restricted:false,phase:'interrupted'}
Trial = TrialRestricted | TrialInterrupted | {
        kind:'trial',restricted:false,phase:TrialPhase,caseText,penaltyText,
        durationSeconds:int,defendantMembershipId,consent:'pending'|'accepted'|'rejected',
        roundNumber:1|2,deadline:int|null,submittedCount:int,
        self:{voted:bool,isDefendant:bool,vote:null|{choice,reason}},
        defenses:[{number:1|2,status:'submitted'|'skipped',text}],
        rounds:[{number:1|2,counts:{guilty:int,notGuilty:int,abstain:int},
                 reasons:[{choice:'guilty'|'not-guilty'|'abstain',reason:string}]}],
        outcome:null|'guilty'|'not-guilty'|'no-verdict'|'tie'}
TrialPhase = preparing|defense|voting|first-result|final-defense|completed|interrupted
Redacted = {kind:Run.type,redacted:true,summary:{participantCount:int,
            teams?:[{team:int,count:int}],revealed?:{winnerCount:int,notWinnerCount:int},
            rounds?:[{number:1|2,guilty:int,notGuilty:int,abstain:int,total:int}],
            responseCount?:int}}
Error = {error:{code:string,message:string}}
```

`Run.game.kind`는 envelope type과 같아야 한다. Redacted는 terminal status + null facilitator + 빈 selectedMembershipIds이며 위 숫자 키 외 추가 신원/자유글 키를 수용하지 않는다. 일반 draft/active의 null facilitator는 거절한다. `game:null`은 접근 가능한 상세가 없다는 뜻이지 전체 공개 데이터를 다른 API에서 찾아도 된다는 뜻이 아니다.

## Mutation body와 낙관적 버전
모든 아래 body는 열거한 키만 보내며 `requestId`는 `[A-Za-z0-9_-]{1,100}`다. UUID를 쓸 수 있으나 서버가 UUID만 강제하지는 않는다.

| 동작 | body | 버전 출처 |
|---|---|---|
| room create | requestId,title,startDate,endDate | 없음 |
| room PATCH | requestId,expectedVersion,title,startDate,endDate | room.version |
| status | requestId,expectedVersion,status | room.version |
| invite / revoke / leave / member remove | requestId,expectedVersion | room.version |
| administrator | requestId,expectedVersion,membershipId | room.version |
| invitation join | requestId | 없음 |
| run create | requestId,expectedVersion,type,selectedMembershipIds,settings | room.version |
| run PATCH | requestId,expectedVersion,selectedMembershipIds,settings | run.version |
| run start / cancel | requestId,expectedVersion | run.version |
| run actions | requestId,expectedVersion,command | run.version |
| account profile | expectedRevision,displayName,presetId | account.revision, requestId 없음 |
| browser login / logout | returnTo / 빈 객체 | requestId 없음 |

정확한 메서드·경로는 fixture `endpoints`에 있다. browser callback은 서버 GET 후 검증된 내부 경로로 303이며 JSON 토큰 교환 endpoint가 아니다. `returnTo`는 `/travel` 또는 `/travel/invite/[A-Za-z0-9_-]{20,128}`만 허용한다. room/history pagination cursor는 opaque 문자열로 그대로 돌려주며 숫자 offset으로 바꾸지 않는다.

### 게임별 settings / command
- team settings `{teamCount}`: 2..참가자수. start로 완료, 후속 action 없음.
- draw settings `{winnerCount,penaltyText}`: 당첨 1..참가자수, 벌칙 1..500 Unicode codepoints. command `{kind:'reveal'}`는 자기 제비만 공개한다.
- menu settings `{}`. command `{type:'submit',menu}` / `{type:'pass'}` / 진행자 `{type:'cancel'}`. 후보 80 codepoints, NFC/공백/Latin 소문자 정규화. 이미 제출한 답 수정 불가.
- trial settings `{caseText,penaltyText,durationMinutes,defendantMembershipId}`. command discriminator는 `action`이다: consent/defense/duration/begin-vote/final-defense/vote. 정확한 body 사례는 fixture `commands.actions.trial` 참조. 재판 시작은 generic start endpoint이며 `{action:'start'}`를 actions에 보내면 안 된다. 1차 동률 → 1차 결과 → 최후변론 → 2차 투표는 별개 단계다.
- 최소 참가자: team/draw/menu 2명, trial 3명. 실제 start는 연결/동의/역할 조건을 서버가 재검증한다.

## 오류, 중복 재시도, 취소
실제 wire 오류 코드는 fixture에 HTTP status와 서버 메시지까지 보존했다. `SESSION_REQUIRED`=401, `FORBIDDEN`=403, `NOT_FOUND`=404, `STATE_CONFLICT`/`DEADLINE_PASSED`=409, `ROOM_CLOSED`=410, `RATE_LIMITED`=429, `TEMPORARILY_UNAVAILABLE`=503 등이다. `ACCOUNT_REQUIRED`, `NETWORK_ERROR`, `INVALID_RESPONSE`는 현재 웹 client의 로컬 분류/대체값일 수 있으며 서버 계약 enum인 척하지 않는다.

- **초대 발급은 예외다.** POST `/api/travel-rooms/:roomId/invite`는 같은 requestId를 다시 보내면 STATE_CONFLICT이며, 이미 발급한 token을 재전송하지 않는다. 응답을 잃으면 같은 ID로 token을 복구할 수 없다. 최신 방을 다시 읽고 사용자가 새 링크 발급에 동의한 별도 의도로 새 requestId를 사용한다. 새 발급은 이전 초대를 폐기하므로 자동 재발급하지 않는다.
- 그 외 receipt 재확인을 지원하는 mutation에서 응답 유실/timeout/cancel은 실패 또는 성공을 확정하지 못한다. 동일 사용자 의도의 **동일 requestId + 동일 body/expectedVersion**으로 재확인하며, 매 재시도 새 ID를 만들지 않는다. 서버 receipt는 현재 권한 검증 후 현재 projection을 다시 줄 수 있어 byte-identical response를 기대하지 않는다.
- 같은 ID로 다른 의도를 보내면 STATE_CONFLICT. 사용자가 내용을 바꾼 새 의도는 최신 snapshot 확인 후 새 ID다. 409를 받았다고 같은 버튼을 무한 자동재시도하지 않는다.
- 현재 웹 adapter timeout=6000ms, caller AbortSignal 지원. 취소는 HTTP 요청 중단일 뿐 서버 rollback 보장이 아니다. Dart timeout/cancellation 모델은 후속 구현에서 별도로 테스트한다.
- 인증/멤버 권한 소실 시 protected state와 사진 cache를 지우고 진행중 요청의 오래된 응답을 무시해야 한다. request generation 또는 동등한 제어 필요. 오류의 임의 서버 문자열을 화면에 그대로 신뢰하지 않는다.

## Privacy / 변경하지 않은 범위
비로그인 초대 preview에는 방 이름/인원/멤버가 없다. room members에 accountId 없음. draw 미공개 배정 없음. menu 타인 후보/응답원본 없음. trial 비참가자에게 사건/변론/표/이유 공개 금지; 익명 이유에 아바타 연결 금지. redacted는 모든 작성자의 자유글과 신원 없이 숫자만. profile 사진/계정 탈퇴/휴지통/legacy 연결 endpoint는 이번 core fixture 범위 밖이며 해당 기능 구현 시 별도 확장해야 한다. 현존 endpoint를 없다는 뜻은 아니다.

## 검증 범위
Node 시험은 실제 웹 parser, 서버 room presenter, 4게임 engine projector, error presenter, requestId/version 검사에 fixture를 대조한다. synthetic uncertain-delivery retry와 caller cancellation도 검증한다. Dart 모델/SDK/실기기/카카오/실제 네이티브 HTTP 인증은 **미실행**이다. #159 전체 완료 선언이나 #162 완료를 대체하지 않는다.
