import {test} from 'node:test';import assert from 'node:assert/strict';
import {requestHistoryList,requestHistoryDetail} from '../../apps/web/src/api/history-client.ts';
test('개인 기록 목록·상세는 식별자 일치와 명시된 공개 필드만 허용한다',async()=>{
 const original=globalThis.fetch;try{
 const item={gameId:'g',state:'completed',caseText:'사건',outcome:'guilty'};
 for(const [data,ok]of [[{items:[item],nextCursor:null},true],[{items:[{...item,outcome:null}],nextCursor:null},true],[{items:[{...item,sessionId:'private'}],nextCursor:null},false],[{items:[{...item,state:'ongoing',outcome:'guilty'}],nextCursor:null},false]]){globalThis.fetch=async()=>({ok:true,json:async()=>data});assert.equal((await requestHistoryList()).ok,ok);}
 const detail={gameId:'g',game:null,interrupted:false,interruption:null,ongoing:{caseText:'진행 사건'}};
 for(const [data,ok]of [[detail,true],[{...detail,gameId:'other'},false],[{...detail,ongoing:{caseText:'진행 사건',counts:{guilty:1}}},false]]){globalThis.fetch=async()=>({ok:true,json:async()=>data});assert.equal((await requestHistoryDetail('g')).ok,ok);}
 }finally{globalThis.fetch=original;}
});
test('취소한 기록 응답은 신원 손실을 통지하지 않는다',async()=>{
 const {identityLoss}=await import('../../apps/web/src/api/identity-generation.ts');const original=globalThis.fetch;let lost=0;const stop=identityLoss.subscribe(()=>lost++);try{globalThis.fetch=async()=>({ok:false,json:async()=>({error:{code:'SESSION_REQUIRED'}})});const abort=new globalThis.AbortController();abort.abort();await requestHistoryList(undefined,abort.signal);assert.equal(lost,0);await requestHistoryList();assert.equal(lost,1);}finally{stop();globalThis.fetch=original;}
});
