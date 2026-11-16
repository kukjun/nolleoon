import test from 'node:test';
import assert from 'node:assert/strict';
import { GetHealth } from '../../apps/api/dist/application/get-health.js';
test('헬스 유스케이스는 서비스 상태를 반환한다', () => {
 assert.equal(new GetHealth().execute(),'ok');
});
