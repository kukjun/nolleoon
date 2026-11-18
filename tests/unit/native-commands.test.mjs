import test from 'node:test';import assert from 'node:assert/strict';
import {nativeToken} from '../../apps/api/dist/presentation/native-commands.js';
const token='a'.repeat(43),value='Bearer '+token;
test('native parser rejects duplicated raw Authorization and any Cookie without fallback',()=>{
 const req={headers:{authorization:value},rawHeaders:['Authorization',value]};assert.equal(nativeToken(req),token);
 for(const bad of [{...req,rawHeaders:['Authorization',value,'authorization',value]},{...req,headers:{authorization:value,cookie:''}},{...req,headers:{authorization:'Bearer '+token+',Bearer '+token}},{...req,headers:{authorization:['Bearer '+token]}}])assert.throws(()=>nativeToken(bad));
});
test('native production configuration rejects invalid app ID and missing authorities before opening service',async()=>{
 const {bootstrap}=await import('../../apps/api/dist/production/bootstrap.js');
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const dir=mkdtempSync(join(tmpdir(),'native-bootstrap-'));
 const env={DB_PATH:join(dir,'test.sqlite'),API_HOST:'127.0.0.1',API_PORT:'49123',PUBLIC_ORIGIN:'https://native-test.example'};
 try{await assert.rejects(bootstrap({...env,KAKAO_APP_ID:'invalid'}),/앱 검증 설정/);await assert.rejects(bootstrap({...env,KAKAO_APP_ID:'12345'}),/Native authentication authority missing/);}finally{rmSync(dir,{recursive:true,force:true});}
});
