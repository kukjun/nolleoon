import test from 'node:test';import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';
async function list(f,cookie,cursor){return fetch(`${new URL(f.url).origin}/api/history${cursor?'?cursor='+encodeURIComponent(cursor):''}`,{headers:{cookie}});}
test('자기 게임 목록은 실제 참여자만 포함하고 진행중은 사건·상태만 표시한다',async()=>{
 const f=await votingFixture();try{
  const response=await list(f,f.cookies[1]);assert.equal(response.status,200);const history=await response.json();assert.equal(history.items.length,1);assert.deepEqual(history.items[0],{gameId:f.s.game.gameId,state:'ongoing',caseText:'사건',outcome:null});assert.equal(history.nextCursor,null);
  const detail=await(await fetch(`${new URL(f.url).origin}/api/history/${f.s.game.gameId}`,{headers:{cookie:f.cookies[1]}})).json();assert.deepEqual(detail,{gameId:f.s.game.gameId,game:null,interrupted:false,interruption:null,ongoing:{caseText:'사건'}});
 }finally{await f.close();}
});

import {openSqlite,SqliteUnitOfWork} from '../../apps/api/dist/infrastructure/sqlite/index.js';
async function newIdentity(f){const response=await fetch(`${new URL(f.url).origin}/api/session`,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1'},body:'{}'});return response.headers.get('set-cookie').split(';')[0];}
async function finish(f){const path=`games/${f.s.game.gameId}`;await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'history-open-00001'});for(const i of [1,2])await f.post(`${path}/vote`,f.cookies[i],{roundNumber:1,requestId:`history-vote-0000${i}`,choice:'guilty',reason:`판단 ${i}`});}

test('관전자는 이력을 갖지만 종료 후 가입·같은 닉네임·다른 쿠키는 이전 판 권한을 얻지 못한다',async()=>{
 const f=await votingFixture();try{
  const observer=await newIdentity(f);await f.post('join',observer,{nickname:'관전자'});assert.equal((await(await list(f,observer)).json()).items.length,1);
  await finish(f);const outsider=await newIdentity(f);await f.post('join',outsider,{nickname:'종료 뒤 참가'});assert.deepEqual(await(await list(f,outsider)).json(),{items:[],nextCursor:null});
  const base=`${new URL(f.url).origin}/api/history/${f.s.game.gameId}`;assert.equal((await fetch(base,{headers:{cookie:outsider}})).status,403);
  assert.equal((await list(f,outsider,f.s.game.gameId)).status,403);assert.equal((await fetch(base)).status,401);
  const observerDetail=await(await fetch(base,{headers:{cookie:observer}})).json();assert.equal(observerDetail.game.self.role,'observer');assert.equal(observerDetail.game.settlement.outcome,'guilty');assert.equal(observerDetail.game.publishedRounds[0].reasons.length,2);
  const original=f.s.members.find(m=>m.nickname==='친구1').memberId;await f.post('leave',f.cookies[1],{expectedMemberId:original});const impersonator=await newIdentity(f);assert.equal((await f.post('join',impersonator,{nickname:'친구1'})).status,201);assert.equal((await(await list(f,impersonator)).json()).items.length,0);
  assert.equal((await(await list(f,f.cookies[1])).json()).items.length,1);assert.equal((await fetch(base,{headers:{cookie:f.cookies[1]}})).status,200);
 }finally{await f.close();}
});

test('재가입 멤버십은 게임별 중복 없이 조회하고 닫힌 방 뒤에도 원래 참여자 결과는 유지한다',async()=>{
 const f=await votingFixture();let db;try{
  const member=f.s.members.find(m=>m.nickname==='친구1').memberId;await f.post('leave',f.cookies[1],{expectedMemberId:member});await f.post('join',f.cookies[1],{nickname:'다시 온 친구'});
  assert.equal((await(await list(f,f.cookies[1])).json()).items.length,1);
  await f.post('close',f.cookies[0],{expectedMemberId:f.s.self.memberId});const history=await(await list(f,f.cookies[1])).json();assert.deepEqual(history.items,[{gameId:f.s.game.gameId,state:'interrupted',caseText:'사건',outcome:null}]);
  const detail=await(await fetch(`${new URL(f.url).origin}/api/history/${f.s.game.gameId}`,{headers:{cookie:f.cookies[1]}})).json();assert.deepEqual(detail.interruption,{caseText:'사건'});assert.equal(detail.game,null);assert.equal(detail.ongoing,null);
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT COUNT(*) n FROM game_participants').get().n,4);
 }finally{db?.close();await f.close();}
});

test('피고/legacy 중단은 목록·상세 모두 사건·벌칙·이유·추정 시간 정보를 내보내지 않는다',async()=>{
 const f=await votingFixture(1);let db;try{
  const defendant=f.s.members.find(m=>m.role==='defendant').memberId;await f.post('leave',f.cookies[1],{expectedMemberId:defendant});await f.post('close',f.cookies[0],{expectedMemberId:f.s.self.memberId});
  const history=await(await list(f,f.cookies[0])).json();assert.deepEqual(history.items,[{gameId:f.s.game.gameId,state:'interrupted',caseText:null,outcome:null}]);
  const detail=await(await fetch(`${new URL(f.url).origin}/api/history/${f.s.game.gameId}`,{headers:{cookie:f.cookies[0]}})).json();assert.deepEqual(detail,{gameId:f.s.game.gameId,game:null,interrupted:true,interruption:{caseText:null},ongoing:null});
  db=openSqlite(f.dbPath);const uow=new SqliteUnitOfWork(db);uow.run(r=>{r.games.insert({id:'legacy-private-history',roomId:f.s.roomId,status:'interrupted',caseText:'비공개 사건',penaltyText:'비공개 벌칙',durationSeconds:180,version:0,createdAt:1001});r.participants.insert({gameId:'legacy-private-history',roomId:f.s.roomId,memberId:f.s.self.memberId,role:'participant',eligible:true});r.interruptions.insert({gameId:'legacy-private-history',cause:'legacy-private',interruptedAt:1001});});
  const legacy=await(await list(f,f.cookies[0])).json();assert.equal(legacy.items[0].caseText,null);assert.equal(JSON.stringify(legacy).includes('비공개'),false);
 }finally{db?.close();await f.close();}
});

test('20개 keyset 페이지는 중복 멤버십·같은 생성시각에서도 누락 없이 이어지고 새 항목은 새로고침에 나타난다',async()=>{
 const f=await votingFixture();let db;try{
  db=openSqlite(f.dbPath);const uow=new SqliteUnitOfWork(db);uow.run(r=>{for(let i=0;i<25;i++){const id=`history-page-${String(i).padStart(3,'0')}`;r.games.insert({id,roomId:f.s.roomId,status:'result',caseText:`기록 ${i}`,penaltyText:'벌칙',durationSeconds:180,version:0,createdAt:1000});r.participants.insert({gameId:id,roomId:f.s.roomId,memberId:f.s.self.memberId,role:'participant',eligible:true});}});
  const first=await(await list(f,f.cookies[0])).json();assert.equal(first.items.length,20);assert.equal(typeof first.nextCursor,'string');
  uow.run(r=>{r.games.insert({id:'new-after-page',roomId:f.s.roomId,status:'result',caseText:'새 기록',penaltyText:'벌칙',durationSeconds:180,version:0,createdAt:2000});r.participants.insert({gameId:'new-after-page',roomId:f.s.roomId,memberId:f.s.self.memberId,role:'participant',eligible:true});});
  const second=await(await list(f,f.cookies[0],first.nextCursor)).json();assert.equal(second.items.length,6);assert.equal(second.nextCursor,null);const ids=[...first.items,...second.items].map(x=>x.gameId);assert.equal(new Set(ids).size,26);assert.equal(ids.includes('new-after-page'),false);
  assert.equal((await(await list(f,f.cookies[0])).json()).items[0].gameId,'new-after-page');
  assert.equal((await fetch(`${new URL(f.url).origin}/api/history?cursor=x&cursor=y`,{headers:{cookie:f.cookies[0]}})).status,400);
  assert.equal((await fetch(`${new URL(f.url).origin}/api/history?sessionId=spoof`,{headers:{cookie:f.cookies[0]}})).status,400);
 }finally{db?.close();await f.close();}
});

test('두 라운드 완료 이유는 개인 기록에도 유지되고 다른 방 경로로 게임ID를 바꿔 조회할 수 없다',async()=>{
 const f=await votingFixture();try{
  const path=`games/${f.s.game.gameId}`;
  for(const roundNumber of [1,2]){
   const current=await(await f.post('heartbeat',f.cookies[0],{})).json();await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber,expectedVersion:current.game.version,requestId:`history-round-open-${roundNumber}`});
   for(const i of [1,2])await f.post(`${path}/vote`,f.cookies[i],{roundNumber,requestId:`history-round-vote-${roundNumber}-${i}`,choice:i===1?'guilty':'not-guilty',reason:`${roundNumber}차 판단 ${i}`});
  }
  const summary=await(await list(f,f.cookies[1])).json();assert.equal(summary.items[0].outcome,'not-guilty');const detail=await(await fetch(`${new URL(f.url).origin}/api/history/${f.s.game.gameId}`,{headers:{cookie:f.cookies[1]}})).json();assert.equal(detail.game.publishedRounds.length,2);assert.equal(detail.game.publishedRounds[0].reasons.length,2);assert.equal(detail.game.publishedRounds[1].reasons.length,2);
  const created=await fetch(`${new URL(f.url).origin}/api/rooms`,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1',cookie:f.cookies[1]},body:JSON.stringify({nickname:'다른 방'})});const other=await created.json();
  assert.equal((await fetch(`${new URL(f.url).origin}/api/rooms/${other.inviteCode}/games/${f.s.game.gameId}`,{headers:{cookie:f.cookies[1]}})).status,404);
 }finally{await f.close();}
});

test('기록 탐색은 신원·명단·역할·동의·초안을 새로 만들지 않으며 쿠키 만료는 조회를 막는다',async()=>{
 const f=await votingFixture();let db;try{
  db=openSqlite(f.dbPath);const capture=()=>Object.fromEntries(['sessions','game_participants','room_members','drafts','penalty_consents','games'].map(table=>[table,db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));const before=capture();
  await list(f,f.cookies[0]);await fetch(`${new URL(f.url).origin}/api/history/${f.s.game.gameId}`,{headers:{cookie:f.cookies[0]}});assert.deepEqual(capture(),before);
  db.prepare('UPDATE sessions SET expires_at=1500').run();f.setNow(2000);assert.equal((await list(f,f.cookies[0])).status,401);assert.equal((await fetch(`${new URL(f.url).origin}/api/history/${f.s.game.gameId}`,{headers:{cookie:f.cookies[0]}})).status,401);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions').get().n,3);
 }finally{db?.close();await f.close();}
});
