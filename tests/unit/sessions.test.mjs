import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserSessions, SESSION_LIFETIME_MS } from '../../apps/api/dist/application/browser-sessions.js';
import { FakeClock } from '../support/fakes.mjs';
test('세션 신원은 닉네임과 별개이고 유효 쿠키만 복구한다',()=>{
 const records=[];const clock=new FakeClock(1000);let sequence=0;
 const uow={run:work=>work({sessions:{insert:r=>records.push({...r}),findByTokenHash:h=>records.find(r=>r.tokenHash===h),extendExpiry:(id,expiry)=>{records.find(r=>r.id===id).expiresAt=expiry;}}})};
 const codec={token:()=>String(++sequence).padStart(43,'a'),id:()=>`identity-${sequence}`,hash:t=>`hash:${t}`};
 const service=new BrowserSessions(uow,clock,codec);
 const first=service.open();assert.equal(records.length,1);assert.notEqual(records[0].tokenHash,first.token);
 assert.equal(service.require(first.token).id,records[0].id);
 clock.advance(100);assert.equal(service.open(first.token).token,first.token);assert.equal(records.length,1);
 assert.equal(records[0].expiresAt,clock.now()+SESSION_LIFETIME_MS);
 assert.throws(()=>service.require());assert.throws(()=>service.require('forged'));
 const second=service.open();assert.notEqual(second.token,first.token);assert.equal(records.length,2);
 clock.advance(SESSION_LIFETIME_MS);assert.throws(()=>service.require(first.token));
});
