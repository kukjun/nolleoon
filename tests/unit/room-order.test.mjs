import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SnapshotOrder} from '../../apps/web/src/api/snapshot-order.ts';
test('요청 순서와 방 버전은 각각 오래된 응답을 거부한다',()=>{
 const gate=new SnapshotOrder(4);const first=gate.begin();const second=gate.begin();
 assert.equal(gate.accept(first,8),false);assert.equal(gate.accept(second,5),true);
 assert.equal(gate.accept(gate.begin(),4),false);assert.equal(gate.accept(gate.begin(),5),true);assert.equal(gate.accept(gate.begin(),6),true);
});
