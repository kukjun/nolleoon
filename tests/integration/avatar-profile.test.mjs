import test from 'node:test';
import assert from 'node:assert/strict';
import {apiFixture} from '../support/api-fixture.mjs';
import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';
const cmd=(f,cookie,body,method='POST')=>({method,headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1',cookie},body:JSON.stringify(body)});
async function session(f){return (await fetch(`${f.url}/api/session`,cmd(f,'',{}))).headers.get('set-cookie').split(';')[0];}
test('profile default, ten presets, CAS, reload and exact existing room response',async()=>{
 const f=await apiFixture();let db;try{
 const owner=await session(f);assert.equal((await fetch(`${f.url}/api/avatar`)).status,401);
 assert.deepEqual(await (await fetch(`${f.url}/api/avatar`,{headers:{cookie:owner}})).json(),{kind:'preset',presetId:'preset-01',revision:0,imageUrl:null});
 for(let i=1;i<=10;i++){const r=await fetch(`${f.url}/api/avatar`,cmd(f,owner,{presetId:`preset-${String(i).padStart(2,'0')}`,expectedRevision:i-1},'PUT'));assert.equal(r.status,200);assert.equal((await r.json()).revision,i);}
 assert.equal((await fetch(`${f.url}/api/avatar`,cmd(f,owner,{presetId:'preset-01',expectedRevision:0},'PUT'))).status,409);
 assert.equal((await (await fetch(`${f.url}/api/avatar`,{headers:{cookie:owner}})).json()).presetId,'preset-10');
 db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT count(*) AS n FROM avatar_profiles').get().n,1);
 const room=await (await fetch(`${f.url}/api/rooms`,cmd(f,owner,{nickname:'owner'}))).json();assert.equal('avatar' in room.members[0],false);
 const map=await (await fetch(`${f.url}/api/rooms/${room.inviteCode}/avatars`,{headers:{cookie:owner}})).json();assert.equal(map.members[0].avatar.presetId,'preset-10');
 }finally{db?.close();await f.close();}
});
test('profile rejects invalid input and cross-origin; room portraits exclude outsiders and departed members',async()=>{
 const f=await apiFixture();try{
 const owner=await session(f),other=await session(f),outsider=await session(f);
 for(const body of [{presetId:'preset-11',expectedRevision:0},{presetId:'https://evil.example',expectedRevision:0},{presetId:'preset-01',expectedRevision:-1},{presetId:'preset-01',expectedRevision:0,sessionId:'spoof'}])assert.equal((await fetch(`${f.url}/api/avatar`,cmd(f,owner,body,'PUT'))).status,400);
 const evil=cmd(f,owner,{presetId:'preset-01',expectedRevision:0},'PUT');evil.headers.origin='https://evil.example';assert.equal((await fetch(`${f.url}/api/avatar`,evil)).status,403);
 const room=await (await fetch(`${f.url}/api/rooms`,cmd(f,owner,{nickname:'owner'}))).json();const base=`${f.url}/api/rooms/${room.inviteCode}`;
 assert.equal((await fetch(`${base}/avatars`,{headers:{cookie:outsider}})).status,403);
 const joined=await (await fetch(`${base}/join`,cmd(f,other,{nickname:'friend'}))).json();
 assert.equal((await (await fetch(`${base}/avatars`,{headers:{cookie:other}})).json()).members.length,2);
 assert.equal((await fetch(`${base}/leave`,cmd(f,other,{expectedMemberId:joined.self.memberId}))).status,201);
 assert.equal((await fetch(`${base}/avatars`,{headers:{cookie:other}})).status,403);
 }finally{await f.close();}
});
