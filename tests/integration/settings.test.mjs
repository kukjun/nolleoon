import test from 'node:test';import assert from 'node:assert/strict';
import {apiFixture} from '../support/api-fixture.mjs';import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';
const opts=(f,cookie,body={})=>({method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1',cookie},body:JSON.stringify(body)});
async function session(f){const r=await fetch(`${f.url}/api/session`,opts(f,''));return r.headers.get('set-cookie').split(';')[0];}
test('방장 설정 저장·독립 초안CAS·비방장·범위·재조회·진행게임잠금',async()=>{
 const f=await apiFixture();let db;try{const host=await session(f),guest=await session(f);const room=await (await fetch(`${f.url}/api/rooms`,opts(f,host,{nickname:'호스트'}))).json();const url=`${f.url}/api/rooms/${room.inviteCode}`;
 const body={expectedVersion:0,caseText:'  사건 설명  ',penaltyText:' 벌칙 ',durationMinutes:3};
 const save=await fetch(`${url}/settings`,opts(f,host,body));assert.equal(save.status,201);const first=await save.json();assert.deepEqual(first.draft,{version:1,caseText:'사건 설명',penaltyText:'벌칙',durationMinutes:3});
 await fetch(`${url}/join`,opts(f,guest,{nickname:'게스트'}));
 assert.equal((await fetch(`${url}/settings`,opts(f,guest,{...body,expectedVersion:1}))).status,403);
 assert.equal((await fetch(`${url}/settings`,opts(f,host,body))).status,409);
 for(const durationMinutes of [0,11,1.5,'3',null])assert.equal((await fetch(`${url}/settings`,opts(f,host,{...body,expectedVersion:1,durationMinutes}))).status,400);
 for(const extra of [{caseText:'a'.repeat(2001)},{penaltyText:'a'.repeat(501)},{expectedVersion:-1},{expectedVersion:1.5},{sessionId:'forged'}])assert.equal((await fetch(`${url}/settings`,opts(f,host,{...body,expectedVersion:1,...extra}))).status,400);
 const concurrent=await Promise.all([1,2].map(i=>fetch(`${url}/settings`,opts(f,host,{...body,expectedVersion:1,caseText:`동시 ${i}`}))));assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);
 const recovered=await (await fetch(url,{headers:{cookie:guest}})).json();assert.equal(recovered.draft.version,2);
 const blank=await fetch(`${url}/settings`,opts(f,host,{...body,expectedVersion:2,caseText:'',penaltyText:'',durationMinutes:1}));assert.equal(blank.status,201);
 db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM games').get().n,0);assert.equal(db.prepare('SELECT duration_seconds FROM drafts').get().duration_seconds,60);
 db.prepare("INSERT INTO games(id,room_id,status,case_text,penalty_text,duration_seconds,version,created_at) VALUES ('active',?,'defense','case','penalty',180,0,0)").run(room.roomId);
 assert.equal((await fetch(`${url}/settings`,opts(f,host,{...body,expectedVersion:3}))).status,409);
 }finally{db?.close();await f.close();}
});
