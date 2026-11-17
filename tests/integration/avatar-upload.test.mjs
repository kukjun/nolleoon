import {ReadableStream} from 'node:stream/web';
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {apiFixture} from '../support/api-fixture.mjs';
import {openSqlite} from '../../apps/api/dist/infrastructure/sqlite/index.js';
const cmd=(f,cookie,body,method='POST')=>({method,headers:{origin:f.publicOrigin,'content-type':'application/json','x-trip-court-request':'1',cookie},body:JSON.stringify(body)});
async function session(f){return (await fetch(`${f.url}/api/session`,cmd(f,'',{}))).headers.get('set-cookie').split(';')[0];}
const upload=(f,cookie,bytes,revision=0,type='image/png')=>fetch(`${f.url}/api/avatar/image`,{method:'PUT',headers:{origin:f.publicOrigin,'content-type':type,'x-trip-court-request':'1','x-avatar-revision':String(revision),cookie},body:bytes});
test('avatar presets persist, stale writes conflict, rooms isolate images and old BFF remains unchanged',async()=>{
 const f=await apiFixture();let db;try{
 const owner=await session(f),other=await session(f),outsider=await session(f);
 assert.equal((await fetch(`${f.url}/api/avatar`)).status,401);
 const initial=await fetch(`${f.url}/api/avatar`,{headers:{cookie:owner}});assert.equal(initial.status,200);assert.deepEqual(await initial.json(),{kind:'preset',presetId:'preset-01',revision:0,imageUrl:null});
 const preset=await fetch(`${f.url}/api/avatar`,cmd(f,owner,{presetId:'preset-10',expectedRevision:0},'PUT'));assert.equal(preset.status,200);assert.equal((await preset.json()).revision,1);
 assert.equal((await fetch(`${f.url}/api/avatar`,cmd(f,owner,{presetId:'preset-01',expectedRevision:0},'PUT'))).status,409);
 const bytes=await sharp({create:{width:300,height:200,channels:3,background:'#bb4455'}}).png().toBuffer();
 const uploaded=await upload(f,owner,bytes,1);assert.equal(uploaded.status,200);const avatar=await uploaded.json();assert.equal(avatar.kind,'image');assert.equal(avatar.revision,2);
 const image=await fetch(`${f.url}${avatar.imageUrl}`,{headers:{cookie:owner}});assert.equal(image.status,200);assert.equal(image.headers.get('cache-control'),'no-store');assert.equal(image.headers.get('x-content-type-options'),'nosniff');
 const output=Buffer.from(await image.arrayBuffer());const meta=await sharp(output).metadata();assert.equal(meta.format,'webp');assert.equal(meta.width,256);assert.equal(meta.height,256);assert.equal(meta.exif,undefined);assert.ok(output.length<=65536);
 const room=await (await fetch(`${f.url}/api/rooms`,cmd(f,owner,{nickname:'owner'}))).json();const base=`${f.url}/api/rooms/${room.inviteCode}/avatars`;
 assert.equal((await fetch(base,{headers:{cookie:outsider}})).status,403);
 await fetch(`${f.url}/api/rooms/${room.inviteCode}/join`,cmd(f,other,{nickname:'friend'}));
 const map=await (await fetch(base,{headers:{cookie:other}})).json();assert.equal(map.members.length,2);const profile=map.members.find(m=>m.memberId===room.self.memberId).avatar;assert.equal(profile.revision,2);
 assert.equal((await fetch(`${f.url}${profile.imageUrl}`,{headers:{cookie:other}})).status,200);assert.equal((await fetch(`${f.url}${profile.imageUrl}`,{headers:{cookie:outsider}})).status,403);
 assert.equal((await fetch(`${f.url}${profile.imageUrl}`)).status,401);
 assert.equal('avatar' in room.members[0],false);
 db=openSqlite(f.dbPath);assert.equal(db.prepare('SELECT count(*) AS n FROM avatar_profiles').get().n,1);
 await fetch(`${f.url}/api/avatar`,cmd(f,owner,{presetId:'preset-02',expectedRevision:2},'PUT'));
 assert.equal(db.prepare('SELECT image_bytes FROM avatar_profiles').get().image_bytes,null);
 assert.equal((await fetch(`${f.url}${profile.imageUrl}`,{headers:{cookie:other}})).status,404);
 }finally{db?.close();await f.close();}
});
test('avatar image rejects untrusted input and does not replace saved profile',async()=>{
 const f=await apiFixture();try{
 const cookie=await session(f);
 assert.equal((await upload(f,cookie,Buffer.from('<svg/>'),0,'image/svg+xml')).status,400);
 assert.equal((await upload(f,cookie,Buffer.from('<svg/>'))).status,400);
 assert.equal((await upload(f,cookie,Buffer.alloc(1048577))).status,413);
 const big=await sharp({create:{width:2100,height:2000,channels:3,background:'red'}}).png().toBuffer();assert.equal((await upload(f,cookie,big)).status,400);
 const bytes=await sharp({create:{width:10,height:10,channels:3,background:'red'}}).png().toBuffer();assert.equal((await upload(f,cookie,bytes,0,'image/jpeg')).status,400);
 const wrongOrigin=await fetch(`${f.url}/api/avatar/image`,{method:'PUT',headers:{origin:'https://evil.example','content-type':'image/png','x-trip-court-request':'1','x-avatar-revision':'0',cookie},body:bytes});assert.equal(wrongOrigin.status,403);
 assert.equal((await upload(f,cookie,bytes)).status,429);
 assert.equal((await (await fetch(`${f.url}/api/avatar`,{headers:{cookie}})).json()).revision,0);
 }finally{await f.close();}
});
test('chunked oversized stream, encoded body and missing origin are rejected without changing image',async()=>{
 const f=await apiFixture();try{
 const cookie=await session(f);const bytes=await sharp({create:{width:12,height:12,channels:3,background:'green'}}).png().toBuffer();assert.equal((await upload(f,cookie,bytes)).status,200);
 const base={method:'PUT',headers:{origin:f.publicOrigin,'content-type':'image/png','x-trip-court-request':'1','x-avatar-revision':'1',cookie}};
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(524288));controller.enqueue(new Uint8Array(524289));controller.close();}});
 assert.equal((await fetch(`${f.url}/api/avatar/image`,{...base,body:stream,duplex:'half'})).status,413);
 assert.equal((await fetch(`${f.url}/api/avatar/image`,{...base,headers:{...base.headers,'content-encoding':'gzip'},body:bytes})).status,400);
 assert.equal((await fetch(`${f.url}/api/avatar/image`,{...base,headers:{...base.headers,origin:'https://evil.example'},body:bytes})).status,403);
 assert.equal((await upload(f,cookie,Buffer.from('not image'),1)).status,400);
 const saved=await (await fetch(`${f.url}/api/avatar`,{headers:{cookie}})).json();assert.equal(saved.kind,'image');assert.equal(saved.revision,1);
 const image=await fetch(`${f.url}${saved.imageUrl}`,{headers:{cookie}});assert.equal(image.status,200);
 }finally{await f.close();}
});
