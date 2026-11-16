import test from 'node:test';import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';
import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';
async function opened(){const f=await votingFixture();const path=`games/${f.s.game.gameId}`;await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'settlement-open-0001'});return {...f,path};}
const body=(choice,key)=>({roundNumber:1,requestId:key,choice,reason:choice==='abstain'?'':'판단 이유'});
test('마지막 두 표 경합은 동일 트랜잭션의 단일 결과로 자동 종료한다',async()=>{const f=await opened();try{
 const res=await Promise.all([f.post(`${f.path}/vote`,f.cookies[1],body('guilty','settle-vote-0001')),f.post(`${f.path}/vote`,f.cookies[2],body('guilty','settle-vote-0002'))]);assert.deepEqual(res.map(r=>r.status),[201,201]);
 const s=await(await fetch(f.url,{headers:{cookie:f.cookies[0]}})).json();assert.equal(s.game.status,'result');assert.deepEqual(s.game.settlement,{roundNumber:1,outcome:'guilty',guilty:2,notGuilty:0,abstain:0,total:2,closedAt:1000,closedBy:'all-submitted'});assert.equal(s.game.ownVote,null);
 const retry=await f.post(`${f.path}/vote`,f.cookies[1],body('guilty','settle-vote-0001'));assert.equal(retry.status,201);assert.equal((await retry.json()).snapshot.version,s.version);
 }finally{await f.close();}});
test('직접 전원 기권은 무판결, 유효 첫 동률은 최후 변론 대기로 구분한다',async()=>{
 for(const choices of [['abstain','abstain'],['guilty','not-guilty']]){const f=await opened();try{for(let i=0;i<2;i++)assert.equal((await f.post(`${f.path}/vote`,f.cookies[i+1],body(choices[i],`settle-policy-key-${i}`))).status,201);const s=await(await fetch(f.url,{headers:{cookie:f.cookies[0]}})).json();assert.equal(s.game.settlement.outcome,choices[0]==='abstain'?'no-verdict':'tie');assert.equal(s.game.status,choices[0]==='abstain'?'result':'final-defense');}finally{await f.close();}}
});
test('폴링 없는 마감도 독립 monitor가 정산하고 미제출을 본인 영수증으로 만들지 않는다',async()=>{const f=await opened();let db;try{
 f.setNow(181000);db=openSqlite(f.dbPath);
 const limit=Date.now()+2500;while(Date.now()<limit&&!db.prepare('SELECT 1 FROM round_settlements').get())await new Promise(r=>setTimeout(r,30));
 assert.equal(db.prepare('SELECT outcome FROM round_settlements').get()?.outcome,'no-verdict');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM votes').get().n,0);
 const s=await(await fetch(f.url,{headers:{cookie:f.cookies[1]}})).json();assert.equal(s.game.settlement.abstain,2);assert.equal(s.game.ownVote,null);
 const late=await f.post(`${f.path}/vote`,f.cookies[1],body('guilty','after-monitor-vote'));assert.equal((await late.json()).error.code,'DEADLINE_PASSED');
 }finally{db?.close();await f.close();}});
