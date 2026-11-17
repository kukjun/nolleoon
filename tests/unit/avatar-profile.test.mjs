import test from 'node:test';
import assert from 'node:assert/strict';
import {Avatars} from '../../apps/api/dist/application/avatars.js';
function fake(){const records=new Map();return {records,uow:{run:work=>work({avatars:{find:id=>records.get(id),save:value=>records.set(value.sessionId,value)},rooms:{findByInvite:()=>undefined},members:{active:()=>[]}})}};}
test('profile inputs never allow arbitrary external URLs or invalid versions',()=>{
 const f=fake(),a=new Avatars(f.uow);
 for(const input of [null,[],{},'preset-01',{presetId:'preset-01',expectedRevision:NaN},{presetId:'preset-01',expectedRevision:1.5},{presetId:'preset-01',expectedRevision:Number.MAX_SAFE_INTEGER+1},{presetId:'preset-00',expectedRevision:0},{presetId:'data:image/png;base64,abc',expectedRevision:0}])assert.throws(()=>a.preset({id:'a'},input));
 assert.equal(f.records.size,0);a.preset({id:'a'},{presetId:'preset-03',expectedRevision:0});assert.equal(a.get({id:'a'}).revision,1);assert.equal(a.get({id:'b'}).presetId,'preset-01');
});
test('upload CAS rechecks after async encoding; size quota never replaces existing profile',async()=>{
 const f=fake();let release;const a=new Avatars(f.uow,{thumbnail:()=>new Promise(resolve=>{release=resolve;})});
 const pending=a.upload({id:'a'},0,new Uint8Array([1]),'image/png');a.preset({id:'a'},{presetId:'preset-04',expectedRevision:0});release(new Uint8Array([2]));await assert.rejects(pending,error=>error.code==='STATE_CONFLICT');assert.equal(a.get({id:'a'}).presetId,'preset-04');
 let saved=false;const full=new Avatars({run:work=>work({avatars:{find:()=>undefined,totalImageBytes:()=>67108864,save:()=>{saved=true;}}})},{thumbnail:async()=>new Uint8Array([2])});
 await assert.rejects(full.upload({id:'b'},0,new Uint8Array([1]),'image/png'),error=>error.code==='TEMPORARILY_UNAVAILABLE');assert.equal(saved,false);
});
