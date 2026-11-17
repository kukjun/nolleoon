import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {SharpAvatarProcessor} from '../../apps/api/dist/infrastructure/images/avatar-processor.js';
import {Avatars} from '../../apps/api/dist/application/avatars.js';
const quota=67108864;
function verifyBounded(results){assert.equal(results.filter(r=>r.status==='fulfilled').length,2);const rejected=results.filter(r=>r.status==='rejected');assert.equal(rejected.length,1);assert.equal(rejected[0].reason.code,'TEMPORARILY_UNAVAILABLE');}
test('실제 이미지 decoder는 동시2개만 처리하며 실패 뒤 slot을 돌려주고 음성대조군을 탐지한다',async()=>{
 const bytes=await sharp({create:{width:512,height:512,channels:3,background:'#abbccd'}}).png().toBuffer();
 const p=new SharpAvatarProcessor();const run=processor=>Promise.allSettled(Array.from({length:3},()=>processor.thumbnail(bytes,'image/png')));
 verifyBounded(await run(p));
 await assert.rejects(p.thumbnail(Buffer.from('bad'),'image/png'));
 const after=await p.thumbnail(bytes,'image/png');assert.ok(after.byteLength<=65536);
 // 의도적인 테스트 대역은 동시 제한이 전혀 없다. 같은 판정기가 이를 통과시키면 안 된다.
 const unbounded={thumbnail:async()=>new Uint8Array([1])};
 const awaitedResults=await run(unbounded);assert.throws(()=>verifyBounded(awaitedResults));
});
test('동시 업로드 CAS와 전역 quota 경계는 이전 사진을 원자적으로 보존한다',async()=>{
 const records=new Map();let base=quota-4;const releases=[];
 const repo={find:id=>records.get(id),totalImageBytes:()=>base+[...records.values()].reduce((n,r)=>n+(r.imageBytes?.byteLength??0),0),save:r=>records.set(r.sessionId,r)};
 const a=new Avatars({run:work=>work({avatars:repo})},{thumbnail:()=>new Promise(resolve=>releases.push(resolve))});
 const p1=a.upload({id:'owner'},0,new Uint8Array([1]),'image/png');const p2=a.upload({id:'owner'},0,new Uint8Array([1]),'image/png');
 releases.shift()(new Uint8Array([2,3,4,5]));releases.shift()(new Uint8Array([7,8,9,0]));
 const outcomes=await Promise.allSettled([p1,p2]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.find(x=>x.status==='rejected').reason.code,'STATE_CONFLICT');assert.deepEqual([...records.get('owner').imageBytes],[2,3,4,5]);
 // 기존 4바이트를 교체하는 4바이트는 총 quota를 늘리지 않는다.
 const replace=a.upload({id:'owner'},1,new Uint8Array([1]),'image/png');releases.shift()(new Uint8Array([6,6,6,6]));await replace;assert.equal(records.get('owner').revision,2);
 const denied=a.upload({id:'other'},0,new Uint8Array([1]),'image/png');releases.shift()(new Uint8Array([8]));await assert.rejects(denied,e=>e.code==='TEMPORARILY_UNAVAILABLE');assert.equal(records.has('other'),false);assert.deepEqual([...records.get('owner').imageBytes],[6,6,6,6]);
 base=0;
});
