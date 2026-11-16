import test from 'node:test';
import assert from 'node:assert/strict';
import {apiFixture} from '../support/api-fixture.mjs';
import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';
const command=(f,cookie,body)=>({method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1',cookie},body:JSON.stringify(body)});
async function session(f){const r=await fetch(`${f.url}/api/session`,command(f,'',{}));return r.headers.get('set-cookie').split(';')[0];}
test('방 생성·동시 중복 닉네임·재입장·권한 사칭·닫힌 링크',async()=>{
 const f=await apiFixture();let db;try{
 const cookies=await Promise.all(Array.from({length:6},()=>session(f)));
 const created=await fetch(`${f.url}/api/rooms`,command(f,cookies[0],{nickname:'  방장  '}));assert.equal(created.status,201);
 const room=await created.json();assert.match(room.inviteCode,/^[A-Za-z0-9_-]{43}$/);assert.equal(room.self.isHost,true);assert.equal(room.members[0].nickname,'방장');
 const url=`${f.url}/api/rooms/${room.inviteCode}`;
 const competing=await Promise.all(cookies.slice(1,3).map(cookie=>fetch(`${url}/join`,command(f,cookie,{nickname:' Ａlice '}))));assert.deepEqual(competing.map(r=>r.status).sort(),[201,409]);
 for(let i=1;i<6;i++){const r=await fetch(`${url}/join`,command(f,cookies[i],{nickname:`친구${i}`}));assert.equal(r.status,201);}
 const again=await fetch(`${url}/join`,command(f,cookies[0],{nickname:'다른 이름'}));assert.equal((await again.json()).members.length,6);
 const snapshot=await (await fetch(url,{headers:{cookie:cookies[0]}})).json();assert.equal(snapshot.members.filter(m=>m.isHost).length,1);assert.equal(snapshot.members.length,6);assert.ok(!JSON.stringify(snapshot).includes('sessionId'));
 assert.equal((await fetch(url,{headers:{'x-participant-id':room.self.memberId}})).status,401);
 const outsider=await session(f);assert.equal((await fetch(url,{headers:{cookie:outsider}})).status,403);
 for(const body of [{nickname:'',},{nickname:'a'.repeat(21)},{nickname:'x',sessionId:'spoof'},{nickname:'x',isHost:true},{nickname:'x\nY'}])assert.equal((await fetch(`${url}/join`,command(f,outsider,body))).status,400);
 assert.equal((await fetch(`${url}/join`,{...command(f,outsider,{nickname:'외부'}),headers:{...command(f,outsider,{}).headers,origin:'https://evil.example'}})).status,403);
 assert.equal((await fetch(`${f.url}/api/rooms/${'x'.repeat(43)}/join`,command(f,outsider,{nickname:'외부'}))).status,404);
 db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_participants').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM games').get().n,0);
 db.prepare("UPDATE rooms SET status='closed' WHERE id=?").run(room.roomId);
 assert.equal((await fetch(`${url}/join`,command(f,outsider,{nickname:'외부'}))).status,404);assert.equal((await fetch(url,{headers:{cookie:cookies[0]}})).status,404);
 }finally{db?.close();await f.close();}
});
