import test from 'node:test';import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';
async function firstTie(){const f=await votingFixture();const path=`games/${f.s.game.gameId}`;const call=(action,body,c=f.cookies[0])=>f.post(`${path}/${action}`,c,body);const firstOpen={roundNumber:1,expectedVersion:1,requestId:'revote-first-open'};
 await call('defense',{roundNumber:1,expectedVersion:0,action:'submit',text:'첫 변론'});assert.equal((await call('open-vote',firstOpen)).status,201);
 for(let i=1;i<=2;i++)assert.equal((await call('vote',{roundNumber:1,requestId:`revote-first-vote-${i}`,choice:i===1?'guilty':'not-guilty',reason:i===1?'z 첫 유죄 이유':'a 첫 무죄 이유'},f.cookies[i])).status,201);
 const s=await(await fetch(f.url,{headers:{cookie:f.cookies[0]}})).json();return {...f,path,call,firstOpen,s};}
test('첫 동률 공개→새 최후변론→2차 동률 무죄·옛 명령 격리·익명 공개 유지',async()=>{const f=await firstTie();try{
 let s=f.s;assert.equal(s.game.status,'final-defense');assert.equal(s.game.defense.roundNumber,2);assert.equal(s.game.defense.status,'pending');assert.equal(s.game.defense.text,null);const first=s.game.publishedRounds;assert.equal(first.length,1);assert.deepEqual(Object.keys(first[0].reasons[0]).sort(),['choice','reason']);
 assert.equal((await f.call('defense',{roundNumber:1,expectedVersion:s.game.version,action:'submit',text:'지연 첫 변론'})).status,409);
 assert.equal((await f.call('duration',{expectedVersion:s.game.version,durationMinutes:5})).status,409);
 let response=await f.call('defense',{roundNumber:2,expectedVersion:s.game.version,action:'submit',text:'새 최후 변론'});assert.equal(response.status,201);s=await response.json();
 const open={roundNumber:2,expectedVersion:s.game.version,requestId:'revote-second-open'};f.setNow(2000);response=await f.call('open-vote',open);assert.equal(response.status,201);s=await response.json();assert.equal(s.game.round.number,2);assert.equal(s.game.round.deadline,182000);assert.equal(s.game.durationMinutes,3);assert.equal(s.game.ownVote,null);assert.deepEqual(s.game.publishedRounds,first);
 assert.equal((await f.call('open-vote',f.firstOpen)).status,201);assert.equal((await f.call('open-vote',{...f.firstOpen,roundNumber:2})).status,409);
 assert.equal((await f.call('vote',{roundNumber:1,requestId:'new-key-old-round',choice:'guilty',reason:'낡은 표'},f.cookies[1])).status,409);
 for(let i=1;i<=2;i++){response=await f.call('vote',{roundNumber:2,requestId:`revote-second-vote-${i}`,choice:i===1?'guilty':'not-guilty',reason:'새 비공개 이유'+i},f.cookies[i]);assert.equal(response.status,201);if(i===1){const mid=await(await fetch(f.url,{headers:{cookie:f.cookies[2]}})).json();assert.deepEqual(mid.game.publishedRounds,first);assert.ok(!JSON.stringify(mid).includes('새 비공개 이유1'));assert.equal(mid.game.ownVote,null);}}
 s=await(await fetch(f.url,{headers:{cookie:f.cookies[0]}})).json();assert.equal(s.game.status,'result');assert.equal(s.game.settlement.outcome,'not-guilty');assert.equal(s.game.settlement.total,2);assert.equal(s.game.publishedRounds.length,2);
 assert.equal((await f.call('open-vote',{roundNumber:3,expectedVersion:s.game.version,requestId:'third-round-never'})).status,400);assert.equal((await f.call('open-vote',open)).status,201);
 }finally{await f.close();}});
test('최후 변론 skip/무응답 모두 개시 가능하고 2차 전원 기권은 무판결이다',async()=>{
 for(const skip of [false,true]){const f=await firstTie();try{let s=f.s;if(skip)s=await(await f.call('defense',{roundNumber:2,expectedVersion:s.game.version,action:'skip',text:''})).json();assert.equal((await f.call('open-vote',{roundNumber:2,expectedVersion:s.game.version,requestId:'no-response-second'})).status,201);
 for(let i=1;i<=2;i++)assert.equal((await f.call('vote',{roundNumber:2,requestId:`abstain-second-${i}`,choice:'abstain',reason:''},f.cookies[i])).status,201);
 s=await(await fetch(f.url,{headers:{cookie:f.cookies[0]}})).json();assert.equal(s.game.settlement.outcome,'no-verdict');assert.equal(s.game.publishedRounds[1].reasons.length,0);
 }finally{await f.close();}}
});
test('최후 변론과 2차 개시 경합은 한 버전만 반영하고 두 번째 개시는 멱등이다',async()=>{const f=await firstTie();try{
 const open={roundNumber:2,expectedVersion:f.s.game.version,requestId:'racing-second-open'};
 const raced=await Promise.all([f.call('open-vote',open),f.call('defense',{roundNumber:2,expectedVersion:f.s.game.version,action:'submit',text:'최후 경합 변론'})]);assert.deepEqual(raced.map(r=>r.status).sort(),[201,409]);
 let s=await(await fetch(f.url,{headers:{cookie:f.cookies[0]}})).json();if(s.game.status==='final-defense'){assert.equal(s.game.defense.text,'최후 경합 변론');open.expectedVersion=s.game.version;open.requestId='after-final-defense';assert.equal((await f.call('open-vote',open)).status,201);}
 const retried=await Promise.all([f.call('open-vote',open),f.call('open-vote',open)]);assert.deepEqual(retried.map(r=>r.status),[201,201]);assert.deepEqual((await retried[0].json()).game.round,(await retried[1].json()).game.round);
 }finally{await f.close();}});
