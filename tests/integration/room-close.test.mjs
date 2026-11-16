import test from 'node:test';import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';
import {openSqlite,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {Rooms} from '../../apps/api/dist/application/rooms.js';
import {SecureTokens} from '../../apps/api/dist/infrastructure/sessions/secure-tokens.js';
import {firstCandidateRandom} from '../support/fakes.mjs';

test('방장 종료는 판결 없이 중단하고 사건만 공개하며 닫힌 방 명령을 거절한다',async()=>{
 const f=await votingFixture(1);let db;try{
  assert.equal((await f.post('close',f.cookies[2],{expectedMemberId:f.s.self.memberId})).status,403);
  const response=await f.post('close',f.cookies[0],{expectedMemberId:f.s.self.memberId});assert.equal(response.status,201);
  const closed=await response.json();assert.equal(closed.closed,true);assert.equal(closed.game,null);assert.equal(closed.interrupted,true);assert.deepEqual(closed.interruption,{caseText:'사건'});assert.equal(closed.draft.penaltyText,'');
  assert.equal((await f.post('close',f.cookies[0],{expectedMemberId:f.s.self.memberId})).status,201);
  assert.equal((await f.post('join',f.cookies[2],{nickname:'재입장'})).status,410);
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT status FROM rooms').get().status,'closed');assert.equal(db.prepare('SELECT COUNT(*) n FROM round_settlements').get().n,0);
 }finally{db?.close();await f.close();}
});

test('피고 퇴장으로 먼저 중단된 원인은 나중 방 종료가 공개 허가로 바꾸지 않는다',async()=>{
 const f=await votingFixture(1);let db;try{
  const defendant=f.s.members.find(m=>m.role==='defendant').memberId;
  await f.post('leave',f.cookies[1],{expectedMemberId:defendant});
  const closed=await(await f.post('close',f.cookies[0],{expectedMemberId:f.s.self.memberId})).json();assert.equal(closed.closed,true);assert.equal(closed.interrupted,true);assert.equal(closed.interruption.caseText,null);assert.equal(closed.game,null);
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT cause FROM game_interruptions').get().cause,'defendant-left');
 }finally{db?.close();await f.close();}
});

for(const timing of ['before','equal','after'])test(`종료와 마감 시간 순서 ${timing}는 중단과 최종 결과를 구분한다`,async()=>{
 const f=await votingFixture(1);let db;try{
  const path=`games/${f.s.game.gameId}`;const opened=await(await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'close-time-opening'})).json();
  f.setNow(opened.game.round.deadline+(timing==='before'?-1:timing==='after'?1:0));
  const snapshot=await(await f.post('close',f.cookies[0],{expectedMemberId:f.s.self.memberId})).json();assert.equal(snapshot.closed,true);
  db=openSqlite(f.dbPath);
  if(timing==='before'){assert.equal(snapshot.game,null);assert.deepEqual(snapshot.interruption,{caseText:'사건'});assert.equal(db.prepare('SELECT COUNT(*) n FROM round_settlements').get().n,0);}else{assert.equal(snapshot.game.status,'result');assert.equal(snapshot.game.settlement.outcome,'no-verdict');assert.equal(snapshot.interruption,null);}
  new Rooms(new SqliteUnitOfWork(db),{now:()=>999999},new SecureTokens(),firstCandidateRandom).sweep();assert.equal(db.prepare('SELECT status FROM games').get().status,timing==='before'?'interrupted':'result');
 }finally{db?.close();await f.close();}
});

test('유예 멤버가 하나라도 있으면 열려 있고 마지막 만료로 한 번만 닫힌다',async()=>{
 const f=await votingFixture();let db;try{
  db=openSqlite(f.dbPath);const uow=new SqliteUnitOfWork(db);let now=1000;const rooms=new Rooms(uow,{now:()=>now},new SecureTokens(),firstCandidateRandom);
  const members=db.prepare('SELECT id,session_id sessionId FROM room_members ORDER BY rowid').all();
  rooms.leave({id:members[0].sessionId},f.s.inviteCode,members[0].id);rooms.leave({id:members[1].sessionId},f.s.inviteCode,members[1].id);
  db.prepare('UPDATE room_members SET disconnected_at=1000 WHERE id=?').run(members[2].id);now=600999;rooms.sweep();assert.equal(db.prepare('SELECT status FROM rooms').get().status,'open');
  now=601000;rooms.sweep();assert.equal(db.prepare('SELECT status FROM rooms').get().status,'closed');assert.equal(db.prepare('SELECT closed_at FROM room_closures').get().closed_at,601000);
  const version=db.prepare('SELECT version FROM rooms').get().version;rooms.sweep();assert.equal(db.prepare('SELECT version FROM rooms').get().version,version);
  assert.equal(rooms.read({id:members[0].sessionId},f.s.inviteCode).interruption.caseText,null);
  f.setNow(now);assert.equal((await f.post('join',f.cookies[2],{nickname:'같은 이름'})).status,410);
 }finally{db?.close();await f.close();}
});

test('마지막 명시적 퇴장은 즉시 닫고 퇴장 재확인은 닫힌 방도 새 변화를 만들지 않는다',async()=>{
 const f=await votingFixture();let db;try{
  for(let i=0;i<3;i++){const member=f.s.members.find(m=>m.nickname===(i===0?'방장':`친구${i}`)).memberId;assert.equal((await f.post('leave',f.cookies[i],{expectedMemberId:member})).status,201);}
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT status FROM rooms').get().status,'closed');const version=db.prepare('SELECT version FROM rooms').get().version;
  assert.equal((await f.post('leave',f.cookies[0],{expectedMemberId:f.s.self.memberId})).status,201);assert.equal(db.prepare('SELECT version FROM rooms').get().version,version);
 }finally{db?.close();await f.close();}
});

test('종료 전 완료 결과는 참가자에게 보존하지만 종료 후 방 가입 이력만 가진 신원은 볼 수 없다',async()=>{
 const f=await votingFixture(1);let db;try{
  const path=`games/${f.s.game.gameId}`;await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'close-result-open'});
  for(const i of [0,2])await f.post(`${path}/vote`,f.cookies[i],{roundNumber:1,requestId:`close-result-vote-${i}`,choice:'guilty',reason:'완료 이유'});
  // 게임 종료 뒤 새 신원은 방에만 참여한다.
  const origin=new URL(f.url).origin;const issued=await fetch(`${origin}/api/session`,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1'},body:'{}'});const lateCookie=issued.headers.get('set-cookie').split(';')[0];await f.post('join',lateCookie,{nickname:'늦은 입장'});
  const closed=await(await f.post('close',f.cookies[0],{expectedMemberId:f.s.self.memberId})).json();assert.equal(closed.game.settlement.outcome,'guilty');assert.equal(closed.game.publishedRounds[0].reasons.length,2);
  const late=await(await f.post('heartbeat',lateCookie,{})).json();assert.equal(late.closed,true);assert.equal(late.game,null);assert.equal(late.draft.caseText,'');assert.equal(late.interruption,null);
  // 실제 과거 참가자는 떠난 멤버십으로도 완료 게임을 읽을 수 있다.
  db=openSqlite(f.dbPath);db.prepare('UPDATE room_members SET left_at=2000 WHERE session_id=(SELECT session_id FROM room_members WHERE nickname=?)').run('친구2');
  const prior=await(await f.post('heartbeat',f.cookies[2],{})).json();assert.equal(prior.game.settlement.outcome,'guilty');assert.deepEqual(prior.members,[]);
 }finally{db?.close();await f.close();}
});

for(const first of ['close','vote'])test(`마지막 표와 방 종료 경합: ${first} 요청 우선`,async()=>{
 const f=await votingFixture(1);let db;try{
  const path=`games/${f.s.game.gameId}`;await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'close-race-opening'});
  await f.post(`${path}/vote`,f.cookies[0],{roundNumber:1,requestId:'close-race-first-vote',choice:'guilty',reason:'먼저 접수'});
  const close=()=>f.post('close',f.cookies[0],{expectedMemberId:f.s.self.memberId});const vote=()=>f.post(`${path}/vote`,f.cookies[2],{roundNumber:1,requestId:'close-race-last-vote',choice:'guilty',reason:'마지막 접수'});
  const responses=await Promise.all(first==='close'?[close(),vote()]:[vote(),close()]);const voteResponse=responses[first==='close'?1:0];assert.ok([201,410].includes(voteResponse.status));
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT status FROM rooms').get().status,'closed');const game=db.prepare('SELECT status FROM games').get();
  if(voteResponse.status===201){assert.equal(game.status,'result');assert.equal(db.prepare('SELECT outcome FROM round_settlements').get().outcome,'guilty');}else{assert.equal(game.status,'interrupted');assert.equal(db.prepare('SELECT COUNT(*) n FROM round_settlements').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM votes').get().n,1);}
 }finally{db?.close();await f.close();}
});

test('닫기와 후발 참여 경합은 승인된 게임 참여만 기록하고 닫힌 뒤 재입장은 막는다',async()=>{
 const f=await votingFixture(1);let db;try{
  const origin=new URL(f.url).origin;const issued=await fetch(`${origin}/api/session`,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1'},body:'{}'});const cookie=issued.headers.get('set-cookie').split(';')[0];
  const [closed,joined]=await Promise.all([f.post('close',f.cookies[0],{expectedMemberId:f.s.self.memberId}),f.post('join',cookie,{nickname:'경합 참여'})]);assert.equal(closed.status,201);assert.ok([201,410].includes(joined.status));
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT COUNT(*) n FROM game_participants').get().n,joined.status===201?4:3);
  assert.equal((await f.post('join',cookie,{nickname:'재시도'})).status,410);const read=await fetch(f.url,{headers:{cookie}});
  if(joined.status===201){const snapshot=await read.json();assert.deepEqual(snapshot.interruption,{caseText:'사건'});}else{assert.equal(read.status,410);assert.equal((await read.json()).error.code,'ROOM_CLOSED');}
 }finally{db?.close();await f.close();}
});
