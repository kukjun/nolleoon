import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReturnTo,validAuthorizationUrl,accountSession,beginLogin} from '../../apps/web/src/api/travel-client.ts';
test('login return paths accept only internal travel home and opaque invitation',()=>{
 assert.equal(safeReturnTo('/travel'),'/travel');
 assert.equal(safeReturnTo('/travel/invite/abcdefghijklmnopqrstudefghijklmnopq_1234'),'/travel/invite/abcdefghijklmnopqrstudefghijklmnopq_1234');
 for(const value of ['//evil.example','https://evil.example','/travel/rooms/private','/travel/invite/a?next=//evil','/travel/invite/%2f%2fevil','/travel/invite/..'])assert.equal(safeReturnTo(value),'/travel');
});
test('provider navigation rejects deceptive hosts, credentials, protocols and paths',()=>{
 assert.equal(validAuthorizationUrl('https://kauth.kakao.com/oauth/authorize?client_id=test&state=test'),true);
 for(const value of ['https://kauth.kakao.com.evil.example/oauth/authorize','https://user@kauth.kakao.com/oauth/authorize','http://kauth.kakao.com/oauth/authorize','https://kauth.kakao.com/other','javascript:alert(1)'])assert.equal(validAuthorizationUrl(value),false);
});
test('session does not accept malformed identity or trust error text',async()=>{
 const res=await accountSession(undefined,async()=>globalThis.Response.json({authenticated:true,account:{id:'acct-1',displayName:'친구',presetId:'preset-01',revision:0}}));assert.equal(res.ok,true);
 const bad=await accountSession(undefined,async()=>globalThis.Response.json({authenticated:true,account:{id:''}}));assert.equal(bad.ok,false);
 const fail=await accountSession(undefined,async()=>globalThis.Response.json({error:{code:'FORBIDDEN',message:'private backend detail'}},{status:403}));assert.equal(fail.ok,false);assert.doesNotMatch(fail.message,/private/);
});
test('login is protected POST and refuses malformed authorization destination',async()=>{
 let seen;const res=await beginLogin('/travel/invite/abcdefghijklmnopqrstu',undefined,async(path,init)=>{seen={path,init};return globalThis.Response.json({authorizationUrl:'https://kauth.kakao.com/oauth/authorize?state=test'});});assert.equal(res.ok,true);assert.equal(seen.init.method,'POST');assert.equal(seen.init.credentials,'same-origin');assert.equal(seen.init.headers['X-Trip-Court-Request'],'1');assert.equal(JSON.parse(seen.init.body).returnTo,'/travel/invite/abcdefghijklmnopqrstu');
 assert.equal((await beginLogin('/travel',undefined,async()=>globalThis.Response.json({authorizationUrl:'https://evil.example'}))).ok,false);
});
import {validTravelSnapshot} from '../../apps/web/src/api/travel-room-client.ts';
test('travel room validates identity, lifecycle, membership and active run before rendering',()=>{
 const room={roomId:'room-1',title:'여행',startDate:null,endDate:null,status:'open',version:0,self:{membershipId:'m1',isAdmin:true},members:[{membershipId:'m1',nickname:'친구',connected:false,isAdmin:true,presetId:'preset-02'}],activeRun:null};
 assert.equal(validTravelSnapshot(room),true);assert.equal(validTravelSnapshot({...room,status:'deleted'}),false);assert.equal(validTravelSnapshot({...room,roomId:'../../other'}),false);assert.equal(validTravelSnapshot({...room,members:[{nickname:'secret'}]}),false);assert.equal(validTravelSnapshot({...room,activeRun:{runId:'r',type:'team',status:'active'}}),false);
});
