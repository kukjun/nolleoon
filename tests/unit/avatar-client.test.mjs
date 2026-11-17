import test from 'node:test';
import assert from 'node:assert/strict';
import {validAvatar,requestAvatar,validateAvatarFile} from '../../apps/web/src/api/avatar-client.ts';
const preset={kind:'preset',presetId:'preset-01',revision:0,imageUrl:null};
test('avatar responses reject external URLs, invalid revisions and unknown presets',()=>{
 assert.equal(validAvatar(preset),true);
 assert.equal(validAvatar({...preset,presetId:'preset-11'}),false);
 assert.equal(validAvatar({...preset,revision:-1}),false);
 assert.equal(validAvatar({kind:'image',presetId:null,revision:1,imageUrl:'https://evil.example/photo'}),false);
 assert.equal(validAvatar({kind:'image',presetId:null,revision:1,imageUrl:'/api/avatar/image?revision=1'}),true);
});
test('avatar client authenticates writes and does not accept malformed success',async()=>{
 let init;const fetcher=async(_url,options)=>{init=options;return globalThis.Response.json(preset);};
 assert.equal((await requestAvatar('/api/avatar',{presetId:'preset-01',expectedRevision:0},undefined,fetcher)).ok,true);
 assert.equal(init.credentials,'same-origin');assert.equal(init.headers['X-Trip-Court-Request'],'1');assert.equal(init.method,'PUT');
 assert.equal((await requestAvatar('/api/avatar',undefined,undefined,async()=>globalThis.Response.json({anything:true}))).ok,false);
});
test('client early rejects unsupported or oversize avatar files',()=>{
 assert.match(validateAvatarFile({type:'image/svg+xml',size:20}),/PNG/);
 assert.match(validateAvatarFile({type:'image/png',size:1048577}),/1MB/);
 assert.equal(validateAvatarFile({type:'image/webp',size:1024}),'');
});
