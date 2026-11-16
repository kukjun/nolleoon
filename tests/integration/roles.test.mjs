import test from 'node:test';import assert from 'node:assert/strict';import {apiFixture} from '../support/api-fixture.mjs';import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';
const opts=(f,cookie,body={})=>({method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1',cookie},body:JSON.stringify(body)});
async function session(f){const r=await fetch(`${f.url}/api/session`,opts(f,''));return r.headers.get('set-cookie').split(';')[0];}
test('피고 경합·방장피고·타인강제역할금지·단절제외·새멤버십재입장·시작잠금',async()=>{
 const f=await apiFixture();let db;try{const host=await session(f),guest=await session(f),third=await session(f);const room=await(await fetch(`${f.url}/api/rooms`,opts(f,host,{nickname:'방장'}))).json();const url=`${f.url}/api/rooms/${room.inviteCode}`;await fetch(`${url}/join`,opts(f,guest,{nickname:'친구'}));await fetch(`${url}/join`,opts(f,third,{nickname:'셋째'}));
 const hostRole=await fetch(`${url}/role`,opts(f,host,{role:'defendant'}));assert.equal(hostRole.status,201);let snap=await hostRole.json();assert.equal(snap.members.find(m=>m.memberId===room.self.memberId).role,'defendant');assert.equal(snap.self.isHost,true);const revision=snap.roleRevision;
 await fetch(`${url}/role`,opts(f,host,{role:'participant'}));const returned=await(await fetch(`${url}/role`,opts(f,host,{role:'defendant'}))).json();assert.equal(returned.roleRevision,revision+2);
 assert.equal((await fetch(`${url}/role`,opts(f,guest,{role:'defendant',memberId:room.self.memberId}))).status,400);
 for(const role of ['plaintiff','observer','host',null])assert.equal((await fetch(`${url}/role`,opts(f,host,{role}))).status,400);
 assert.equal((await fetch(`${url}/role`,opts(f,'',{role:'participant'}))).status,401);
 await fetch(`${url}/role`,opts(f,host,{role:'participant'}));const race=await Promise.all([guest,third].map(c=>fetch(`${url}/role`,opts(f,c,{role:'defendant'}))));assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);
 snap=await(await fetch(url,{headers:{cookie:host}})).json();const target=snap.members.find(m=>m.nickname==='친구');
 assert.equal((await fetch(`${url}/exclude`,opts(f,host,{memberId:target.memberId}))).status,409);
 assert.equal((await fetch(`${url}/exclude`,opts(f,guest,{memberId:room.self.memberId}))).status,403);
 assert.equal((await fetch(`${url}/exclude`,opts(f,host,{memberId:room.self.memberId}))).status,403);
 const otherRoom=await(await fetch(`${f.url}/api/rooms`,opts(f,third,{nickname:'다른방'}))).json();assert.equal((await fetch(`${url}/exclude`,opts(f,host,{memberId:otherRoom.self.memberId}))).status,404);
 db=openSqlite(f.dbPath);db.prepare('UPDATE room_members SET disconnected_at=? WHERE id=?').run(Date.now(),target.memberId);
 assert.equal((await fetch(`${url}/exclude`,opts(f,host,{memberId:target.memberId}))).status,201);
 assert.equal((await fetch(`${url}/heartbeat`,opts(f,guest))).status,403);const rejoined=await(await fetch(`${url}/join`,opts(f,guest,{nickname:'친구'}))).json();assert.notEqual(rejoined.self.memberId,target.memberId);assert.equal(rejoined.members.find(m=>m.memberId===rejoined.self.memberId).role,'participant');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_participants').get().n,0);
 db.prepare("INSERT INTO games(id,room_id,status,case_text,penalty_text,duration_seconds,version,created_at) VALUES ('g',?,'defense','case','penalty',180,0,0)").run(room.roomId);
 assert.equal((await fetch(`${url}/role`,opts(f,host,{role:'defendant'}))).status,409);assert.equal((await fetch(`${url}/exclude`,opts(f,host,{memberId:rejoined.self.memberId}))).status,409);assert.equal((await(await fetch(url,{headers:{cookie:host}})).json()).rosterEditable,false);
 }finally{db?.close();await f.close();}
});
