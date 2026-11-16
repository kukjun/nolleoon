import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeNickname} from '../../apps/api/dist/application/rooms.js';
test('닉네임 NFKC·공백·대소문자 키·20코드포인트·제어문자 경계',()=>{
 assert.deepEqual(normalizeNickname('  Ａlice   친구  '),{nickname:'Alice 친구',nicknameKey:'alice 친구'});
 assert.equal(normalizeNickname('😀'.repeat(20)).nickname.length,40);
 for(const input of [null,1,{},'', '  ','a'.repeat(21),'a\nb','a\u200bb','a\u202eb'])assert.throws(()=>normalizeNickname(input),e=>e.code==='INVALID_INPUT');
});
