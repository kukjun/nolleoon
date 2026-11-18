import test from 'node:test';
import assert from 'node:assert/strict';
import { travelGameHttpFixture } from '../support/travel-game-http-fixture.mjs';
async function createNonplaying(f) {
 const room = (await f.call(f.root)).body;
 const response = await f.call(f.root + '/runs', 'a', { requestId: f.id(), expectedVersion: room.version,
  type: 'menu', selectedMembershipIds: [f.ids.b, f.ids.c], settings: {} });
 assert.equal(response.status, 201, JSON.stringify(response.body)); return response.body;
}
test('실제 API 비참가 진행자 메뉴 취소·참가자 제출권 분리·새 판 락 해제', async t => {
 const f = await travelGameHttpFixture(t); let run = await createNonplaying(f); const path = f.root + '/runs/' + run.runId;
 run = (await f.call(path + '/start', 'a', { requestId: f.id(), expectedVersion: run.version })).body;
 const denied = await f.call(path + '/actions', 'a', { requestId: f.id(), expectedVersion: run.version, command: { type: 'pass' } });
 assert.equal(denied.status, 403);
 run = (await f.call(path + '/actions', 'b', { requestId: f.id(), expectedVersion: run.version, command: { type: 'submit', menu: '비공개후보' } })).body;
 const cancelled = await f.call(path + '/actions', 'a', { requestId: f.id(), expectedVersion: run.version, command: { type: 'cancel' } });
 assert.equal(cancelled.status, 201); assert.equal(cancelled.body.status, 'incomplete');
 assert.equal(JSON.stringify((await f.call(f.root + '/history', 'd')).body).includes('비공개후보'), false);
 assert.equal((await f.create('menu', {})).status, 201);
});
test('실제 API draft 취소 영수증·재시작·이력과 새 판 생성은 원자적으로 유지', async t => {
 const f = await travelGameHttpFixture(t); const run = await createNonplaying(f); const path = f.root + '/runs/' + run.runId;
 const body = { requestId: f.id(), expectedVersion: run.version };
 const cancelled = await f.call(path + '/cancel', 'a', body);
 assert.equal(cancelled.status, 201); assert.equal(cancelled.body.status, 'incomplete'); assert.equal(cancelled.body.game.phase, 'incomplete');
 assert.deepEqual((await f.call(path + '/cancel', 'a', body)).body, cancelled.body);
 await f.restart(); assert.equal((await f.call(path, 'd')).body.game.phase, 'incomplete');
 assert.equal((await f.call(f.root + '/history', 'd')).body.items[0].game.result, null);
 assert.equal((await f.create('menu', {})).status, 201);
});
