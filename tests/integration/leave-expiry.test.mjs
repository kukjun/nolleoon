import test from 'node:test';
import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';
import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';

test('나가기 재시도는 원래 멤버십에 고정되어 새 참여를 퇴장시키지 않는다',async()=>{
 const f=await votingFixture();let db;try{
  const original=await(await f.post('heartbeat',f.cookies[1],{})).json();
  const body={expectedMemberId:original.self.memberId};
  assert.equal((await f.post('leave',f.cookies[2],body)).status,403);
  const left=await f.post('leave',f.cookies[1],body);assert.equal(left.status,201);
  assert.deepEqual(await left.json(),{left:true,memberId:body.expectedMemberId});
  const rejoined=await(await f.post('join',f.cookies[1],{nickname:'친구1'})).json();
  assert.notEqual(rejoined.self.memberId,body.expectedMemberId);assert.equal(rejoined.game.self.role,'observer');assert.equal(rejoined.game.participantCount,original.game.participantCount);
  assert.equal((await f.post('leave',f.cookies[1],body)).status,201);
  assert.equal((await f.post('heartbeat',f.cookies[1],{})).status,201);
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT COUNT(*) n FROM room_members WHERE left_at IS NOT NULL').get().n,1);
 }finally{db?.close();await f.close();}
});

test('600000ms 경계 만료는 거절 응답에도 커밋되며 늦은 heartbeat가 부활시키지 않는다',async()=>{
 const f=await votingFixture();let db;try{
  db=openSqlite(f.dbPath);const member=(await(await f.post('heartbeat',f.cookies[1],{})).json()).self.memberId;
  db.prepare('UPDATE room_members SET disconnected_at=1000 WHERE id=?').run(member);
  f.setNow(600999);assert.equal((await f.post('heartbeat',f.cookies[1],{})).status,201);
  db.prepare('UPDATE room_members SET disconnected_at=1000 WHERE id=?').run(member);
  f.setNow(601000);assert.equal((await f.post('heartbeat',f.cookies[1],{})).status,403);
  assert.equal(db.prepare('SELECT left_at at FROM room_members WHERE id=?').get(member).at,601000);
  const joined=await(await f.post('join',f.cookies[1],{nickname:'친구1'})).json();assert.notEqual(joined.self.memberId,member);assert.equal(joined.game.self.role,'observer');
 }finally{db?.close();await f.close();}
});

import {Rooms} from '../../apps/api/dist/application/rooms.js';
import {SettleRounds} from '../../apps/api/dist/application/settle-round.js';
import {SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
for(const order of ['presence-first','settlement-first'])for(const timing of ['before','equal','after']){
 test(`피고 만료와 마감 시간순 처리: ${order}/${timing}`,async()=>{
  const f=await votingFixture(0,4,10);let db;try{
   const gameId=f.s.game.gameId;const path=`games/${gameId}`;
   const opened=await(await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'expiry-open-000001'})).json();
   await f.post(`${path}/vote`,f.cookies[1],{roundNumber:1,requestId:'expiry-vote-000001',choice:'guilty',reason:'첫 이유'});
   await f.post(`${path}/vote`,f.cookies[2],{roundNumber:1,requestId:'expiry-vote-000002',choice:'not-guilty',reason:'반대 이유'});
   db=openSqlite(f.dbPath);const deadline=opened.game.round.deadline;
   const effective=deadline+(timing==='before'?-1:timing==='after'?1:0);
   const defendant=f.s.members.find(m=>m.role==='defendant').memberId;
   db.prepare('UPDATE room_members SET disconnected_at=? WHERE id=?').run(effective-600000,defendant);
   const clock={now:()=>deadline+10000};const uow=new SqliteUnitOfWork(db);
   const presence=new Rooms(uow,clock,{});const settlement=new SettleRounds(uow,clock);
   for(const worker of order==='presence-first'?[presence,settlement]:[settlement,presence])worker.sweep();
   assert.equal(db.prepare('SELECT status FROM games WHERE id=?').get(gameId).status,'interrupted');
   const row=db.prepare('SELECT * FROM round_settlements WHERE game_id=?').get(gameId);
   if(timing==='before')assert.equal(row,undefined);else{assert.equal(row.outcome,'tie');assert.equal(row.closed_at,deadline);}
   assert.equal(db.prepare('SELECT deadline FROM rounds WHERE game_id=?').get(gameId).deadline,deadline);
   assert.equal(db.prepare('SELECT COUNT(*) n FROM votes WHERE game_id=?').get(gameId).n,2);
   const v=db.prepare('SELECT version FROM rooms').get().version;presence.sweep();settlement.sweep();assert.equal(db.prepare('SELECT version FROM rooms').get().version,v);
   f.setNow(deadline+10000);const snapshot=await(await f.post('heartbeat',f.cookies[1],{})).json();assert.equal(snapshot.interrupted,true);assert.equal(snapshot.game,null);assert.equal(snapshot.draft.caseText,'');assert.equal(snapshot.draft.penaltyText,'');
  }finally{db?.close();await f.close();}
 });
}

test('단절만으로 중단하지 않으며 제출자 퇴장 후에도 표와 고정 분모를 보존한다',async()=>{
 const f=await votingFixture(0,3,10);let db;try{
  const path=`games/${f.s.game.gameId}`;const opened=await(await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'leave-voter-open-01'})).json();
  await f.post(`${path}/vote`,f.cookies[1],{roundNumber:1,requestId:'leave-voter-vote-01',choice:'guilty',reason:'남겨 둘 표'});
  db=openSqlite(f.dbPath);const cohort=db.prepare('SELECT * FROM game_participants ORDER BY member_id').all();
  const member=opened.members.find(m=>m.nickname==='친구1').memberId;
  await f.post('leave',f.cookies[1],{expectedMemberId:member});
  f.setNow(16000);new Rooms(new SqliteUnitOfWork(db),{now:()=>16000},{}).sweep();assert.equal(db.prepare('SELECT status FROM games').get().status,'voting');
  f.setNow(opened.game.round.deadline);new SettleRounds(new SqliteUnitOfWork(db),{now:()=>opened.game.round.deadline}).sweep();
  const result=db.prepare('SELECT * FROM round_settlements').get();assert.equal(result.total,2);assert.equal(result.guilty,1);assert.equal(result.abstain,1);assert.equal(result.outcome,'guilty');assert.deepEqual(db.prepare('SELECT * FROM game_participants ORDER BY member_id').all(),cohort);assert.equal(db.prepare('SELECT COUNT(*) n FROM votes').get().n,1);
 }finally{db?.close();await f.close();}
});

test('마감과 같은 시각의 명시적 피고 퇴장은 먼저 확정된 최종 결과를 중단시키지 않는다',async()=>{
 const f=await votingFixture();let db;try{
  const path=`games/${f.s.game.gameId}`;const opened=await(await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'deadline-leave-open'})).json();
  f.setNow(opened.game.round.deadline);const response=await f.post('leave',f.cookies[0],{expectedMemberId:opened.self.memberId});assert.equal(response.status,201);
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT status FROM games').get().status,'result');assert.equal(db.prepare('SELECT outcome FROM round_settlements').get().outcome,'no-verdict');assert.equal(db.prepare('SELECT host_member_id FROM rooms').get().host_member_id,null);
  const remaining=await(await f.post('heartbeat',f.cookies[1],{})).json();assert.equal(remaining.game.status,'result');assert.ok(remaining.members.every(m=>!m.isHost));assert.equal(remaining.interrupted,false);
 }finally{db?.close();await f.close();}
});

test('만료된 피고의 직접 명령은 중단을 커밋하고 변론·시간·투표를 만들지 않는다',async()=>{
 for(const action of ['defense','duration','open-vote','vote','consent','role','settings']){
  const f=await votingFixture();let db;try{
   db=openSqlite(f.dbPath);const member=f.s.self.memberId;
   db.prepare('UPDATE room_members SET disconnected_at=1000 WHERE id=?').run(member);f.setNow(601000);
   const bodies={defense:{roundNumber:1,expectedVersion:0,action:'submit',text:'지연변론'},duration:{expectedVersion:0,durationMinutes:5},'open-vote':{roundNumber:1,expectedVersion:0,requestId:'expired-direct-open'},vote:{roundNumber:1,requestId:'expired-direct-vote',choice:'abstain',reason:''},consent:{roleRevision:f.s.roleRevision,penaltyRevision:f.s.consent.penaltyRevision,expectedDecisionVersion:f.s.consent.decisionVersion,decision:'accepted'},role:{role:'participant'},settings:{expectedVersion:1,caseText:'변조',penaltyText:'변조',durationMinutes:3}};
   const route=['defense','duration','open-vote','vote'].includes(action)?`games/${f.s.game.gameId}/${action}`:action;
   assert.equal((await f.post(route,f.cookies[0],bodies[action])).status,403,action);
   assert.equal(db.prepare('SELECT left_at FROM room_members WHERE id=?').get(member).left_at,601000,action);assert.equal(db.prepare('SELECT status FROM games').get().status,'interrupted');
   assert.equal(db.prepare('SELECT COUNT(*) n FROM votes').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM defenses').get().n,0);
  }finally{db?.close();await f.close();}
 }
});

test('퇴장 쓰기 중 실패는 중단·방장공석까지 rollback하고 재시작 후 재시도는 한 번만 처리한다',async()=>{
 const f=await votingFixture();let db;try{
  db=openSqlite(f.dbPath);const uow=new SqliteUnitOfWork(db);const member=f.s.self.memberId;
  const actor=db.prepare('SELECT session_id id FROM room_members WHERE id=?').get(member);
  const broken={run:work=>uow.run(r=>work({...r,members:{...r.members,exclude(){throw new Error('leave storage failure');}}}))};
  assert.throws(()=>new Rooms(broken,{now:()=>1000},{}).leave(actor,f.s.inviteCode,member),/leave storage failure/);
  assert.equal(db.prepare('SELECT status FROM games').get().status,'defense');assert.equal(db.prepare('SELECT host_member_id FROM rooms').get().host_member_id,member);assert.equal(db.prepare('SELECT left_at FROM room_members WHERE id=?').get(member).left_at,null);
  db.close();db=openSqlite(f.dbPath);const rooms=new Rooms(new SqliteUnitOfWork(db),{now:()=>2000},{});
  rooms.leave(actor,f.s.inviteCode,member);const version=db.prepare('SELECT version FROM rooms').get().version;rooms.leave(actor,f.s.inviteCode,member);assert.equal(db.prepare('SELECT version FROM rooms').get().version,version);assert.equal(db.prepare('SELECT status FROM games').get().status,'interrupted');
 }finally{db?.close();await f.close();}
});

test('증가 시계에서도 요청 시작 시각 하나로 유예 판정·touch·퇴장 효력을 기록한다',async()=>{
 const f=await votingFixture();let db;try{
  db=openSqlite(f.dbPath);const member=f.s.self.memberId;const actor=db.prepare('SELECT session_id id FROM room_members WHERE id=?').get(member);
  db.prepare('UPDATE room_members SET disconnected_at=1000 WHERE id=?').run(member);
  let time=600999;const rooms=new Rooms(new SqliteUnitOfWork(db),{now:()=>time++},{});
  rooms.heartbeat(actor,f.s.inviteCode);
  assert.equal(db.prepare('SELECT last_seen_at at FROM room_members WHERE id=?').get(member).at,600999);
  const start=time;rooms.leave(actor,f.s.inviteCode,member);assert.equal(db.prepare('SELECT left_at at FROM room_members WHERE id=?').get(member).at,start);
 }finally{db?.close();await f.close();}
});
