import test from 'node:test';import assert from 'node:assert/strict';
import {tallyOutcome} from '../../apps/api/dist/domain/tally.js';
test('기권은 유효표 비교를 바꾸지 않으며 무표·첫 동률·재동률을 구분한다',()=>{
 assert.equal(tallyOutcome(1,0,1),'guilty');assert.equal(tallyOutcome(0,1,1),'not-guilty');
 assert.equal(tallyOutcome(0,0,1),'no-verdict');assert.equal(tallyOutcome(0,0,2),'no-verdict');
 assert.equal(tallyOutcome(1,1,1),'tie');assert.equal(tallyOutcome(1,1,2),'not-guilty');
});
