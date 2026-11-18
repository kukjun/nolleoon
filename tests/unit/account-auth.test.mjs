import test from 'node:test';
import assert from 'node:assert/strict';
import {accountAuthFixture as fixture} from '../support/account-auth-fixture.mjs';

const fail=fn=>assert.throws(fn,e=>e.name==='Error'&&e.message==='유효한 브라우저 세션이 필요합니다.'||e.code==='FORBIDDEN'||e.code==='SESSION_REQUIRED'||e.code==='STATE_CONFLICT'||e.code==='INVALID_INPUT');
test('one-time state binds browser, expires, rejects replay and arbitrary redirects',async()=>{
 const f=fixture();for(const path of ['//evil.test','https://evil.test','/travel?x=1','/travel/invite/x/../../','/travel/rooms/a'])fail(()=>f.auth.begin(path));
 const b=f.auth.begin('/travel');await assert.rejects(f.auth.callback(b.state,'bad','code'));const r=await f.auth.callback(b.state,b.browserToken,'code');assert.equal(f.auth.session(r.token).account.id,r.account.id);await assert.rejects(f.auth.callback(b.state,b.browserToken,'code'));
 const exp=f.auth.begin('/travel');f.setNow(301000);await assert.rejects(f.auth.callback(exp.state,exp.browserToken,'later'));
});
test('stable provider account rotates session, blocks cross-account substitution and logout revokes',async()=>{
 const f=fixture(),b=f.auth.begin('/travel'),a=await f.auth.callback(b.state,b.browserToken,'one');const b2=f.auth.begin('/travel',b.browserToken,a.token),a2=await f.auth.callback(b2.state,b2.browserToken,'two');assert.equal(a.account.id,a2.account.id);assert.notEqual(a.token,a2.token);fail(()=>f.auth.require(a.token));
 f.setSubject('456');const b3=f.auth.begin('/travel',b.browserToken,a2.token);await assert.rejects(f.auth.callback(b3.state,b3.browserToken,'three'),e=>e.code==='STATE_CONFLICT');assert.equal(f.maps.accounts.size,1);
 f.auth.logout(a2.token,b.browserToken);fail(()=>f.auth.require(a2.token));assert.equal(f.auth.session(undefined).authenticated,false);
});
test('logout/new start during provider exchange invalidates older callback; failures consume state',async()=>{
 const f=fixture();let resolve;f.setExchange(()=>new Promise(r=>resolve=r));const b=f.auth.begin('/travel');const pending=f.auth.callback(b.state,b.browserToken,'one');f.auth.logout(undefined,b.browserToken);resolve({subject:'123'});await assert.rejects(pending);assert.equal(f.maps.sessions.size,0);
 const b2=f.auth.begin('/travel',b.browserToken);const p2=f.auth.callback(b2.state,b2.browserToken,'two');f.auth.begin('/travel',b.browserToken);resolve({subject:'123'});await assert.rejects(p2);
 f.setExchange(async()=>{throw Error('SECRET TOKEN');});const b3=f.auth.begin('/travel');await assert.rejects(f.auth.callback(b3.state,b3.browserToken,'three'),e=>e.message!=='SECRET TOKEN');await assert.rejects(f.auth.callback(b3.state,b3.browserToken,'three'));
});
test('duplicate provider code and disabled account rejected, profile CAS validates preset and name',async()=>{
 const f=fixture(),b=f.auth.begin('/travel'),a=await f.auth.callback(b.state,b.browserToken,'one');const b2=f.auth.begin('/travel');await assert.rejects(f.auth.callback(b2.state,b2.browserToken,'one'));
 const profile=f.auth.profile(a.token,{expectedRevision:0,displayName:'  친구  ',presetId:'preset-02'});assert.equal(profile.account.displayName,'친구');fail(()=>f.auth.profile(a.token,{expectedRevision:0,displayName:'다른',presetId:'preset-02'}));fail(()=>f.auth.profile(a.token,{expectedRevision:1,displayName:'친구',presetId:'https://evil.test'}));f.maps.accounts.get(a.account.id).status='disabled';fail(()=>f.auth.require(a.token));
});
test('second device same account persists profile; expired sessions and delayed old cookies never authenticate',async()=>{
 const f=fixture();const a=f.auth.begin('/travel'),one=await f.auth.callback(a.state,a.browserToken,'one');f.auth.profile(one.token,{expectedRevision:0,displayName:'내 이름',presetId:'preset-03'});
 const b=f.auth.begin('/travel'),two=await f.auth.callback(b.state,b.browserToken,'two');assert.equal(two.account.id,one.account.id);assert.equal(two.account.displayName,'내 이름');assert.equal(f.auth.session(one.token).authenticated,true);
 const a2=f.auth.begin('/travel',a.browserToken,one.token),newer=await f.auth.callback(a2.state,a2.browserToken,'three');fail(()=>f.auth.require(one.token));f.auth.logout(undefined,a.browserToken);fail(()=>f.auth.require(newer.token));assert.equal(f.auth.session(two.token).authenticated,true);
 f.setNow(30*24*60*60*1000+1000);fail(()=>f.auth.require(two.token));
});
test('cancellation consumes bound state and preserves only validated invite return',async()=>{
 const f=fixture();const path='/travel/invite/'+'a'.repeat(43),a=f.auth.begin(path);const result=await f.auth.callback(a.state,a.browserToken,undefined,true);assert.deepEqual(result,{returnPath:path,cancelled:true});assert.equal(f.maps.accounts.size,0);await assert.rejects(f.auth.callback(a.state,a.browserToken,'later'));assert.equal(f.auth.callbackReturnPath(a.state,'x'),'/travel');
});
