import test from 'node:test';
import assert from 'node:assert/strict';
import { presentGame } from '../../apps/api/dist/presentation/game.presenter.js';
import { assertGameAction } from '../../apps/api/dist/domain/game-access.js';
const vote={memberId:'private-voter',sessionId:'private-session',nickname:'private-name',choice:'guilty',reason:'첫 라운드 이유'};
function state(phase='voting-1') {return {id:'game',version:4,phase,caseText:'합성 사건',penaltyText:'합성 벌칙',hostMemberId:'defendant-member',roomOpen:true,deadline:180000,outcome:null,participants:[{memberId:'defendant-member',sessionId:'defendant',role:'defendant',eligible:false,connected:true,left:false,submittedRounds:[]},{memberId:'voter-member',sessionId:'voter',role:'participant',eligible:true,connected:true,left:false,submittedRounds:[]},{memberId:'observer-member',sessionId:'observer',role:'observer',eligible:false,connected:true,left:false,submittedRounds:[]}],rounds:[{number:1,closed:false,resolution:null,counts:{guilty:1,notGuilty:0,abstain:0},votes:[vote]}]};}
test('진행 라운드는 피고·방장도 집계·이유·타인 신원을 받지 못한다',()=>{
 for(const actor of ['defendant','voter','observer']) {
  const dto=presentGame(state(),actor);const json=JSON.stringify(dto);
  for(const secret of ['private-voter','private-session','private-name','첫 라운드 이유','counts','tokenHash'])assert.ok(!json.includes(secret));
  assert.deepEqual(dto.publishedRounds,[]);
 }
 assert.throws(()=>presentGame(state(),'outsider'),e=>e.code==='FORBIDDEN');
});
test('방장=피고의 관리권과 피고 투표 금지를 분리한다',()=>{
 const s=state();assert.ok(!presentGame(s,'defendant').actions.includes('submit-vote'));
 assert.ok(presentGame(s,'defendant').actions.includes('close-room'));
 assert.ok(presentGame(s,'voter').actions.includes('submit-vote'));
 assert.deepEqual(presentGame(s,'observer').actions,[]);
 assert.throws(()=>assertGameAction(s,'defendant','submit-vote'),e=>e.code==='FORBIDDEN');
 s.participants[1].left=true;assert.throws(()=>assertGameAction(s,'voter','submit-vote'),e=>e.code==='FORBIDDEN');
});
test('첫 동률 공개는 2차 중에도 유지하되 진행 중 2차는 숨긴다',()=>{
 const s=state('voting-2');s.rounds[0].closed=true;s.rounds[0].resolution='tie';s.rounds.push({number:2,closed:false,resolution:null,counts:{guilty:2,notGuilty:0,abstain:0},votes:[{...vote,reason:'비밀 2차 이유'}]});
 const dto=presentGame(s,'observer');assert.equal(dto.publishedRounds.length,1);assert.equal(dto.publishedRounds[0].reasons[0].reason,'첫 라운드 이유');assert.ok(!JSON.stringify(dto).includes('비밀 2차 이유'));assert.ok(!JSON.stringify(dto).includes('private-'));
 s.phase='result';s.outcome='guilty';s.rounds[1].closed=true;s.rounds[1].resolution='guilty';assert.equal(presentGame(s,'observer').publishedRounds.length,2);
});
test('중단 노출은 방 종료만 사건 내용 허용, 미정 사유는 최소 상태만',()=>{
 const s=state('interrupted');s.interruption='defendant-left';assert.deepEqual(presentGame(s,'observer'),{phase:'interrupted',actions:[]});
 s.interruption='room-closed';assert.deepEqual(presentGame(s,'observer'),{phase:'interrupted',caseText:'합성 사건',actions:[]});
});
test('방장 관전자도 관리만 가능하고 이탈자의 기록과 명령 권한은 다르다',()=>{
 const s=state('defense');s.hostMemberId='observer-member';assert.ok(presentGame(s,'observer').actions.includes('start-vote'));assert.ok(!presentGame(s,'observer').actions.includes('submit-defense'));
 s.phase='result';s.rounds[0].closed=true;s.rounds[0].resolution='guilty';s.outcome='guilty';s.participants[1].left=true;
 assert.equal(presentGame(s,'voter').publishedRounds.length,1);assert.deepEqual(presentGame(s,'voter').actions,[]);
 s.phase='voting-1';s.participants.push({memberId:'rejoin',sessionId:'voter',role:'observer',eligible:false,connected:true,left:false,submittedRounds:[]});
 assert.equal(presentGame(s,'voter').self.role,'observer');assert.ok(!presentGame(s,'voter').actions.includes('submit-vote'));
});
test('만료된 action 목록은 명령 권한이 아니며 최신 version·제출 상태로 재검사한다',()=>{
 const s=state();assertGameAction(s,'voter','submit-vote',4);const old=presentGame(s,'voter').actions;assert.ok(old.includes('submit-vote'));
 s.version=5;assert.throws(()=>assertGameAction(s,'voter','submit-vote',4),e=>e.code==='STATE_CONFLICT');
 s.participants[1].submittedRounds=[1];assert.throws(()=>assertGameAction(s,'voter','submit-vote',5),e=>e.code==='FORBIDDEN');
 s.phase='interrupted';assert.throws(()=>presentGame(s,'outsider'),e=>e.code==='FORBIDDEN');
});
test('무판결에서도 작성한 기권 이유만 공개하고 메타데이터는 제거한다',()=>{
 const s=state('result');s.outcome='no-verdict';s.rounds[0]={number:1,closed:true,resolution:'no-verdict',counts:{guilty:0,notGuilty:0,abstain:3,internalSecret:'private-count'},votes:[{...vote,choice:'abstain',reason:'판단이 어려워요',submittedAt:1234,tokenHash:'private-token'},{...vote,choice:'abstain',reason:''}]};
 const dto=presentGame(s,'observer');assert.equal(dto.verdict,'no-verdict');assert.deepEqual(dto.publishedRounds,[{number:1,counts:{guilty:0,notGuilty:0,abstain:3},reasons:[{choice:'abstain',reason:'판단이 어려워요'}]}]);
});
test('동일 신원의 복수 활성 멤버십은 임의로 고르지 않고 거절한다',()=>{
 const s=state();s.participants.push({...s.participants[1],memberId:'new-member',role:'observer',eligible:false});
 assert.throws(()=>presentGame(s,'voter'),e=>e.code==='STATE_CONFLICT');
 assert.throws(()=>assertGameAction(s,'outsider','submit-vote',-1),e=>e.code==='FORBIDDEN');
});
