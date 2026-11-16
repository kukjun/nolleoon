import test from 'node:test';import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';
import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';
async function newCookie(f){const origin=new URL(f.url).origin;const response=await fetch(`${origin}/api/session`,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1'},body:'{}'});return response.headers.get('set-cookie').split(';')[0];}
test('실제 5세션 결과는 기권 이유만 있으면 공개하고 누락 이유·작성자 메타데이터를 만들지 않는다',async()=>{
 for(const outcome of ['guilty','not-guilty','no-verdict']){const f=await votingFixture(0,5);try{
  const path=`games/${f.s.game.gameId}`;await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'results-first-open'});
  for(let i=1;i<=4;i++){const choice=outcome!=='no-verdict'&&i===1?outcome:'abstain';const reason=i===1?'명시한 첫 판단':i===2?'기권한 이유':' ';const res=await f.post(`${path}/vote`,f.cookies[i],{roundNumber:1,requestId:`private-request-${i}`,choice,reason});assert.equal(res.status,201);}
  for(let i=0;i<5;i++){const s=await(await fetch(f.url,{headers:{cookie:f.cookies[i]}})).json();assert.equal(s.game.settlement.outcome,outcome);assert.equal(s.game.settlement.total,4);assert.equal(s.game.publishedRounds[0].reasons.length,2);assert.ok(s.game.publishedRounds[0].reasons.some(r=>r.choice==='abstain'&&r.reason==='기권한 이유'));assert.ok(s.game.publishedRounds[0].reasons.every(r=>Object.keys(r).sort().join(',')==='choice,reason'));assert.ok(!JSON.stringify(s.game).includes('private-request'));assert.equal(s.game.ownVote===null,i===0);}
 }finally{await f.close();}}
});
test('종료 후 새 방문자의 join·GET·heartbeat는 사건/벌칙/판정/이유·개인 receipt를 누출하지 않는다',async()=>{const f=await votingFixture(0,5);let db;try{
 const path=`games/${f.s.game.gameId}`;await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'result-privacy-open'});
 for(let i=1;i<=4;i++)await f.post(`${path}/vote`,f.cookies[i],{roundNumber:1,requestId:`private-result-vote-${i}`,choice:'guilty',reason:`비공개 원본 이유 ${i}`});
 db=openSqlite(f.dbPath);const defendant=db.prepare("SELECT member_id AS id FROM game_participants WHERE role='defendant'").get();
 db.prepare("INSERT INTO votes(game_id,round_number,member_id,choice,reason,request_id,submitted_at) VALUES (?,1,?,'guilty','비대상 저장소 비밀','invalid-defendant-row',1000)").run(f.s.game.gameId,defendant.id);
 const existing=await(await fetch(f.url,{headers:{cookie:f.cookies[1]}})).json();assert.ok(!JSON.stringify(existing.game.publishedRounds).includes('비대상 저장소 비밀'));assert.equal(existing.game.settlement.total,4);
 const newcomer=await newCookie(f);const snapshots=[await(await f.post('join',newcomer,{nickname:'끝난 뒤 새 친구'})).json(),await(await fetch(f.url,{headers:{cookie:newcomer}})).json(),await(await f.post('heartbeat',newcomer,{})).json()];
 for(const s of snapshots){assert.equal(s.game,null);assert.equal(s.draft.caseText,'');assert.equal(s.draft.penaltyText,'');assert.ok(!JSON.stringify(s).includes('비공개 원본 이유'));assert.equal(s.consent.status,'pending');}
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_participants').get().n,5);
 assert.equal((await f.post(`${path}/vote`,newcomer,{roundNumber:1,requestId:'outsider-result-vote',choice:'guilty',reason:'권한 없음'})).status,403);
 }finally{db?.close();await f.close();}});
