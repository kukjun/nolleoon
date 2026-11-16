import {test} from 'node:test';import assert from 'node:assert/strict';
import {requestGameHistory} from '../../apps/web/src/api/rooms-client.ts';
test('과거 기록은 별도 계약으로 읽고 다른 게임·개인정보·현재 방 snapshot 혼합을 거부한다',async()=>{
 const original=globalThis.fetch;const valid={gameId:'g',game:null,interrupted:true,interruption:{caseText:null}};
 try{for(const [payload,ok]of [[valid,true],[{...valid,gameId:'other'},false],[{...valid,roomId:'room'},false],[{...valid,interruption:{caseText:'사건',votes:[]}},false]]){globalThis.fetch=async()=>({ok:true,json:async()=>payload});assert.equal((await requestGameHistory('code','g')).ok,ok);}}finally{globalThis.fetch=original;}
});
