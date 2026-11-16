import test from 'node:test';import assert from 'node:assert/strict';
import {requestSession} from '../../apps/web/src/api/session-client.ts';
test('클라이언트 자동 renew는 전용 endpoint만 호출하고 401 뒤 발급 fallback을 하지 않는다',async()=>{
 const calls=[];const controller=new globalThis.AbortController();
 const result=await requestSession('RENEW',async(url,init)=>{calls.push({url,init});return new globalThis.Response(JSON.stringify({error:{code:'SESSION_REQUIRED',message:'ignored'}}),{status:401});},controller.signal);
 assert.equal(result.ok,false);assert.equal(result.code,'SESSION_REQUIRED');assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/session/renew');assert.equal(calls[0].init.method,'POST');assert.equal(calls[0].init.signal,controller.signal);assert.equal(calls[0].init.body,'{}');
});
