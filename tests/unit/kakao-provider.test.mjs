import test from 'node:test';
import assert from 'node:assert/strict';
import {KakaoProvider,kakaoConfiguration} from '../../apps/api/dist/infrastructure/auth/kakao-provider.js';
const {Response}=globalThis;
const config={clientId:'fixture-client',clientSecret:'fixture-secret',redirectUri:'https://service.example/api/account/callback'};
test('Kakao configuration fail closed, exact redirect and authorization scope',()=>{
 assert.equal(kakaoConfiguration({},'https://service.example'),undefined);
 for(const env of [{KAKAO_CLIENT_ID:'x'},{KAKAO_CLIENT_ID:'x',KAKAO_CLIENT_SECRET:'s',KAKAO_REDIRECT_URI:'https://evil.example/api/account/callback'}])assert.throws(()=>kakaoConfiguration(env,'https://service.example'));
 const p=new KakaoProvider(config);const u=new URL(p.authorizationUrl('fixture-state'));assert.equal(u.origin,'https://kauth.kakao.com');assert.equal(u.searchParams.get('state'),'fixture-state');assert.equal(u.searchParams.has('scope'),false);assert.equal(u.searchParams.has('client_secret'),false);
});
test('code exchange is server only, validates response and discards all provider profile/token data',async()=>{
 const requests=[];const p=new KakaoProvider(config,async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify(requests.length===1?{access_token:'secret-access',refresh_token:'secret-refresh',token_type:'bearer',expires_in:3600}:{id:123,kakao_account:{email:'not-collected'},properties:{profile_image:'not-collected'}}));});
 assert.deepEqual(await p.exchange('fixture-code'),{subject:'123'});assert.equal(requests[0].url,'https://kauth.kakao.com/oauth/token');assert.equal(requests[0].options.body.get('client_secret'),'fixture-secret');assert.equal(requests[1].options.headers.Authorization,'Bearer secret-access');assert.equal(requests[0].options.redirect,'error');
 for(const payload of [{access_token:'\r\ninjection'},{access_token:'ok',token_type:'other'},{access_token:'ok',token_type:'bearer',expires_in:0}])await assert.rejects(new KakaoProvider(config,async()=>new Response(JSON.stringify(payload))).exchange('x'));
});
test('upstream redirects/errors/oversized or malformed identities produce fixed errors',async()=>{
 for(const response of [new Response('provider SECRET',{status:400}),new Response('x'.repeat(70000)),new Response('{bad')])await assert.rejects(new KakaoProvider(config,async()=>response).exchange('x'),e=>!e.message.includes('SECRET'));
 for(const id of [null,{},-1,1.2,Number.MAX_SAFE_INTEGER+1,'not-an-id']){let n=0;await assert.rejects(new KakaoProvider(config,async()=>new Response(JSON.stringify(++n===1?{access_token:'ok',token_type:'bearer',expires_in:3600}:{id}))).exchange('x'));}
});
