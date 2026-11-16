import test from 'node:test';import assert from 'node:assert/strict';
import {publishedRounds} from '../../apps/api/dist/application/published-rounds.js';
test('이유 공개는 완료된 라운드 allowlist만 쓰고 명단·접수 순서와 분리한다',()=>{
 const votes=[{choice:'not-guilty',reason:'a',memberId:'m1',sessionId:'secret',submittedAt:1,requestId:'r1'},{choice:'guilty',reason:'z',memberId:'m2',submittedAt:2},{choice:'abstain',reason:'',memberId:'m3'}];
 const r={rounds:{find:()=>({gameId:'g',number:1,deadline:10})},participants:{list:()=>[{memberId:'m1',eligible:true,role:'participant'},{memberId:'m2',eligible:true,role:'participant'},{memberId:'m3',eligible:true,role:'participant'}]},settlements:{find:(g,n)=>n===1?{guilty:1,notGuilty:1,abstain:1}:undefined},votes:{list:()=>votes}};
 votes.push({choice:'guilty',reason:'피고 비밀',memberId:'defendant',submittedAt:1},{choice:'guilty',reason:'마감 후 비밀',memberId:'m1',submittedAt:10});
 const first=publishedRounds(r,'g');votes.reverse();assert.deepEqual(publishedRounds(r,'g'),first);assert.deepEqual(first,[{number:1,counts:{guilty:1,notGuilty:1,abstain:1},reasons:[{choice:'guilty',reason:'z'},{choice:'not-guilty',reason:'a'}]}]);
});
