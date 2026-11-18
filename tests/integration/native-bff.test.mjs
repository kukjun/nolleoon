import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import {NestFactory} from '@nestjs/core';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {DurableKakaoUnlinkOutbox,initializeUnlinkOutbox} from '../../apps/api/dist/infrastructure/auth/kakao-unlink-outbox.js';
import {AppModule} from '../../apps/api/dist/composition/app.module.js';
const origin='https://native-test.example';
async function fixture(t,options={}) {
 const dir=mkdtempSync(join(tmpdir(),'native-bff-'));
 const records=[],roomRecords=[];
 const deletionLedger={entries:()=>records,record:e=>{records.push(e);return e;}};
 const roomDeletionLedger={entries:()=>roomRecords,lookup:id=>roomRecords.find(e=>e.operationId===id),record:e=>{roomRecords.push(e);return e;}};
 const queuePaths=['pending','journal','checkpoint'].map(x=>join(dir,x));initializeUnlinkOutbox(...queuePaths);const kakaoUnlinkOutbox=new DurableKakaoUnlinkOutbox(...queuePaths);
 const app=await NestFactory.create(AppModule.register({dbPath:join(dir,'test.sqlite'),publicOrigin:origin,presenceMonitor:false,settlementMonitor:false,roomDeletionMonitor:false,unlinkMonitor:false,deletionLedger,roomDeletionLedger,kakaoUnlinkOutbox,nativeKakaoVerifier:{verify:async token=>({subject:token==='provider-a'?'1001':'1002',expiresInSeconds:300})},...options}),{logger:false,abortOnError:false});
 app.setGlobalPrefix('api');await app.listen(0,'127.0.0.1');
 const db=new Database(join(dir,'test.sqlite'));
 t.after(async()=>{db.close();await app.close();rmSync(dir,{recursive:true,force:true});});
 const base=(await app.getUrl())+'/api';
 const call=(path,token,body,method=body===undefined?'GET':'POST',headers={})=>fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const login=async(name='provider-a')=>{const response=await call('/native/auth/kakao',undefined,{accessToken:name});assert.equal(response.status,201);assert.equal(response.headers.get('set-cookie'),null);return response.json();};
 return {base,app,dir,db,call,login,records};
}
test('native protected routes exist and never fall back to missing credentials',async t=>{
 const {base}=await fixture(t);
 assert.equal((await fetch(base+'/native/travel-rooms')).status,401);
});

const createBody={requestId:'create',title:'Native room',startDate:null,endDate:null};
test('native and web credentials remain separated, login never sets cookies or accepts claimed IDs',async t=>{
 const f=await fixture(t),a=await f.login(),token=a.token;
 const cookie='__Host-trip_account='+token;
 for(const headers of [{Cookie:cookie},{Cookie:cookie,Authorization:'Bearer '+token},{Authorization:'Bearer x'},{Authorization:'Bearer '+token+', Bearer '+token}])assert.ok([401,403].includes((await fetch(f.base+'/native/travel-rooms',{headers})).status));
 assert.equal((await f.call('/account/session',token)).status,403);
 assert.equal((await f.call('/native/auth/kakao',undefined,{accessToken:'provider-a',accountId:'forged'})).status,400);
 assert.equal((await f.call('/native/auth/kakao',token,{accessToken:'provider-a'})).status,403);
 assert.equal((await f.call('/native/auth/logout',token,{extra:true})).status,400);
 assert.equal((await f.call('/native/auth/logout',token,{})).status,201);
 assert.equal((await f.call('/native/account/session',token)).status,401);
});
test('shared route metadata preserves web CSRF, native DTO parity and all route params',async t=>{
 const f=await fixture(t),a=await f.login(),b=await f.login('provider-b');
 const web='w'.repeat(43),hash=createHash('sha256').update(web).digest('hex');
 f.db.prepare('INSERT INTO account_sessions VALUES (?,?,?,1,?,NULL)').run(hash,a.account.id,'web-fixture',Date.now()+100000);
 const webHeaders={Cookie:'__Host-trip_account='+web};
 assert.equal((await f.call('/travel-rooms',undefined,createBody,'POST',webHeaders)).status,403);
 assert.equal((await f.call('/native/travel-rooms',a.token,[])).status,400);
 assert.equal((await f.call('/native/travel-rooms',a.token,{...createBody,accountId:'other'})).status,400);
 const room=await (await f.call('/native/travel-rooms',a.token,createBody)).json();assert.ok(room.roomId);
 const native=await f.call('/native/travel-rooms/'+room.roomId,a.token);assert.equal(native.status,200);
 const webRead=await f.call('/travel-rooms/'+room.roomId,undefined,undefined,'GET',webHeaders);assert.equal(webRead.status,200);assert.deepEqual(await native.json(),await webRead.json());
 assert.equal((await f.call('/native/travel-rooms/'+room.roomId,b.token)).status,403);
 const invite=await (await f.call(`/native/travel-rooms/${room.roomId}/invite`,a.token,{requestId:'invite',expectedVersion:0})).json();
 assert.deepEqual(await (await f.call('/native/travel-invites/'+invite.inviteToken+'/preview')).json(),{available:true,loginRequired:true});
 assert.equal((await f.call('/native/travel-invites/'+invite.inviteToken+'/join',undefined,{requestId:'join'})).status,401);
 const joined=await f.call('/native/travel-invites/'+invite.inviteToken+'/join',b.token,{requestId:'join'});assert.equal(joined.status,201);const joinedRoom=await joined.json();
 const kicked=await f.call(`/native/travel-rooms/${room.roomId}/members/${joinedRoom.self.membershipId}/remove`,a.token,{requestId:'kick',expectedVersion:joinedRoom.version});assert.equal(kicked.status,201);
 assert.equal((await f.call('/native/travel-rooms/'+room.roomId,b.token)).status,403);
 assert.equal((await f.call('/native/travel-rooms?extra=x',a.token)).status,400);
 assert.equal((await f.call('/native/travel-deleted-rooms?extra=x',a.token)).status,400);
 for(const [method,path] of [['PATCH',''],['POST','/status'],['POST','/invite/revoke'],['POST','/administrator'],['POST','/leave'],['POST','/deletion'],['POST','/restore'],['POST','/runs'],['PATCH','/runs/missing'],['POST','/runs/missing/cancel'],['POST','/runs/missing/start'],['POST','/runs/missing/actions']]){
  const response=await f.call('/native/travel-rooms/'+room.roomId+path,a.token,{invalid:true},method);assert.equal(response.status,400,method+' '+path);
 }
 assert.equal((await f.call('/native/travel-rooms/'+room.roomId+'/history',a.token)).status,200);
 assert.equal((await f.call('/native/travel-rooms/'+room.roomId+'/runs/missing',a.token)).status,404);
});
test('native profile and avatar share CAS/ACL/normalization without accepting web cookies',async t=>{
 const f=await fixture(t),a=await f.login(),b=await f.login('provider-b');
 let res=await f.call('/native/account/profile',a.token,{displayName:'앱 여행자',presetId:'preset-02',expectedRevision:0});assert.equal(res.status,201);assert.equal((await res.json()).account.displayName,'앱 여행자');
 assert.equal((await f.call('/native/account/profile',a.token,{displayName:'stale',presetId:'preset-02',expectedRevision:0})).status,409);
 const avatar=await (await f.call('/native/account/avatar',a.token)).json();
 const sharp=(await import('sharp')).default;
 const bytes=await sharp({create:{width:32,height:32,channels:3,background:'blue'}}).png().toBuffer();
 res=await fetch(f.base+'/native/account/avatar/image',{method:'PUT',headers:{Authorization:'Bearer '+a.token,'Content-Type':'image/png','X-Avatar-Revision':String(avatar.revision)},body:bytes});assert.equal(res.status,200);const uploaded=await res.json();assert.match(uploaded.imageUrl,/^\/api\/native\/account\/avatar\/image\?v=\d+$/);
 res=await f.call(uploaded.imageUrl.replace(/^\/api/,''),a.token);assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'image/webp');assert.equal(res.headers.get('cache-control'),'no-store');
 assert.equal((await f.call(uploaded.imageUrl.replace(/^\/api/,''),b.token)).status,404);
 const room=await (await f.call('/native/travel-rooms',a.token,createBody)).json();
 res=await f.call(`/native/travel-rooms/${room.roomId}/avatars`,a.token);assert.equal(res.status,200);const members=(await res.json()).members;
 assert.match(members[0].avatar.imageUrl,/^\/api\/native\/travel-rooms\//);
 assert.equal((await f.call(members[0].avatar.imageUrl.replace(/^\/api/,''),b.token)).status,403);
 assert.equal((await fetch(f.base+'/native/account/avatar/image',{method:'PUT',headers:{Authorization:'Bearer '+a.token,'Content-Type':'text/plain','X-Avatar-Revision':'0'},body:'bad'})).status,400);
 assert.equal((await f.call('/native/account/legacy',a.token)).status,200);
 assert.equal((await f.call('/native/account/legacy/import',a.token,{runIds:[]})).status,404);
 assert.equal((await f.call('/native/account/legacy/preview',a.token)).status,404);
});
test('native deletion permits exact receipt retry, removes all devices and never uses web receipt',async t=>{
 const f=await fixture(t),a=await f.login(),other=await f.login(),body={requestId:'delete',confirmation:'계정 탈퇴'};
 const web='w'.repeat(43);f.db.prepare('INSERT INTO account_sessions VALUES (?,?,?,1,?,NULL)').run(createHash('sha256').update(web).digest('hex'),a.account.id,'web',Date.now()+100000);
 assert.equal((await f.call('/native/account/delete',a.token,{...body,confirmation:'yes'})).status,400);
 let res=await f.call('/native/account/delete',a.token,body);assert.equal(res.status,201);assert.deepEqual(await res.json(),{deleted:true});assert.equal(res.headers.get('set-cookie'),null);
 assert.equal((await f.call('/native/account/delete',a.token,body)).status,201);
 assert.equal((await f.call('/native/account/delete',a.token,{...body,requestId:'other'})).status,401);
 assert.equal((await f.call('/native/account/session',other.token)).status,401);
 assert.equal((await f.call('/account/session',undefined,undefined,'GET',{Cookie:'__Host-trip_account='+web})).status,401);
 assert.equal((await f.call('/native/account/delete',web,body)).status,401);
 assert.equal(f.records.length,1);
});
test('validated native and web requests share account budget; invalid credentials do not impersonate account',async t=>{
 const f=await fixture(t),a=await f.login(),b=await f.login('provider-b'),web='w'.repeat(43);
 f.db.prepare('INSERT INTO account_sessions VALUES (?,?,?,1,?,NULL)').run(createHash('sha256').update(web).digest('hex'),a.account.id,'web',Date.now()+100000);
 for(let i=0;i<180;i++){
  const res=i%2===0?await f.call('/native/account/profile',a.token,{bad:true}):await f.call('/account/profile',undefined,{bad:true},'POST',{Cookie:'__Host-trip_account='+web,Origin:origin,'X-Trip-Court-Request':'1'});
  assert.equal(res.status,400,`write ${i}`);
 }
 const limited=await f.call('/native/account/profile',a.token,{bad:true});assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
 assert.equal((await f.call('/native/account/profile',b.token,{bad:true})).status,400);
 assert.equal((await f.call('/native/account/session','x'.repeat(43))).status,401);
});
test('native photo HTTP rejects a session revoked while the injected decoder is awaiting',async t=>{
 const {AccountAvatars}=await import('../../apps/api/dist/application/account-avatars.js');
 const f=await fixture(t),a=await f.login();let release,entered;
 const started=new Promise(resolve=>{entered=resolve;});const resume=new Promise(resolve=>{release=resolve;});
 const service=f.app.get(AccountAvatars);const original=service.images;
 // Explicit isolated processor fixture; real image normalization is exercised in the previous test.
 service.images={thumbnail:async()=>{entered();await resume;return new Uint8Array([1,2,3]);}};
 t.after(()=>{release();service.images=original;});
 const upload=fetch(f.base+'/native/account/avatar/image',{method:'PUT',headers:{Authorization:'Bearer '+a.token,'Content-Type':'image/png','X-Avatar-Revision':'0'},body:new Uint8Array([1,2,3])});
 await Promise.race([started,upload.then(response=>{throw new Error('upload ended before decoder '+response.status);})]);assert.equal((await f.call('/native/auth/logout',a.token,{})).status,201);release();
 assert.equal((await upload).status,401);assert.equal(f.db.prepare('SELECT count(*) n FROM account_avatars').get().n,0);
});
test('native verifier disabled and absent authoritative journals fail closed without creating accounts',async t=>{
 const disabled=await fixture(t,{nativeKakaoVerifier:undefined});assert.equal((await disabled.call('/native/auth/kakao',undefined,{accessToken:'synthetic'})).status,503);assert.equal(disabled.db.prepare('SELECT count(*) n FROM accounts').get().n,0);
 const missing=await fixture(t,{deletionLedger:undefined,roomDeletionLedger:undefined});assert.equal((await missing.call('/native/auth/kakao',undefined,{accessToken:'synthetic'})).status,503);assert.equal(missing.db.prepare('SELECT count(*) n FROM accounts').get().n,0);
});
test('native exchange rechecks authority after async provider verification before account creation',async t=>{
 let fail=false,entered,release;const started=new Promise(r=>{entered=r;}),resume=new Promise(r=>{release=r;});
 const f=await fixture(t,{deletionLedger:{entries:()=>{if(fail)throw new Error('synthetic-private-authority-failure');return[];},record:e=>e},nativeKakaoVerifier:{verify:async()=>{entered();await resume;return{subject:'777',expiresInSeconds:300};}}});
 t.after(()=>release());const pending=f.call('/native/auth/kakao',undefined,{accessToken:'synthetic-secret-provider-token'});
 await Promise.race([started,pending.then(r=>{throw new Error('exchange ended early '+r.status);})]);fail=true;release();const result=await pending;assert.equal(result.status,503);const text=await result.text();assert.equal(text.includes('synthetic-private'),false);assert.equal(text.includes('synthetic-secret'),false);assert.equal(f.db.prepare('SELECT count(*) n FROM accounts').get().n,0);
});
test('native game create/start/read/history invokes the existing engine and immutable retry',async t=>{
 const f=await fixture(t),a=await f.login(),b=await f.login('provider-b');
 const room=await (await f.call('/native/travel-rooms',a.token,createBody)).json(),root='/native/travel-rooms/'+room.roomId;
 const invite=await (await f.call(root+'/invite',a.token,{requestId:'invite',expectedVersion:0})).json();
 const joined=await (await f.call('/native/travel-invites/'+invite.inviteToken+'/join',b.token,{requestId:'join'})).json();
 const draftResponse=await f.call(root+'/runs',a.token,{requestId:'game',expectedVersion:joined.version,type:'team',selectedMembershipIds:joined.members.map(m=>m.membershipId),settings:{teamCount:2}});assert.equal(draftResponse.status,201);const draft=await draftResponse.json();
 assert.deepEqual(draft.game.assignments,[]);const path=root+'/runs/'+draft.runId,command={requestId:'start',expectedVersion:draft.version};
 const result=await f.call(path+'/start',a.token,command);assert.equal(result.status,201);const finished=await result.json();assert.equal(finished.status,'completed');assert.deepEqual(finished.game.assignments.map(x=>x.team).sort(),[1,2]);
 assert.deepEqual(await (await f.call(path+'/start',a.token,command)).json(),finished);
 const guest=await f.call(path,b.token);assert.equal(guest.status,200);assert.deepEqual((await guest.json()).game,finished.game);
 assert.equal((await f.call(root+'/history',b.token)).status,200);
});
