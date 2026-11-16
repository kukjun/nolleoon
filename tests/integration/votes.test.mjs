import test from 'node:test';
import assert from 'node:assert/strict';
import {votingFixture} from '../support/voting-fixture.mjs';
async function opened(){const f=await votingFixture();const path=`games/${f.s.game.gameId}`;const res=await f.post(`${path}/open-vote`,f.cookies[0],{roundNumber:1,expectedVersion:0,requestId:'votes-open-request'});assert.equal(res.status,201);return {...f,path};}
const vote={roundNumber:1,requestId:'submit-vote-request-001',choice:'guilty',reason:'약속을 지키지 않았어요'};
test('투표 권한·입력·한 표·동일 의도 재시도·본인만 공개',async()=>{const f=await opened();try{
 const call=(body=vote,c=f.cookies[1])=>f.post(`${f.path}/vote`,c,body);
 assert.equal((await call(vote,f.cookies[0])).status,403);
 for(const body of [{...vote,reason:''},{...vote,reason:'  '},{...vote,choice:['guilty']},{...vote,reason:'bad\u0000'},{...vote,reason:'a'.repeat(2001)},{...vote,memberId:'spoof'}])assert.equal((await call(body)).status,400);
 assert.equal((await call({...vote,roundNumber:2})).status,409);
 const responses=await Promise.all([call(),call()]);assert.deepEqual(responses.map(r=>r.status),[201,201]);const own=await responses[0].json();assert.deepEqual(own.receipt,{gameId:f.s.game.gameId,roundNumber:1,choice:vote.choice,reason:vote.reason});assert.deepEqual(own.snapshot.game.ownVote,{roundNumber:1,choice:vote.choice,reason:vote.reason});
 assert.equal((await call(vote,f.cookies[2])).status,409);
 assert.equal((await call({...vote,reason:'바꿀 수 없음'})).status,409);assert.equal((await call({...vote,requestId:'another-request-0001'})).status,409);
 const other=await(await fetch(f.url,{headers:{cookie:f.cookies[2]}})).json();assert.equal(other.game.ownVote,null);assert.ok(!JSON.stringify(other).includes(vote.reason));
 f.setNow(181000);assert.equal((await call()).status,201);const expired=await call({...vote,requestId:'late-new-vote-key'},f.cookies[2]);assert.equal(expired.status,409);assert.equal((await expired.json()).error.code,'DEADLINE_PASSED');
 }finally{await f.close();}});
test('동시 다른키는 한 표·기권 이유 선택·현재 라운드와 새 관전자 차단',async()=>{const f=await opened();try{
 const call=(body,c=f.cookies[1])=>f.post(`${f.path}/vote`,c,body);
 const raced=await Promise.all([call({...vote,choice:'abstain',reason:''}),call({...vote,requestId:'competing-vote-key'})]);assert.deepEqual(raced.map(r=>r.status).sort(),[201,409]);
 assert.equal((await call({...vote,requestId:'other-user-vote-key',choice:'not-guilty',reason:'<img src=x onerror=alert(1)>'},f.cookies[2])).status,201);
 const all=await(await fetch(f.url,{headers:{cookie:f.cookies[0]}})).json();assert.ok(['result','final-defense'].includes(all.game.status));assert.equal(all.game.settlement.total,2);assert.equal(all.game.ownVote,null);
 }finally{await f.close();}});
test('늦은 관전자·위조 세션·CSRF·다른 게임은 투표를 만들지 못한다',async()=>{const f=await opened();try{
 const opts=body=>({method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1'},body:JSON.stringify(body)});
 let res=await fetch(`${f.url.split('/api/rooms')[0]}/api/session`,opts({}));const cookie=res.headers.get('set-cookie').split(';')[0];
 // fixture.url은 방 주소다. 세션은 동일 서버의 API 루트에서 발급한다.
 res=await f.post('join',cookie,{nickname:'늦게 온 친구'});assert.equal(res.status,201);assert.equal((await res.json()).game.self.role,'observer');
 assert.equal((await f.post(`${f.path}/vote`,cookie,vote)).status,403);
 assert.equal((await f.post(`${f.path}/vote`,'__Host-trip_session=forged',vote)).status,401);
 assert.equal((await f.post('games/other-game/vote',f.cookies[1],vote)).status,404);
 assert.equal((await fetch(`${f.url}/${f.path}/vote`,{...opts(vote),headers:{...opts(vote).headers,cookie:f.cookies[1],origin:'https://evil.example'}})).status,403);
 const s=await(await fetch(f.url,{headers:{cookie:f.cookies[1]}})).json();assert.equal(s.game.ownVote,null);
 }finally{await f.close();}});
