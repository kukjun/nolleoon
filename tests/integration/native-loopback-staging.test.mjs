import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {startSyntheticStaging} from '../../tools/mobile/native-loopback-staging.mjs';
test('staging requires explicit opt-in and refuses production-like bind/path overrides',async()=>{
 for(const options of [{},{synthetic:true,host:'0.0.0.0'},{synthetic:true,port:3101},{synthetic:true,dbPath:'/tmp/existing.sqlite'},{synthetic:true,publicOrigin:'https://nolleoon.example'}]) await assert.rejects(()=>startSyntheticStaging(options));
});
test('actual native session and room use fresh isolated loopback DB; invalid verifier rejected; cleanup owned only',async()=>{
 const fixture=await startSyntheticStaging({synthetic:true});
 try{
  assert.match(fixture.url,/^http:\/\/127\.0\.0\.1:[0-9]+$/);
  assert.ok(existsSync(fixture.directory));
  const call=(path,body,token)=>fetch(fixture.url+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),redirect:'error'});
  const denied=await call('/native/auth/kakao',{accessToken:'not-synthetic'});assert.notEqual(denied.status,201);
  const response=await call('/native/auth/kakao',{accessToken:'synthetic-provider-a'});assert.equal(response.status,201);
  const session=await response.json();assert.match(session.token,/^[A-Za-z0-9_-]{43}$/);
  const created=await call('/native/travel-rooms',{requestId:'synthetic-staging-create',title:'Synthetic staging room',startDate:null,endDate:null},session.token);assert.equal(created.status,201);assert.equal((await created.json()).title,'Synthetic staging room');
 }finally{await fixture.close();}
 assert.equal(existsSync(fixture.directory),false);await fixture.close();
});
