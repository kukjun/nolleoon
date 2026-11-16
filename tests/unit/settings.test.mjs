import test from 'node:test';import assert from 'node:assert/strict';import {validateSettings} from '../../apps/api/dist/application/rooms.js';
const input={expectedVersion:0,caseText:'사건\n내용',penaltyText:'벌칙',durationMinutes:3};
test('초안 입력은 부분 빈내용·정수분·문자수 경계와 허용키만 받는다',()=>{
 assert.deepEqual(validateSettings(input),input);assert.equal(validateSettings({...input,caseText:'😀'.repeat(2000),penaltyText:'',durationMinutes:10}).durationMinutes,10);
 for(const delta of [{caseText:'😀'.repeat(2001)},{penaltyText:'a'.repeat(501)},{caseText:'bad\u0000'},{penaltyText:'bad\u202e'},{durationMinutes:Infinity},{expectedVersion:'0'},{expectedVersion:Number.MAX_SAFE_INTEGER+1},{extra:true}])assert.throws(()=>validateSettings({...input,...delta}),e=>e.code==='INVALID_INPUT');
 for(const invalid of [null,[],{},'string'])assert.throws(()=>validateSettings(invalid),e=>e.code==='INVALID_INPUT');
});
