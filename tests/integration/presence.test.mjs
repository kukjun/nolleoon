import test from 'node:test';import assert from 'node:assert/strict';
import {apiFixture} from '../support/api-fixture.mjs';import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';
const opts=(f,cookie,body={})=>({method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1',cookie},body:JSON.stringify(body)});
test('요청 없는 방도 독립 서버 sweep으로 단절 판정하고 heartbeat만 복구한다',async()=>{
 let now=1000;const f=await apiFixture({clock:{now:()=>now}});let db;
 try{const issued=await fetch(`${f.url}/api/session`,opts(f,''));const cookie=issued.headers.get('set-cookie').split(';')[0];const room=await (await fetch(`${f.url}/api/rooms`,opts(f,cookie,{nickname:'방장'}))).json();const url=`${f.url}/api/rooms/${room.inviteCode}`;db=openSqlite(f.dbPath);
 now=16000;await new Promise(resolve=>setTimeout(resolve,1200));assert.equal(db.prepare('SELECT disconnected_at FROM room_members').get().disconnected_at,16000);
 const read=await (await fetch(url,{headers:{cookie}})).json();assert.equal(read.members[0].connected,false);assert.equal(read.version,1);
 assert.equal((await fetch(`${url}/heartbeat`,opts(f,cookie,{now:1000}))).status,400);
 assert.equal((await fetch(`${url}/heartbeat`,opts(f,''))).status,401);
 const wrong=opts(f,cookie);wrong.headers.origin='https://evil.example';assert.equal((await fetch(`${url}/heartbeat`,wrong)).status,403);
 const restored=await (await fetch(`${url}/heartbeat`,opts(f,cookie))).json();assert.equal(restored.version,2);assert.equal(restored.members[0].connected,true);
 assert.equal(db.prepare('SELECT last_seen_at FROM room_members').get().last_seen_at,16000);
 await f.app.close();now=999999;await new Promise(resolve=>setTimeout(resolve,1100));assert.equal(db.prepare('SELECT disconnected_at FROM room_members').get().disconnected_at,null);
 }finally{db?.close();await f.close();}
});
