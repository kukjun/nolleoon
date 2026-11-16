import test from 'node:test';
import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';
import {openSqlite,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {Rooms} from '../../apps/api/dist/application/rooms.js';

test('명시적 방장 퇴장 시 피고도 후보이며 역할·동의·명단·초안은 그대로 승계한다',async()=>{
 const f=await votingFixture(1);let db;try{
  db=openSqlite(f.dbPath);const actor=db.prepare('SELECT session_id id FROM room_members WHERE id=?').get(f.s.self.memberId);
  const before={draft:db.prepare('SELECT * FROM drafts').all(),consent:db.prepare('SELECT * FROM penalty_consents').all(),cohort:db.prepare('SELECT * FROM game_participants ORDER BY member_id').all()};
  const members=db.prepare('SELECT id FROM room_members ORDER BY joined_at,id').all().filter(m=>m.id!==f.s.self.memberId);const defendant=f.s.members.find(m=>m.role==='defendant').memberId;const calls=[];
  const random={nextInt:max=>{calls.push(max);return members.findIndex(m=>m.id===defendant);}};
  const rooms=new Rooms(new SqliteUnitOfWork(db),{now:()=>1000},{},random);
  rooms.leave(actor,f.s.inviteCode,f.s.self.memberId);
  assert.equal(db.prepare('SELECT host_member_id id FROM rooms').get().id,defendant);assert.deepEqual(calls,[2]);
  rooms.leave(actor,f.s.inviteCode,f.s.self.memberId);rooms.sweep();assert.deepEqual(calls,[2]);
  assert.deepEqual({draft:db.prepare('SELECT * FROM drafts').all(),consent:db.prepare('SELECT * FROM penalty_consents').all(),cohort:db.prepare('SELECT * FROM game_participants ORDER BY member_id').all()},before);
 }finally{db?.close();await f.close();}
});

import {SettleRounds} from '../../apps/api/dist/application/settle-round.js';
import {SecureTokens} from '../../apps/api/dist/infrastructure/sessions/secure-tokens.js';

test('단절 유예 방장은 유지하고 후보 없는 퇴장 뒤 첫 복귀자에게만 지정한다',async()=>{
 const f=await votingFixture(2);let db;try{
  db=openSqlite(f.dbPath);const uow=new SqliteUnitOfWork(db);let now=2000;const calls=[];const random={nextInt:max=>{calls.push(max);return 0;}};
  const rooms=new Rooms(uow,{now:()=>now},new SecureTokens(),random);const actorFor=id=>db.prepare('SELECT session_id id FROM room_members WHERE id=?').get(id);
  db.prepare('UPDATE room_members SET disconnected_at=1500').run();rooms.sweep();assert.equal(db.prepare('SELECT host_member_id id FROM rooms').get().id,f.s.self.memberId);assert.deepEqual(calls,[]);
  rooms.leave(actorFor(f.s.self.memberId),f.s.inviteCode,f.s.self.memberId);assert.equal(db.prepare('SELECT host_member_id id FROM rooms').get().id,null);assert.deepEqual(calls,[]);
  const guest=f.s.members.find(m=>m.nickname==='친구1').memberId;now=3000;const restored=rooms.heartbeat(actorFor(guest),f.s.inviteCode);assert.equal(restored.self.isHost,true);assert.deepEqual(calls,[1]);
  const oldHost=rooms.join(actorFor(f.s.self.memberId),f.s.inviteCode,'돌아온 방장');assert.equal(oldHost.self.isHost,false);assert.equal(oldHost.game.self.role,'observer');assert.deepEqual(calls,[1]);
  assert.throws(()=>rooms.saveSettings(actorFor(oldHost.self.memberId),f.s.inviteCode,{expectedVersion:1,caseText:'변조',penaltyText:'변조',durationMinutes:3}),e=>e.code==='FORBIDDEN');
 }finally{db?.close();await f.close();}
});

test('동시에 만료될 후보는 모두 제외한 뒤 fresh 후보에서 한 번 선택한다',async()=>{
 const f=await votingFixture(2,4);let db;try{
  db=openSqlite(f.dbPath);const ids=f.s.members.map(m=>m.memberId);const host=f.s.self.memberId;const expired=ids.find(id=>id!==host);const remaining=ids.filter(id=>id!==host&&id!==expired);
  db.prepare('UPDATE room_members SET disconnected_at=1000 WHERE id IN (?,?)').run(host,expired);
  db.prepare('UPDATE room_members SET last_seen_at=600999,disconnected_at=NULL WHERE id IN (?,?)').run(...remaining);
  const calls=[];const random={nextInt:max=>{calls.push(max);return 1;}};const uow=new SqliteUnitOfWork(db);
  const rooms=new Rooms(uow,{now:()=>601000},new SecureTokens(),random);const rounds=new SettleRounds(uow,{now:()=>601000},random);
  rounds.sweep();rooms.sweep();rounds.sweep();assert.deepEqual(calls,[2]);assert.ok(remaining.includes(db.prepare('SELECT host_member_id id FROM rooms').get().id));assert.equal(db.prepare('SELECT COUNT(*) n FROM room_members WHERE left_at=601000').get().n,2);
 }finally{db?.close();await f.close();}
});

test('승계 실패는 퇴장과 함께 rollback하고 재개방한 저장소의 기존 방장은 다시 추첨하지 않는다',async()=>{
 const f=await votingFixture(1);let db;try{
  db=openSqlite(f.dbPath);let uow=new SqliteUnitOfWork(db);const member=f.s.self.memberId;const actor=db.prepare('SELECT session_id id FROM room_members WHERE id=?').get(member);
  const broken={run:work=>uow.run(r=>work({...r,rooms:{...r.rooms,setHost(id,next){r.rooms.setHost(id,next);if(next!==null)throw new Error('transfer failure');}}}))};
  assert.throws(()=>new Rooms(broken,{now:()=>1000},new SecureTokens(),{nextInt:()=>0}).leave(actor,f.s.inviteCode,member),/transfer failure/);
  assert.equal(db.prepare('SELECT host_member_id id FROM rooms').get().id,member);assert.equal(db.prepare('SELECT left_at FROM room_members WHERE id=?').get(member).left_at,null);
  new Rooms(uow,{now:()=>1000},new SecureTokens(),{nextInt:()=>0}).leave(actor,f.s.inviteCode,member);const successor=db.prepare('SELECT host_member_id id FROM rooms').get().id;
  db.close();db=openSqlite(f.dbPath);uow=new SqliteUnitOfWork(db);new Rooms(uow,{now:()=>2000},new SecureTokens(),{nextInt:()=>{throw new Error('must not reroll');}}).sweep();assert.equal(db.prepare('SELECT host_member_id id FROM rooms').get().id,successor);
 }finally{db?.close();await f.close();}
});

test('관전자도 방장 후보이지만 방장 지위가 동결 투표 자격을 부여하지 않는다',async()=>{
 const f=await votingFixture(1);let db;try{
  db=openSqlite(f.dbPath);const uow=new SqliteUnitOfWork(db);uow.run(r=>r.sessions.insert({id:'observer-session',tokenHash:'observer-hash',createdAt:1000,expiresAt:999999}));
  let selected;const random={nextInt:max=>{assert.equal(max,3);return selected;}};const rooms=new Rooms(uow,{now:()=>1000},new SecureTokens(),random);
  const observer=rooms.join({id:'observer-session'},f.s.inviteCode,'늦은 참가');
  const candidates=uow.run(r=>r.members.active(f.s.roomId)).filter(m=>m.id!==f.s.self.memberId);selected=candidates.findIndex(m=>m.id===observer.self.memberId);
  const actor=db.prepare('SELECT session_id id FROM room_members WHERE id=?').get(f.s.self.memberId);rooms.leave(actor,f.s.inviteCode,f.s.self.memberId);
  const nowHost=rooms.read({id:'observer-session'},f.s.inviteCode);assert.equal(nowHost.self.isHost,true);assert.equal(nowHost.game.self.role,'observer');assert.equal(nowHost.game.self.eligible,false);assert.equal(nowHost.game.voterCount,2);
 }finally{db?.close();await f.close();}
});

import {apiFixture} from '../support/api-fixture.mjs';
test('공석의 동시 복귀는 한 번만 지정하고 새 방장은 기존 초안을 CAS로 수정한다',async()=>{
 let now=1000;let calls=0;const f=await apiFixture({clock:{now:()=>now},random:{nextInt:()=>{calls++;return 0;}}});let db;try{
  const post=(url,cookie,body={})=>fetch(url,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1',cookie},body:JSON.stringify(body)});
  const cookies=[];for(let i=0;i<3;i++)cookies.push((await post(`${f.url}/api/session`,'')).headers.get('set-cookie').split(';')[0]);
  const initial=await(await post(`${f.url}/api/rooms`,cookies[0],{nickname:'방장'})).json();const url=`${f.url}/api/rooms/${initial.inviteCode}`;
  for(let i=1;i<3;i++)await post(`${url}/join`,cookies[i],{nickname:`친구${i}`});
  await post(`${url}/settings`,cookies[0],{expectedVersion:0,caseText:'보존 사건',penaltyText:'보존 벌칙',durationMinutes:4});
  db=openSqlite(f.dbPath);db.prepare('UPDATE room_members SET disconnected_at=1000 WHERE id!=?').run(initial.self.memberId);
  await post(`${url}/leave`,cookies[0],{expectedMemberId:initial.self.memberId});assert.equal(calls,0);
  now=2000;const responses=await Promise.all([post(`${url}/heartbeat`,cookies[1]),post(`${url}/heartbeat`,cookies[2])]);assert.deepEqual(responses.map(r=>r.status),[201,201]);assert.equal(calls,1);
  const snapshots=await Promise.all(cookies.slice(1).map(cookie=>fetch(url,{headers:{cookie}}).then(r=>r.json())));assert.equal(snapshots[0].members.filter(m=>m.isHost).length,1);
  const index=snapshots.findIndex(s=>s.self.isHost)+1;const successor=snapshots[index-1];assert.equal(successor.draft.caseText,'보존 사건');assert.equal(successor.draft.durationMinutes,4);
  assert.equal((await post(`${url}/settings`,cookies[0],{expectedVersion:1,caseText:'옛 요청',penaltyText:'보존 벌칙',durationMinutes:4})).status,403);
  const command={expectedVersion:1,caseText:'승계 수정',penaltyText:'보존 벌칙',durationMinutes:4};const saved=await Promise.all([post(`${url}/settings`,cookies[index],command),post(`${url}/settings`,cookies[index],command)]);assert.deepEqual(saved.map(r=>r.status).sort(),[201,409]);assert.equal(calls,1);
  const rejoined=await(await post(`${url}/join`,cookies[0],{nickname:'돌아온 방장'})).json();assert.equal(rejoined.self.isHost,false);assert.equal(calls,1);
 }finally{db?.close();await f.close();}
});

test('만료와 투표 개시 경합은 현재 방장만 허용하고 stale 연결 후보를 제외한다',async()=>{
 const f=await votingFixture(1,4);let db;try{
  db=openSqlite(f.dbPath);const host=f.s.self.memberId;const defendant=f.s.members.find(m=>m.role==='defendant').memberId;
  db.prepare('UPDATE room_members SET disconnected_at=1000 WHERE id=?').run(host);
  db.prepare('UPDATE room_members SET last_seen_at=601000,disconnected_at=NULL WHERE id=?').run(defendant);
  // 나머지 멤버는 disconnected_at이 아직 null이어도 15초 침묵으로 후보가 아니다.
  f.setNow(601000);const path=`games/${f.s.game.gameId}/open-vote`;const body={roundNumber:1,expectedVersion:0,requestId:'transfer-opening-001'};
  const [oldHost,newHost]=await Promise.all([f.post(path,f.cookies[0],body),f.post(path,f.cookies[1],body)]);assert.equal(oldHost.status,403);assert.equal(newHost.status,201);
  const snapshot=await newHost.json();assert.equal(snapshot.self.isHost,true);assert.equal(snapshot.game.self.role,'defendant');assert.equal(snapshot.game.round.startedAt,601000);assert.equal(db.prepare('SELECT COUNT(*) n FROM rounds').get().n,1);
 }finally{db?.close();await f.close();}
});

test('유예 중 단절 방장은 자신이 빠진 명단으로 시작할 수 없고 heartbeat 복귀 후 포함된다',async()=>{
 let now=1000;const f=await apiFixture({clock:{now:()=>now},random:{nextInt:()=>0}});let db;try{
  const post=(url,cookie,body={})=>fetch(url,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1',cookie},body:JSON.stringify(body)});
  const cookies=[];for(let i=0;i<4;i++)cookies.push((await post(`${f.url}/api/session`,'')).headers.get('set-cookie').split(';')[0]);
  const room=await(await post(`${f.url}/api/rooms`,cookies[0],{nickname:'방장'})).json();const url=`${f.url}/api/rooms/${room.inviteCode}`;
  for(let i=1;i<4;i++)await post(`${url}/join`,cookies[i],{nickname:`친구${i}`});
  await post(`${url}/role`,cookies[1],{role:'defendant'});
  let snapshot=await(await post(`${url}/settings`,cookies[0],{expectedVersion:0,caseText:'사건',penaltyText:'벌칙',durationMinutes:3})).json();
  snapshot=await(await post(`${url}/consent`,cookies[1],{roleRevision:snapshot.roleRevision,penaltyRevision:snapshot.consent.penaltyRevision,expectedDecisionVersion:0,decision:'accepted'})).json();
  const intent={requestId:'fresh-host-start-001',expectedDraftVersion:snapshot.draft.version,expectedRoleRevision:snapshot.roleRevision,expectedDecisionVersion:snapshot.consent.decisionVersion};
  db=openSqlite(f.dbPath);db.prepare('UPDATE room_members SET last_seen_at=20000 WHERE id!=?').run(room.self.memberId);now=20000;
  assert.equal((await post(`${url}/start`,cookies[0],intent)).status,409);assert.equal(db.prepare('SELECT COUNT(*) n FROM games').get().n,0);
  const waiting=await(await fetch(url,{headers:{cookie:cookies[0]}})).json();assert.equal(waiting.start.canStart,false);
  assert.equal((await post(`${url}/heartbeat`,cookies[0])).status,201);
  const started=await post(`${url}/start`,cookies[0],intent);assert.equal(started.status,201);assert.equal(db.prepare('SELECT COUNT(*) n FROM game_participants').get().n,4);assert.equal(db.prepare('SELECT COUNT(*) n FROM game_participants WHERE member_id=?').get(room.self.memberId).n,1);
  // 영속 시작 receipt 재확인은 새로운 시작 명령이 아니며 이후 단절에도 원래 게임을 가리킨다.
  now=40000;assert.equal((await post(`${url}/start`,cookies[0],intent)).status,201);assert.equal(db.prepare('SELECT COUNT(*) n FROM games').get().n,1);
 }finally{db?.close();await f.close();}
});

test('난수 provider의 범위 밖 값은 퇴장·방장·버전을 모두 rollback한다',async()=>{
 const f=await votingFixture(1);let db;try{
  db=openSqlite(f.dbPath);const uow=new SqliteUnitOfWork(db);const member=f.s.self.memberId;const actor=db.prepare('SELECT session_id id FROM room_members WHERE id=?').get(member);const before=db.prepare('SELECT host_member_id,version FROM rooms').get();
  for(const value of [-1,2,NaN]){
   assert.throws(()=>new Rooms(uow,{now:()=>1000},new SecureTokens(),{nextInt:()=>value}).leave(actor,f.s.inviteCode,member),/인덱스/);
   assert.deepEqual(db.prepare('SELECT host_member_id,version FROM rooms').get(),before);assert.equal(db.prepare('SELECT left_at FROM room_members WHERE id=?').get(member).left_at,null);
  }
 }finally{db?.close();await f.close();}
});
