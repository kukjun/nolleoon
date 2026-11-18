import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import {NestFactory} from '@nestjs/core';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {AppModule} from '../../apps/api/dist/composition/app.module.js';
import {ACCOUNT_COOKIE,ACCOUNT_FLOW_COOKIE} from '../../apps/api/dist/presentation/account.controller.js';
const origin='https://trip.example';
async function api(t){
 const dir=mkdtempSync(join(tmpdir(),'trip-account-auth-')),dbPath=join(dir,'test.sqlite');let subject='123';
 const provider={authorizationUrl:state=>'https://kauth.kakao.com/oauth/authorize?state='+state,exchange:async()=>({subject})};
 const app=await NestFactory.create(AppModule.register({dbPath,publicOrigin:origin,kakaoProvider:provider,presenceMonitor:false,settlementMonitor:false}),{logger:false,abortOnError:false});app.setGlobalPrefix('api');await app.listen(0,'127.0.0.1');const db=new Database(dbPath);t.after(async()=>{db.close();await app.close();rmSync(dir,{recursive:true,force:true});});const url=await app.getUrl();
 const send=(path,body,cookie,extra={})=>fetch(url+'/api/account/'+path,{method:'POST',headers:{Origin:origin,'X-Trip-Court-Request':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},body:JSON.stringify(body),redirect:'manual'});
 return {url,send,db,app,dbPath,setSubject:s=>subject=s};
}
async function begin(f,returnTo='/travel',cookie){const res=await f.send('login',{returnTo},cookie);assert.equal(res.status,201);const json=await res.json(),state=new URL(json.authorizationUrl).searchParams.get('state'),flow=res.headers.get('set-cookie').split(';')[0];return {res,state,flow};}
test('real HTTP auth callback emits only secure account cookie, preserves legacy and redirects without secrets',async t=>{
 const f=await api(t);const b=await begin(f,'/travel','__Host-trip_session=legacy-proof');assert.match(b.res.headers.get('set-cookie'),/HttpOnly/);assert.match(b.res.headers.get('set-cookie'),/Secure/);assert.match(b.res.headers.get('set-cookie'),/SameSite=Lax/);
 const callback=await fetch(f.url+'/api/account/callback?state='+b.state+'&code=fixture-code',{headers:{Cookie:b.flow},redirect:'manual'});assert.equal(callback.status,303);assert.equal(callback.headers.get('location'),'/travel');const set=callback.headers.get('set-cookie');assert.match(set,new RegExp('^'+ACCOUNT_COOKIE+'='));assert.match(set,/SameSite=Strict/);assert.equal(set.includes('__Host-trip_session'),false);assert.equal(callback.headers.get('referrer-policy'),'no-referrer');const cookie=set.split(';')[0];
 const session=await fetch(f.url+'/api/account/session',{headers:{Cookie:cookie}});assert.equal(session.status,200);const body=await session.json();assert.equal(body.account.displayName,'여행자');assert.deepEqual(Object.keys(body.account).sort(),['displayName','id','presetId','revision']);
 const replay=await fetch(f.url+'/api/account/callback?state='+b.state+'&code=fixture-code',{headers:{Cookie:b.flow},redirect:'manual'});assert.equal(replay.headers.get('location'),'/travel?login=failed');assert.equal(replay.headers.get('set-cookie'),null);
 const out=await f.send('logout',{},cookie+'; '+b.flow);assert.equal(out.status,201);assert.equal(out.headers.get('set-cookie').includes('__Host-trip_session'),false);assert.equal((await fetch(f.url+'/api/account/session',{headers:{Cookie:cookie}})).status,401);
});
test('HTTP CSRF, duplicated cookies/query, forged state and cancellation fail closed',async t=>{
 const f=await api(t);assert.equal((await f.send('login',{returnTo:'/travel'},undefined,{Origin:'https://evil.example'})).status,403);assert.equal(f.db.prepare('SELECT count(*) n FROM oauth_attempts').get().n,0);assert.equal((await f.send('login',{returnTo:'//evil.example'})).status,400);
 const path='/travel/invite/'+'a'.repeat(43),b=await begin(f,path);const duplicate=await fetch(f.url+'/api/account/callback?state='+b.state+'&state=x&code=x',{headers:{Cookie:b.flow},redirect:'manual'});assert.equal(duplicate.headers.get('location'),'/travel?login=failed');
 const other=await fetch(f.url+'/api/account/callback?state='+b.state+'&code=x',{headers:{Cookie:b.flow+'; '+ACCOUNT_FLOW_COOKIE+'=forged'},redirect:'manual'});assert.equal(other.headers.get('set-cookie'),null);
 const cancelled=await fetch(f.url+'/api/account/callback?state='+b.state+'&error=access_denied&error_description=SECRET',{headers:{Cookie:b.flow},redirect:'manual'});assert.equal(cancelled.headers.get('location'),path+'?login=cancelled');assert.equal((await cancelled.text()).includes('SECRET'),false);assert.equal(f.db.prepare('SELECT count(*) n FROM accounts').get().n,0);
});
test('HTTP two browser account isolation and profile CAS are server-authorized',async t=>{
 const f=await api(t);async function login(subject,code){f.setSubject(subject);const b=await begin(f);const response=await fetch(f.url+'/api/account/callback?state='+b.state+'&code='+code,{headers:{Cookie:b.flow},redirect:'manual'});return response.headers.get('set-cookie').split(';')[0];}
 const a=await login('123','one'),b=await login('456','two');assert.equal((await f.send('profile',{expectedRevision:0,displayName:'새 이름',presetId:'preset-04'},a)).status,201);assert.equal((await f.send('profile',{expectedRevision:0,displayName:'덮기',presetId:'preset-04'},a)).status,409);
 const other=await(await fetch(f.url+'/api/account/session',{headers:{Cookie:b}})).json();assert.equal(other.account.displayName,'여행자');assert.equal((await f.send('profile',{expectedRevision:0,displayName:'침입',presetId:'preset-04'})).status,401);
});
test('valid account readers have separate rate budgets behind the same proxy socket',async t=>{
 const f=await api(t);const cookies=[];for(let i=0;i<2;i++){f.setSubject(String(i+1));const b=await begin(f);const r=await fetch(f.url+'/api/account/callback?state='+b.state+'&code=rate-'+i,{headers:{Cookie:b.flow},redirect:'manual'});cookies.push(r.headers.get('set-cookie').split(';')[0]);}
 for(let i=0;i<80;i++)for(const cookie of cookies)assert.equal((await fetch(f.url+'/api/account/session',{headers:{Cookie:cookie}})).status,200);
});
