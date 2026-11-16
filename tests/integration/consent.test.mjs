import test from 'node:test';import assert from 'node:assert/strict';import {apiFixture} from '../support/api-fixture.mjs';import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';
const opts=(f,cookie,body={})=>({method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1',cookie},body:JSON.stringify(body)});
async function session(f){const r=await fetch(`${f.url}/api/session`,opts(f,''));return r.headers.get('set-cookie').split(';')[0];}
const decision=(s,value)=>({penaltyRevision:s.consent.penaltyRevision,roleRevision:s.consent.roleRevision,expectedDecisionVersion:s.consent.decisionVersion,decision:value});
test('현재 피고의 버전형 수락·거절·벌칙/역할왕복무효화·지연수락거부',async()=>{
 const f=await apiFixture();let db;try{const host=await session(f),guest=await session(f);let s=await(await fetch(`${f.url}/api/rooms`,opts(f,host,{nickname:'방장'}))).json();const url=`${f.url}/api/rooms/${s.inviteCode}`;
 const early=await fetch(`${url}/consent`,opts(f,host,{penaltyRevision:0,roleRevision:0,expectedDecisionVersion:0,decision:'accepted'}));assert.equal(early.status,403);
 await fetch(`${url}/join`,opts(f,guest,{nickname:'친구'}));await fetch(`${url}/role`,opts(f,guest,{role:'defendant'}));
 const read=async()=> (await fetch(url,{headers:{cookie:guest}})).json();const save=async(penaltyText,caseText='사건',durationMinutes=3)=>{const current=await read();return (await fetch(`${url}/settings`,opts(f,host,{expectedVersion:current.draft.version,caseText,penaltyText,durationMinutes}))).json();};
 s=await read();assert.equal((await fetch(`${url}/consent`,opts(f,guest,decision(s,'accepted')))).status,409);
 await save('벌칙 A');s=await read();assert.equal((await fetch(`${url}/consent`,opts(f,host,decision(s,'accepted')))).status,403);
 const accepted=await fetch(`${url}/consent`,opts(f,guest,decision(s,'accepted')));assert.equal(accepted.status,201);s=await accepted.json();assert.equal(s.consent.status,'accepted');const stale=decision(s,'accepted');
 const rejected=await(await fetch(`${url}/consent`,opts(f,guest,decision(s,'rejected')))).json();assert.equal(rejected.consent.status,'rejected');assert.equal((await fetch(`${url}/consent`,opts(f,guest,stale))).status,409);
 s=await save('벌칙 B');assert.equal(s.consent.status,'pending');const revision=s.consent.penaltyRevision;s=await save('벌칙 A');assert.equal(s.consent.penaltyRevision,revision+1);assert.equal(s.consent.status,'pending');
 s=await read();s=await(await fetch(`${url}/consent`,opts(f,guest,decision(s,'accepted')))).json();const stable=s.consent.penaltyRevision;s=await save('벌칙 A','다른 사건',5);assert.equal(s.consent.penaltyRevision,stable);assert.equal(s.consent.status,'accepted');
 await fetch(`${url}/role`,opts(f,guest,{role:'participant'}));await fetch(`${url}/role`,opts(f,guest,{role:'defendant'}));s=await read();assert.equal(s.consent.status,'pending');
 const race=await Promise.all(['accepted','rejected'].map(value=>fetch(`${url}/consent`,opts(f,guest,decision(s,value)))));assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);
 s=await read();assert.equal((await fetch(`${url}/consent`,opts(f,guest,{...decision(s,'accepted'),memberId:s.self.memberId}))).status,400);
 db=openSqlite(f.dbPath);db.prepare("INSERT INTO games(id,room_id,status,case_text,penalty_text,duration_seconds,version,created_at) VALUES ('g',?,'defense','case','penalty',180,0,0)").run(s.roomId);assert.equal((await fetch(`${url}/consent`,opts(f,guest,decision(s,'accepted')))).status,409);
 }finally{db?.close();await f.close();}
});
