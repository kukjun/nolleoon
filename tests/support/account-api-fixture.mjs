import 'reflect-metadata';import {NestFactory} from '@nestjs/core';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import Database from 'better-sqlite3';
import {AppModule} from '../../apps/api/dist/composition/app.module.js';import {AccountAuth} from '../../apps/api/dist/application/account-auth.js';
export async function accountApiFixture(t){
 const dir=mkdtempSync(join(tmpdir(),'trip-account-photo-')),dbPath=join(dir,'test.sqlite'),origin='https://trip.example';let subject='123';const app=await NestFactory.create(AppModule.register({dbPath,publicOrigin:origin,presenceMonitor:false,settlementMonitor:false,kakaoProvider:{authorizationUrl:s=>'https://kauth.kakao.com/oauth/authorize?state='+s,exchange:async()=>({subject})}}),{logger:false,abortOnError:false});app.setGlobalPrefix('api');await app.listen(0,'127.0.0.1');const db=new Database(dbPath),url=await app.getUrl();t.after(async()=>{db.close();await app.close();rmSync(dir,{recursive:true,force:true});});
 const auth=app.get(AccountAuth);async function login(id){subject=id;const b=auth.begin('/travel');const r=await auth.callback(b.state,b.browserToken,'fixture-'+id);return {...r,cookie:'__Host-trip_account='+r.token,flow:b.browserToken,actor:auth.require(r.token)};}
 const get=(path,cookie)=>fetch(url+'/api/'+path,{headers:{Cookie:cookie??''}});
 const json=(path,cookie,body,method='PUT')=>fetch(url+'/api/'+path,{method,headers:{Origin:origin,'X-Trip-Court-Request':'1','Content-Type':'application/json',Cookie:cookie??''},body:JSON.stringify(body)});
 const image=(cookie,bytes,revision=0,mime='image/png',extra={})=>fetch(url+'/api/account/avatar/image',{method:'PUT',headers:{Origin:origin,'X-Trip-Court-Request':'1','Content-Type':mime,'X-Avatar-Revision':String(revision),Cookie:cookie??'',...extra},body:bytes});
 return {app,db,dbPath,auth,login,get,json,image,origin,url};
}
