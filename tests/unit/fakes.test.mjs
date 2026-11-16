import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeClock, SequenceRandom } from '../support/fakes.mjs';
test('가짜 시간은 명시적으로만 증가한다', () => {
 const clock=new FakeClock(1000); assert.equal(clock.now(),1000); clock.advance(600000); assert.equal(clock.now(),601000);
 assert.throws(()=>clock.advance(-1)); assert.throws(()=>new FakeClock(NaN));
});
test('가짜 난수는 순서와 후보 범위를 검증한다', () => {
 const random=new SequenceRandom([0,2]); assert.equal(random.nextInt(3),0); assert.equal(random.nextInt(3),2);
 assert.throws(()=>random.nextInt(3)); assert.throws(()=>new SequenceRandom([3]).nextInt(3));
});
