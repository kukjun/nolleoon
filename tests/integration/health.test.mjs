import test from 'node:test';
import assert from 'node:assert/strict';
import { apiFixture } from '../support/api-fixture.mjs';
test('실제 Nest 조립과 HTTP BFF 계약', async () => {
 const f=await apiFixture();
 try {
  const response=await fetch(`${f.url}/api/health`,{signal:AbortSignal.timeout(3000)});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'ok',service:'trip-court-api'});
  assert.equal((await fetch(`${f.url}/api/missing`)).status,404);
 } finally {await f.close();}
});
