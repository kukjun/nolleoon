import test from 'node:test';
import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,symlinkSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadExpectedAppId,startRealVerification,permittedLocalRequest} from '../../tools/mobile/native-real-verification.mjs';
test('private config loader extracts only app ID; unsafe files fail closed',()=>{
 const dir=mkdtempSync(join(tmpdir(),'synthetic-real-loader-'));const path=join(dir,'fixture.env');
 try{writeFileSync(path,'KAKAO_NATIVE_APP_KEY=synthetic-not-read-by-server\nKAKAO_APP_ID=123\n',{mode:0o600});assert.deepEqual(loadExpectedAppId(path),{expectedAppId:123});
 chmodSync(path,0o644);assert.throws(()=>loadExpectedAppId(path));chmodSync(path,0o600);
 symlinkSync(path,join(dir,'link'));assert.throws(()=>loadExpectedAppId(join(dir,'link')));
 for(const body of ['KAKAO_APP_ID=1\nKAKAO_APP_ID=2','KAKAO_APP_ID=0','KAKAO_APP_ID=9007199254740993','KAKAO_NATIVE_APP_KEY=synthetic']){writeFileSync(path,body);assert.throws(()=>loadExpectedAppId(path));}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('explicit fresh fixture server verifies app ID via fake fetch and denies all destructive/legacy paths; close preserves storage',async()=>{
 await assert.rejects(()=>startRealVerification({}));
 const dir=mkdtempSync(join(tmpdir(),'synthetic-real-server-'));const config=join(dir,'fixture.env');writeFileSync(config,'KAKAO_APP_ID=123\n',{mode:0o600});let calls=0;
 const fixture=await startRealVerification({explicit:true,configPath:config,fixture:{parent:dir,fetcher:async(url,options)=>{calls++;assert.equal(url,'https://kapi.kakao.com/v1/user/access_token_info');assert.equal(options.headers.Authorization,'Bearer synthetic-only-fixture');return new globalThis.Response(JSON.stringify({id:10001,app_id:123,expires_in:300}),{status:200});}}});
 try{const post=(path,body={},token)=>fetch(fixture.url+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 for(const path of ['/api/native/account/delete','/api/native/travel-rooms/x/deletion','/api/native/account/profile','/api/session','/api/native/auth/kakao/','/api/native/auth/kakao?x=1','/api/native/travel-invites/a/join'])assert.equal((await post(path)).status,404);
 assert.equal(calls,0);
 const login=await post('/api/native/auth/kakao',{accessToken:'synthetic-only-fixture'});assert.equal(login.status,201);const {token}=await login.json();assert.equal(calls,1);
 const created=await post('/api/native/travel-rooms',{requestId:'synthetic-real-create',title:'Synthetic verification room',startDate:null,endDate:null},token);assert.equal(created.status,201);
 const room=await created.json();assert.equal((await fetch(fixture.url+'/api/native/travel-rooms/'+room.roomId,{headers:{Authorization:'Bearer '+token}})).status,200);
 assert.equal((await post('/api/native/auth/logout',{},token)).status,201);assert.equal(calls,1);
 }finally{await fixture.close();assert.ok(existsSync(fixture.directory));rmSync(dir,{recursive:true,force:true});}
});

test('raw route allowlist rejects aliases, queries, unsafe methods and unsupported native actions',()=>{
 for(const path of ['/api/native/account/delete','/api/native/auth/unlink','/api/native/auth/kakao/','/api/native/auth/kakao?x=1','/api/native/travel-rooms/x/history','/api/native/travel-rooms/%78','/api/native/travel-rooms/x/../account/delete','/API/native/account/session'])for(const method of ['GET','POST','DELETE','PATCH','HEAD','OPTIONS'])assert.equal(permittedLocalRequest(method,path),false);
 assert.equal(permittedLocalRequest('GET','/api/native/account/session'),true);
 assert.equal(permittedLocalRequest('GET','/api/native/travel-rooms'),true);
});
test('Kakao app mismatch is rejected without creating a local session',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'synthetic-real-mismatch-'));const config=join(dir,'fixture.env');writeFileSync(config,'KAKAO_APP_ID=123\n',{mode:0o600});
 const server=await startRealVerification({explicit:true,configPath:config,fixture:{parent:dir,fetcher:async()=>new globalThis.Response(JSON.stringify({id:10001,app_id:999,expires_in:300}),{status:200})}});
 try{const result=await fetch(server.url+'/api/native/auth/kakao',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:'synthetic-only-fixture'})});assert.equal(result.status,503);assert.equal(JSON.stringify(await result.json()).includes('synthetic-only-fixture'),false);const db=new Database(join(server.directory,'verification.sqlite'),{readonly:true});try{assert.equal(db.prepare('SELECT count(*) AS n FROM native_account_sessions').get().n,0);assert.equal(db.prepare('SELECT count(*) AS n FROM accounts').get().n,0);}finally{db.close();}}
 finally{await server.close();rmSync(dir,{recursive:true,force:true});}
});
