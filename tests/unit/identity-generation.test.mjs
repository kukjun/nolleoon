import {test} from 'node:test';import assert from 'node:assert/strict';
import {AuthGeneration,IdentityLossChannel} from '../../apps/web/src/api/identity-generation.ts';
test('옛 인증 응답은 새 신원을 무효화하지 않는다',()=>{const auth=new AuthGeneration();const old=auth.begin();const fresh=auth.begin();assert.equal(auth.current(old),false);assert.equal(auth.current(fresh),true);});
test('이전 화면의 신원 실패 통지는 새 화면에 전달하지 않고 한 번만 처리한다',()=>{const channel=new IdentityLossChannel();let old=0,fresh=0;const stop=channel.subscribe(()=>old++);const late=channel.capture();stop();channel.subscribe(()=>fresh++);late();assert.equal(old,0);assert.equal(fresh,0);const current=channel.capture();current();current();assert.equal(fresh,1);});
test('취소한 이전 요청의 늦은 401은 신원 손실로 통지하지 않는다',async()=>{
 const {identityLoss}=await import('../../apps/web/src/api/identity-generation.ts');const {requestRoom}=await import('../../apps/web/src/api/rooms-client.ts');const original=globalThis.fetch;let lost=0;const stop=identityLoss.subscribe(()=>lost++);let release;const gate=new Promise(resolve=>release=resolve);const request=new globalThis.AbortController();
 try{globalThis.fetch=async()=>({ok:false,json:async()=>{await gate;return {error:{code:'SESSION_REQUIRED'}};}});const result=requestRoom('code',undefined,request.signal);request.abort();release();await result;assert.equal(lost,0);}finally{stop();globalThis.fetch=original;}
});
