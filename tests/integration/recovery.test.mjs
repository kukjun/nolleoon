import {firstCandidateRandom} from '../support/fakes.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';
import {openSqlite,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {SettleRounds} from '../../apps/api/dist/application/settle-round.js';
test('유예 중 같은 브라우저 복귀는 신원·고정 명단·접수·마감과 결과를 유지한다',async()=>{const f=await votingFixture(0,3,10);let db;try{
 const path=`games/${f.s.game.gameId}`;const opened=await(await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'recovery-open-0001'})).json();const deadline=opened.game.round.deadline;
 const intent={roundNumber:1,requestId:'recovery-vote-0001',choice:'guilty',reason:'복귀해도 유지할 판단'};const sent=await(await f.post(`${path}/vote`,f.cookies[1],intent)).json();const memberId=sent.snapshot.self.memberId;
 db=openSqlite(f.dbPath);const cohort=db.prepare('SELECT * FROM game_participants ORDER BY member_id').all();const sessions=db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n;
 f.setNow(16000);new SqliteUnitOfWork(db).run(r=>r.members.detectDisconnected(16000,15000));assert.equal(db.prepare('SELECT disconnected_at AS at FROM room_members WHERE id=?').get(memberId).at,16000);
 f.setNow(590000);const recovered=await(await f.post('heartbeat',f.cookies[1],{})).json();assert.equal(recovered.self.memberId,memberId);assert.equal(recovered.game.self.eligible,true);assert.deepEqual(recovered.game.ownVote,sent.receipt&&{roundNumber:1,choice:'guilty',reason:intent.reason});assert.equal(recovered.game.round.deadline,deadline);assert.equal(recovered.game.status,'voting');assert.deepEqual(db.prepare('SELECT * FROM game_participants ORDER BY member_id').all(),cohort);
 // 실제 감지 시각으로부터 599,999ms 후에도 동일 멤버십. 결과 상태 복귀도 별도 확인한다.
 db.prepare('UPDATE room_members SET disconnected_at=16000,last_seen_at=1000 WHERE id=?').run(memberId);f.setNow(615999);new SettleRounds(new SqliteUnitOfWork(db),{now:()=>615999},firstCandidateRandom).sweep();
 const result=await(await f.post('heartbeat',f.cookies[1],{})).json();assert.equal(result.self.memberId,memberId);assert.equal(result.game.status,'result');assert.equal(result.game.round.deadline,deadline);assert.deepEqual(result.game.ownVote,recovered.game.ownVote);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,sessions);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM votes').get().n,1);
 assert.equal((await f.post(`${path}/vote`,f.cookies[1],intent)).status,201);
 }finally{db?.close();await f.close();}});
test('만료 신원 요청은 새 세션을 발급하지 않고 같은 닉네임도 복구 자격이 아니다',async()=>{const f=await votingFixture();let db;try{
 db=openSqlite(f.dbPath);const initial=db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n;f.setNow(5000);db.prepare('UPDATE sessions SET expires_at=4000').run();
 const denied=await f.post('heartbeat',f.cookies[1],{});assert.equal(denied.status,401);assert.equal((await denied.json()).error.code,'SESSION_REQUIRED');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,initial);
 const origin=new URL(f.url).origin;const issued=await fetch(`${origin}/api/session`,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1'},body:'{}'});const cookie=issued.headers.get('set-cookie').split(';')[0];assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,initial+1);
 assert.equal((await f.post('join',cookie,{nickname:'친구1'})).status,409);const late=await(await f.post('join',cookie,{nickname:'새 신원'})).json();assert.equal(late.game.self.role,'observer');assert.equal(late.game.self.eligible,false);assert.equal(late.game.ownVote,null);
 }finally{db?.close();await f.close();}});
test('자동 갱신 전용 endpoint는 기존 신원만 연장하고 쿠키 소실·만료 때 새 신원을 만들지 않는다',async()=>{const f=await votingFixture();let db;try{
 const url=`${new URL(f.url).origin}/api/session/renew`;
 const post=(cookie,body={},origin=f.publicOrigin)=>fetch(url,{method:'POST',headers:{origin,'content-type':'application/json','x-trip-court-request':'1',cookie},body:JSON.stringify(body)});
 db=openSqlite(f.dbPath);const count=()=>db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n;const initial=count();
 assert.equal((await post('')).status,401);assert.equal(count(),initial);
 f.setNow(5000);const renewed=await post(f.cookies[1]);assert.equal(renewed.status,201);assert.deepEqual(await renewed.json(),{authenticated:true});assert.equal(renewed.headers.get('set-cookie').split(';')[0],f.cookies[1]);assert.equal(count(),initial);assert.ok(renewed.headers.get('set-cookie').includes('HttpOnly'));assert.ok(renewed.headers.get('set-cookie').includes('Secure'));assert.equal(db.prepare('SELECT MAX(expires_at) AS expires FROM sessions').get().expires,5000+90*24*60*60*1000);
 assert.equal((await post(f.cookies[1],{},'https://evil.example')).status,403);assert.equal((await post(f.cookies[1],{sessionId:'spoof'})).status,400);
 assert.equal((await fetch(`${new URL(f.url).origin}/api/session`,{headers:{cookie:f.cookies[1]}})).status,200);
 db.prepare('UPDATE sessions SET expires_at=4000').run();const expired=await post(f.cookies[1]);assert.equal(expired.status,401);assert.equal(expired.headers.get('set-cookie'),null);assert.equal(count(),initial);
 }finally{db?.close();await f.close();}});
