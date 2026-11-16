import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/dist/composition/app.module.js';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { apiFixture } from '../support/api-fixture.mjs';
import { FakeClock } from '../support/fakes.mjs';
import { openSqlite } from '../../apps/api/dist/infrastructure/sqlite/index.js';
import { SESSION_LIFETIME_MS } from '../../apps/api/dist/application/browser-sessions.js';
const cookieName='__Host-trip_session';
async function issue(f,headers={},body={}) { return fetch(`${f.url}/api/session`,{method:'POST',headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1',...headers},body:JSON.stringify(body)}); }
test('쿠키 전용 발급·서버 hash 저장·복귀·위조/누락/만료 차단',async()=>{
 const clock=new FakeClock(1000);const f=await apiFixture({clock});let db;
 try {
  assert.equal((await fetch(`${f.url}/api/session`)).status,401);
  const first=await issue(f);assert.equal(first.status,201);assert.deepEqual(await first.json(),{authenticated:true});
  assert.equal(first.headers.get('cache-control'),'no-store');const setCookie=first.headers.get('set-cookie');
  for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=7776000'])assert.ok(setCookie.includes(flag));
  assert.ok(!setCookie.includes('Domain='));const cookie=setCookie.split(';')[0];const token=cookie.slice(cookieName.length+1);
  assert.match(token,/^[A-Za-z0-9_-]{43}$/);
  db=openSqlite(f.dbPath);const row=db.prepare('SELECT * FROM sessions').get();
  assert.equal(row.token_hash,createHash('sha256').update(token).digest('hex'));assert.notEqual(row.id,token);
  const recovered=await fetch(`${f.url}/api/session?participantId=someone-else`,{headers:{cookie,'x-participant-id':'someone-else'}});
  assert.equal(recovered.status,200);assert.deepEqual(await recovered.json(),{authenticated:true});
  clock.advance(100);const renewed=await issue(f,{cookie});assert.equal(renewed.headers.get('set-cookie').split(';')[0],cookie);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,1);
  assert.equal(db.prepare('SELECT expires_at FROM sessions').get().expires_at,clock.now()+SESSION_LIFETIME_MS);
  const newBrowser=await issue(f);assert.notEqual(newBrowser.headers.get('set-cookie').split(';')[0],cookie);
  assert.equal((await fetch(`${f.url}/api/session`,{headers:{cookie:`${cookieName}=${'x'.repeat(43)}`}})).status,401);
  for(const invalidCookie of [`${cookieName}=%%%`,`${cookie}; ${cookie}`,`${cookieName}=`]) assert.equal((await fetch(`${f.url}/api/session`,{headers:{cookie:invalidCookie}})).status,401);
  assert.equal((await fetch(`${f.url}/api/session?participantId=${row.id}`,{headers:{'x-participant-id':row.id}})).status,401);
  clock.advance(SESSION_LIFETIME_MS);assert.equal((await fetch(`${f.url}/api/session`,{headers:{cookie}})).status,401);
  const fresh=await issue(f,{cookie});assert.equal(fresh.status,201);assert.notEqual(fresh.headers.get('set-cookie').split(';')[0],cookie);
 } finally {db?.close();await f.close();}
});
test('Origin·Fetch Metadata·커스텀 헤더·빈 JSON 계약으로 CSRF와 ID 주입을 차단한다',async()=>{
 const f=await apiFixture();try {
  for(const headers of [{origin:'https://attacker.example'},{origin:'null'},{origin:''},{'x-trip-court-request':''},{'sec-fetch-site':'cross-site'},{'content-type':'text/plain'}]) assert.ok([400,403].includes((await issue(f,headers)).status));
  for(const body of [{participantId:'forged'},{nickname:'같은 이름'},{sessionId:'forged'},[]])assert.equal((await issue(f,{},body)).status,400);
  const inspect=openSqlite(f.dbPath);try {assert.equal(inspect.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);}finally{inspect.close();}
  const good=await issue(f,{'sec-fetch-site':'same-origin'});assert.equal(good.status,201);assert.equal(good.headers.get('access-control-allow-origin'),null);
 }finally{await f.close();}
});

test('서버 종료 후 같은 DB와 쿠키로 신원을 복구한다',async()=>{
 const f=await apiFixture();let reopened;
 try {
  const issued=await issue(f);const cookie=issued.headers.get('set-cookie').split(';')[0];await f.app.close();
  reopened=await NestFactory.create(AppModule.register({dbPath:f.dbPath,publicOrigin:f.publicOrigin}),{logger:false,abortOnError:false});
  reopened.setGlobalPrefix('api');await reopened.listen(0,'127.0.0.1');
  const response=await fetch(`${await reopened.getUrl()}/api/session`,{headers:{cookie}});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{authenticated:true});
 }finally{await reopened?.close();await f.close();}
});
