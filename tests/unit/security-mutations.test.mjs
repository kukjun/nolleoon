import test from 'node:test';
import assert from 'node:assert/strict';
import {runSecurityMutations} from '../../tools/security/mutation-check.mjs';
test('격리 결함 4개는 깨끗한 대조군 통과 후 의도한 보안 assertion에 의해 모두 검출된다',()=>{
 const result=runSecurityMutations();
 assert.equal(result.status,'passed');assert.equal(result.cleanControls,4);assert.equal(result.killedMutants,4);
 assert.ok(result.results.every(item=>item.cleanPassed&&item.mutantKilled));
});
