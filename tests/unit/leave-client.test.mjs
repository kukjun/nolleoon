import {test} from 'node:test';import assert from 'node:assert/strict';
import {requestLeave} from '../../apps/web/src/api/rooms-client.ts';
test('나가기 응답은 요청 멤버와 일치하는 엄격한 영수증만 인정한다',async()=>{
 const original=globalThis.fetch;try{for(const receipt of [{left:true,memberId:'m'},{left:true,memberId:'other'},{left:true,memberId:'m',secret:'hidden'}]){globalThis.fetch=async(_url,options)=>{assert.deepEqual(JSON.parse(options.body),{expectedMemberId:'m'});return {ok:true,json:async()=>receipt};};const result=await requestLeave('room','m');assert.equal(result.ok,receipt.memberId==='m'&&!('secret'in receipt));}}finally{globalThis.fetch=original;}
});
test('나가기 신원 오류는 현재 신원에만 알리고 취소된 응답은 무시한다',async()=>{
 const {identityLoss}=await import('../../apps/web/src/api/identity-generation.ts');const original=globalThis.fetch;let lost=0;const stop=identityLoss.subscribe(()=>lost++);
 try{globalThis.fetch=async()=>({ok:false,json:async()=>({error:{code:'SESSION_REQUIRED'}})});const aborted=new globalThis.AbortController();aborted.abort();await requestLeave('room','m',aborted.signal);assert.equal(lost,0);await requestLeave('room','m');assert.equal(lost,1);}finally{stop();globalThis.fetch=original;}
});
