import test from 'node:test';import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';
async function outsider(f){const response=await fetch(`${new URL(f.url).origin}/api/session`,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1'},body:'{}'});return response.headers.get('set-cookie').split(';')[0];}
test('종료 후 새 입장자는 일반 snapshot에서도 이전 피고·수락·revision·시작조건을 얻지 못한다',async()=>{
 const f=await votingFixture();try{
  const path=`games/${f.s.game.gameId}`;await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'security-open-0001'});for(const i of [1,2])await f.post(`${path}/vote`,f.cookies[i],{roundNumber:1,requestId:`security-vote-000${i}`,choice:'abstain',reason:''});
  const cookie=await outsider(f);const joined=await(await f.post('join',cookie,{nickname:'종료 뒤 방문'})).json();
  for(const snapshot of [joined,await(await fetch(f.url,{headers:{cookie}})).json(),await(await f.post('heartbeat',cookie,{})).json()]){
   assert.equal(snapshot.game,null);assert.equal(snapshot.rosterEditable,false);assert.ok(snapshot.members.every(m=>m.role==='participant'));assert.equal(snapshot.roleRevision,0);assert.equal(snapshot.consent.roleRevision,0);assert.equal(snapshot.consent.penaltyRevision,0);assert.equal(snapshot.consent.decisionVersion,0);assert.equal(snapshot.consent.defendantMemberId,null);assert.equal(snapshot.consent.canDecide,false);assert.equal(snapshot.draft.version,0);assert.deepEqual(snapshot.start,{canStart:false,missing:[]});assert.equal(snapshot.draft.caseText,'');assert.equal(snapshot.draft.penaltyText,'');
  }
 }finally{await f.close();}
});

test('세션별 요청 제한은 공유IP의 다른 참가자를 막지 않고 Retry-After 후 복구한다',async()=>{
 const f=await votingFixture();try{
  let limited;for(let i=0;i<190;i++){const response=await f.post('heartbeat',f.cookies[1],{});if(response.status===429){limited=response;break;}assert.equal(response.status,201);}
  assert.ok(limited);assert.ok(Number(limited.headers.get('retry-after'))>=1);assert.deepEqual(await limited.json(),{error:{code:'RATE_LIMITED',message:'요청이 많아요. 잠시 기다렸다가 다시 시도해 주세요.'}});
  assert.equal((await f.post('heartbeat',f.cookies[2],{})).status,201);
  // 읽기 budget은 쓰기 폭주와 별개이므로 현재 결과/접수 확인은 가능하다.
  assert.equal((await fetch(f.url,{headers:{cookie:f.cookies[1]}})).status,200);
  f.setNow(62000);assert.equal((await f.post('heartbeat',f.cookies[1],{})).status,201);
 }finally{await f.close();}
});

test('회전하는 위조 cookie/X-Forwarded-For가 익명 제한을 우회하지 못한다',async()=>{
 const f=await votingFixture();try{
  let limited=false;for(let i=0;i<130;i++){
   const response=await fetch(`${f.url}/heartbeat`,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1','x-forwarded-for':`192.0.2.${i%250}`,cookie:`__Host-trip_session=${String(i).padStart(43,'a')}`},body:'{}'});
   if(response.status===429){limited=true;break;}assert.equal(response.status,401);
  }assert.equal(limited,true);assert.equal((await f.post('heartbeat',f.cookies[0],{})).status,201);
 }finally{await f.close();}
});

test('과도한 JSON 본문·역할 타입coercion·actor extra필드는 거절하고 저장 상태를 바꾸지 않는다',async()=>{
 const f=await votingFixture();try{
  const oversized=await f.post('role',f.cookies[0],{role:'x'.repeat(70000)});assert.equal(oversized.status,413);assert.equal((await oversized.json()).error.code,'PAYLOAD_TOO_LARGE');
  for(const body of [{role:['defendant']},{role:{toString:'defendant'}},{role:'participant',actorId:'another'},{role:'participant',expectedPreparationVersion:'0'}])assert.equal((await f.post('role',f.cookies[0],body)).status,400);
  const after=await(await f.post('heartbeat',f.cookies[0],{})).json();assert.equal(after.game.gameId,f.s.game.gameId);assert.equal(after.game.self.role,'defendant');
 }finally{await f.close();}
});

test('JSON parser의 상한 초과도 원문 없이413으로 정규화한다',async()=>{
 const f=await votingFixture();try{
  const response=await f.post('role',f.cookies[0],{role:'x'.repeat(110000)});assert.equal(response.status,413);const body=await response.json();assert.equal(body.error.code,'PAYLOAD_TOO_LARGE');assert.ok(JSON.stringify(body).length<200);
 }finally{await f.close();}
});

import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';
test('직접 명령의 역할·actor spoof·crossroom·CSRF 행렬은 상태 변경 없이 차단한다',async()=>{
 const f=await votingFixture();let db;try{
  const game=f.s.game.gameId;const cases=[
   [`games/${game}/defense`,1,{roundNumber:1,expectedVersion:0,action:'submit',text:'권한없는 변론'},403],
   [`games/${game}/duration`,1,{expectedVersion:0,durationMinutes:5},403],
   [`games/${game}/open-vote`,1,{roundNumber:1,expectedVersion:0,requestId:'matrix-opening-001'},403],
   [`games/${game}/vote`,0,{roundNumber:1,requestId:'matrix-voting-0001',choice:'abstain',reason:''},403],
   ['close',1,{expectedMemberId:f.s.self.memberId},403],
   ['settings',1,{expectedVersion:1,caseText:'침입',penaltyText:'침입',durationMinutes:3},403],
   ['consent',1,{roleRevision:f.s.roleRevision,penaltyRevision:f.s.consent.penaltyRevision,expectedDecisionVersion:1,decision:'accepted'},403],
  ];
  for(const [path,index,body,status] of cases){assert.equal((await f.post(path,f.cookies[index],body)).status,status,path);const csrf=await fetch(`${f.url}/${path}`,{method:'POST',headers:{origin:'https://attacker.example','content-type':'application/json','x-trip-court-request':'1',cookie:f.cookies[0]},body:JSON.stringify(body)});assert.equal(csrf.status,403,path);}
  assert.equal((await f.post(`games/${game}/defense`,f.cookies[0],{roundNumber:1,expectedVersion:0,action:'submit',text:'spoof',actorId:'fake'})).status,400);
  const create=await fetch(`${new URL(f.url).origin}/api/rooms`,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1',cookie:f.cookies[0]},body:JSON.stringify({nickname:'다른 방'})});const other=await create.json();assert.equal((await fetch(`${new URL(f.url).origin}/api/rooms/${other.inviteCode}/games/${game}/defense`,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1',cookie:f.cookies[0]},body:JSON.stringify({roundNumber:1,expectedVersion:0,action:'skip',text:''})})).status,404);
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT COUNT(*) n FROM votes').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM defenses').get().n,0);assert.equal(db.prepare('SELECT status FROM games WHERE id=?').get(game).status,'defense');
 }finally{db?.close();await f.close();}
});

for(let iteration=0;iteration<3;iteration++)test(`동일/다른 키 투표 경합 반복 ${iteration+1}: 표2개·정산1개`,async()=>{
 const f=await votingFixture();let db;try{
  const path=`games/${f.s.game.gameId}`;const open={roundNumber:1,expectedVersion:0,requestId:`security-race-open-${iteration}`};const opened=await Promise.all([f.post(`${path}/open-vote`,f.cookies[0],open),f.post(`${path}/open-vote`,f.cookies[0],open)]);assert.deepEqual(opened.map(r=>r.status),[201,201]);
  const first={roundNumber:1,requestId:`security-race-first-${iteration}`,choice:'guilty',reason:'동시 판단'};const duplicate=await Promise.all([f.post(`${path}/vote`,f.cookies[1],first),f.post(`${path}/vote`,f.cookies[1],first)]);assert.deepEqual(duplicate.map(r=>r.status),[201,201]);
  const last=await Promise.all([f.post(`${path}/vote`,f.cookies[2],{...first,requestId:`security-race-last-a-${iteration}`}),f.post(`${path}/vote`,f.cookies[2],{...first,requestId:`security-race-last-b-${iteration}`})]);assert.deepEqual(last.map(r=>r.status).sort(),[201,409]);
  db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT COUNT(*) n FROM votes').get().n,2);assert.equal(db.prepare('SELECT COUNT(*) n FROM round_settlements').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM rounds').get().n,1);assert.equal(db.prepare('SELECT outcome FROM round_settlements').get().outcome,'guilty');
 }finally{db?.close();await f.close();}
});

test('Express 동등 경로의 대문자·끝 slash도 방 참여 예산을 우회하지 못한다',async()=>{
 const f=await votingFixture();try{
  let limited=false;for(let i=0;i<35;i++){
   const response=await fetch(`${f.url}/${i%2?'JOIN/':'join'}`,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1',cookie:f.cookies[1]},body:JSON.stringify({nickname:'친구1'})});
   if(response.status===429){limited=true;break;}assert.equal(response.status,201);
  }assert.equal(limited,true);
 }finally{await f.close();}
});
