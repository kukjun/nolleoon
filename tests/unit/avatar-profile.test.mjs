import test from 'node:test';
import assert from 'node:assert/strict';
import {Avatars} from '../../apps/api/dist/application/avatars.js';
function fake(){const records=new Map();return {records,uow:{run:work=>work({avatars:{find:id=>records.get(id),save:value=>records.set(value.sessionId,value)},rooms:{findByInvite:()=>undefined},members:{active:()=>[]}})}};}
test('profile inputs never allow arbitrary external URLs or invalid versions',()=>{
 const f=fake(),a=new Avatars(f.uow);
 for(const input of [null,[],{},'preset-01',{presetId:'preset-01',expectedRevision:NaN},{presetId:'preset-01',expectedRevision:1.5},{presetId:'preset-01',expectedRevision:Number.MAX_SAFE_INTEGER+1},{presetId:'preset-00',expectedRevision:0},{presetId:'data:image/png;base64,abc',expectedRevision:0}])assert.throws(()=>a.preset({id:'a'},input));
 assert.equal(f.records.size,0);a.preset({id:'a'},{presetId:'preset-03',expectedRevision:0});assert.equal(a.get({id:'a'}).revision,1);assert.equal(a.get({id:'b'}).presetId,'preset-01');
});
