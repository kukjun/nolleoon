import test from 'node:test';import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';
import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';
async function finish(f){const gameId=f.s.game.gameId;await f.post(`games/${gameId}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'next-first-opening'});for(let i=1;i<3;i++)await f.post(`games/${gameId}/vote`,f.cookies[i],{roundNumber:1,requestId:`next-first-vote-${i}`,choice:'abstain',reason:''});return await(await f.post('heartbeat',f.cookies[0],{})).json();}

test('다음 준비는 같은 방·참가자를 보존하고 초안·피고·동의는 새 세대로 초기화한다',async()=>{
 const f=await votingFixture();let db;try{
  const ended=await finish(f);const intent={requestId:'next-preparation-001',fromGameId:ended.game.gameId,expectedPreparationVersion:0};
  const res=await f.post('next-game',f.cookies[0],intent);assert.equal(res.status,201);const result=await res.json();const next=result.snapshot;
  assert.equal(next.preparationVersion,1);assert.equal(next.game,null);assert.equal(next.draft.caseText,'');assert.equal(next.draft.penaltyText,'');assert.equal(next.draft.durationMinutes,3);assert.ok(next.members.every(m=>m.role==='participant'));assert.equal(next.consent.status,'pending');assert.equal(next.roomId,ended.roomId);assert.deepEqual(next.members.map(m=>m.memberId),ended.members.map(m=>m.memberId));assert.ok(next.roleRevision>ended.roleRevision);assert.ok(next.consent.penaltyRevision>ended.consent.penaltyRevision);assert.ok(next.draft.version>ended.draft.version);
  const repeated=await(await f.post('next-game',f.cookies[0],intent)).json();assert.deepEqual(repeated.receipt,result.receipt);assert.equal(repeated.snapshot.preparationVersion,1);
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT COUNT(*) n FROM games').get().n,1);assert.equal(db.prepare('SELECT case_text FROM games').get().case_text,'사건');
 }finally{db?.close();await f.close();}
});

async function prepareSecond(f,ended){return await(await f.post('next-game',f.cookies[0],{requestId:'next-preparation-002',fromGameId:ended.game.gameId,expectedPreparationVersion:0})).json();}
async function secondStart(f,next){
 let snapshot=await(await f.post('role',f.cookies[1],{role:'defendant',expectedPreparationVersion:next.preparationVersion})).json();
 snapshot=await(await f.post('settings',f.cookies[0],{expectedVersion:snapshot.draft.version,caseText:'새 사건',penaltyText:'벌칙',durationMinutes:3})).json();
 snapshot=await(await f.post('consent',f.cookies[1],{roleRevision:snapshot.roleRevision,penaltyRevision:snapshot.consent.penaltyRevision,expectedDecisionVersion:snapshot.consent.decisionVersion,decision:'accepted'})).json();
 return await(await f.post('start',f.cookies[0],{requestId:'second-game-start001',expectedDraftVersion:snapshot.draft.version,expectedRoleRevision:snapshot.roleRevision,expectedDecisionVersion:snapshot.consent.decisionVersion})).json();
}

test('두 판은 재입장 없이 다른 피고로 완료하며 옛 명령과 receipt가 새 화면·데이터를 되돌리지 않는다',async()=>{
 const f=await votingFixture();let db;try{
  const first=await finish(f);const oldGame=first.game.gameId;const next=(await prepareSecond(f,first)).snapshot;
  assert.equal((await f.post('role',f.cookies[2],{role:'defendant'})).status,409);
  assert.equal((await f.post('exclude',f.cookies[0],{memberId:first.members.find(m=>m.nickname==='친구2').memberId,expectedPreparationVersion:0})).status,409);
  assert.equal((await f.post('settings',f.cookies[0],{expectedVersion:first.draft.version,caseText:'옛 저장',penaltyText:'벌칙',durationMinutes:3})).status,409);
  const second=await secondStart(f,next);assert.notEqual(second.game.gameId,oldGame);assert.equal(second.historyGameId,oldGame);assert.equal(second.game.self.role,'participant');assert.equal(second.game.voterCount,2);
  const oldStart=await(await f.post('start',f.cookies[0],{requestId:'progress-start-0001',expectedDraftVersion:1,expectedRoleRevision:first.roleRevision,expectedDecisionVersion:1})).json();assert.equal(oldStart.game.gameId,second.game.gameId);
  const oldOpen=await(await f.post(`games/${oldGame}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'next-first-opening'})).json();assert.equal(oldOpen.game.gameId,second.game.gameId);
  const oldVote=await(await f.post(`games/${oldGame}/vote`,f.cookies[2],{roundNumber:1,requestId:'next-first-vote-2',choice:'abstain',reason:''})).json();assert.equal(oldVote.receipt.gameId,oldGame);assert.equal(oldVote.snapshot.game.gameId,second.game.gameId);assert.equal(oldVote.snapshot.game.ownVote,null);
  assert.equal((await f.post(`games/${oldGame}/defense`,f.cookies[0],{roundNumber:1,expectedVersion:0,action:'submit',text:'옛 변론'})).status,409);
  const path=`games/${second.game.gameId}`;await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'second-game-open01'});
  for(const i of [0,2])await f.post(`${path}/vote`,f.cookies[i],{roundNumber:1,requestId:`second-game-vote-${i}`,choice:'guilty',reason:'새 판단'});
  const final=await(await f.post('heartbeat',f.cookies[0],{})).json();assert.equal(final.game.settlement.outcome,'guilty');assert.equal(final.game.caseText,'새 사건');
  const history=await(await fetch(`${f.url}/games/${oldGame}`,{headers:{cookie:f.cookies[0]}})).json();assert.equal(history.game.caseText,'사건');assert.equal(history.game.settlement.outcome,'no-verdict');assert.equal('draft'in history,false);
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT COUNT(*) n FROM games').get().n,2);assert.equal(db.prepare('SELECT COUNT(*) n FROM room_members').get().n,3);
 }finally{db?.close();await f.close();}
});

test('중복 다음 준비는 한 번만 초기화하고 같은 피고·벌칙도 이전 동의를 되살리지 않는다',async()=>{
 const f=await votingFixture();let db;try{
  const first=await finish(f);const input={requestId:'duplicate-next-game',fromGameId:first.game.gameId,expectedPreparationVersion:0};
  const results=await Promise.all([f.post('next-game',f.cookies[0],input),f.post('next-game',f.cookies[0],input)]);assert.deepEqual(results.map(r=>r.status),[201,201]);let next=(await results[0].json()).snapshot;
  assert.equal((await f.post('next-game',f.cookies[0],{...input,requestId:'different-next-game'})).status,409);assert.equal((await f.post('next-game',f.cookies[1],input)).status,403);
  next=await(await f.post('role',f.cookies[0],{role:'defendant',expectedPreparationVersion:1})).json();next=await(await f.post('settings',f.cookies[0],{expectedVersion:next.draft.version,caseText:'사건',penaltyText:'벌칙',durationMinutes:3})).json();assert.equal(next.consent.status,'pending');
  assert.equal((await f.post('consent',f.cookies[0],{roleRevision:first.roleRevision,penaltyRevision:first.consent.penaltyRevision,expectedDecisionVersion:first.consent.decisionVersion,decision:'accepted'})).status,409);
  const blocked=await f.post('start',f.cookies[0],{requestId:'stale-consent-start',expectedDraftVersion:next.draft.version,expectedRoleRevision:next.roleRevision,expectedDecisionVersion:next.consent.decisionVersion});assert.equal(blocked.status,409);
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT COUNT(*) n FROM next_preparation_receipts').get().n,1);assert.equal(db.prepare('SELECT preparation_version n FROM rooms').get().n,1);
 }finally{db?.close();await f.close();}
});

test('세 번째 준비 뒤 첫 next 재시도는 옛 receipt만 재확인하고 현재 초안을 초기화하지 않는다',async()=>{
 const f=await votingFixture();try{
  const ended=await finish(f);const firstIntent={requestId:'next-preparation-002',fromGameId:ended.game.gameId,expectedPreparationVersion:0};const firstNext=(await prepareSecond(f,ended)).snapshot;const second=await secondStart(f,firstNext);
  await f.post(`games/${second.game.gameId}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'third-prep-opening'});
  for(const i of [0,2])await f.post(`games/${second.game.gameId}/vote`,f.cookies[i],{roundNumber:1,requestId:`third-prep-vote-${i}`,choice:'abstain',reason:''});
  const third=(await(await f.post('next-game',f.cookies[0],{requestId:'third-preparation01',fromGameId:second.game.gameId,expectedPreparationVersion:1})).json()).snapshot;
  const saved=await(await f.post('settings',f.cookies[0],{expectedVersion:third.draft.version,caseText:'세 번째 작성 중',penaltyText:'다른 벌칙',durationMinutes:5})).json();
  const replay=await(await f.post('next-game',f.cookies[0],firstIntent)).json();assert.equal(replay.receipt.preparationVersion,1);assert.equal(replay.snapshot.preparationVersion,2);assert.deepEqual(replay.snapshot.draft,saved.draft);
  assert.equal((await f.post('next-game',f.cookies[0],{...firstIntent,fromGameId:second.game.gameId})).status,409);
 }finally{await f.close();}
});

test('중단 다음 준비도 이전 비공개 원인을 보존하며 닫힌 방과 비방장은 새 준비를 못 만든다',async()=>{
 const f=await votingFixture(1);let db;try{
  const defendant=f.s.members.find(m=>m.role==='defendant').memberId;await f.post('leave',f.cookies[1],{expectedMemberId:defendant});
  const input={requestId:'interrupted-next01',fromGameId:f.s.game.gameId,expectedPreparationVersion:0};assert.equal((await f.post('next-game',f.cookies[2],input)).status,403);
  const prepared=await(await f.post('next-game',f.cookies[0],input)).json();assert.equal(prepared.snapshot.interrupted,false);assert.equal(prepared.snapshot.game,null);
  const detail=await(await fetch(`${f.url}/games/${f.s.game.gameId}`,{headers:{cookie:f.cookies[0]}})).json();assert.equal(detail.interrupted,true);assert.deepEqual(detail.interruption,{caseText:null});
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT cause FROM game_interruptions').get().cause,'defendant-left');
  await f.post('close',f.cookies[0],{expectedMemberId:f.s.self.memberId});assert.equal((await f.post('next-game',f.cookies[0],{...input,requestId:'closed-new-next01'})).status,410);
 }finally{db?.close();await f.close();}
});

test('서로 다른 다음 요청 경합은 한 준비만 만들고 옛 마감은 새 게임을 건드리지 않는다',async()=>{
 const f=await votingFixture();let db;try{
  const first=await finish(f);const base={fromGameId:first.game.gameId,expectedPreparationVersion:0};const responses=await Promise.all([f.post('next-game',f.cookies[0],{...base,requestId:'parallel-next-0001'}),f.post('next-game',f.cookies[0],{...base,requestId:'parallel-next-0002'})]);assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);const prepared=(await responses.find(r=>r.status===201).json()).snapshot;
  const second=await secondStart(f,prepared);f.setNow(first.game.round.deadline);const recovered=await(await f.post('heartbeat',f.cookies[0],{})).json();assert.equal(recovered.game.gameId,second.game.gameId);assert.equal(recovered.game.status,'defense');assert.equal(recovered.game.round,null);
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT COUNT(*) n FROM next_preparation_receipts').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM round_settlements').get().n,1);
 }finally{db?.close();await f.close();}
});
