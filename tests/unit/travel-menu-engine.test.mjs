import test from 'node:test';
import assert from 'node:assert/strict';
import { TravelMenuEngine } from '../../apps/api/dist/application/travel-menu-engine.js';
const engine = new TravelMenuEngine({ nextInt: () => 0 });
const context = overrides => ({ runId: 'run', now: 10, version: 1, status: 'draft', actorMembershipId: 'a', creatorMembershipId: 'a', facilitatorMembershipId: 'a', participantIds: ['a', 'b'], connectedParticipantIds: ['a', 'b'], presence: [], ...overrides });
const active = () => engine.start({}, engine.prepare({}, context()).state, context());
const fail = code => error => error.code === code;
test('준비는 빈 설정만·시작은 draft와 2명 동결', () => {
 assert.deepEqual(engine.prepare({}, context()).settings, {});
 assert.throws(() => engine.prepare({ penalty: 'x' }, context()), fail('INVALID_INPUT'));
 assert.throws(() => engine.start({}, { phase: 'draft' }, context({ participantIds: ['a'] })), fail('INVALID_INPUT'));
 const run = active(); assert.equal(run.status, 'active'); assert.deepEqual(run.state.participantIds, ['a', 'b']);
 assert.throws(() => engine.start({}, run.state, context({ status: 'active' })), fail('STATE_CONFLICT'));
});
test('응답자는 frozen IDs만·마지막 제출 완료 전환과 최종결과만 projection', () => {
 let run = active();
 run = engine.action({}, run.state, { type: 'submit', menu: '국수' }, context({ status: 'active' }));
 assert.equal(engine.project({}, run.state, null, context({ actorMembershipId: 'b' })).self.submission, null);
 assert.throws(() => engine.action({}, run.state, { type: 'pass' }, context({ status: 'active', actorMembershipId: 'late', participantIds: ['a', 'b', 'late'] })), fail('FORBIDDEN'));
 run = engine.action({}, run.state, { type: 'pass' }, context({ status: 'active', actorMembershipId: 'b' }));
 assert.equal(run.status, 'completed'); assert.deepEqual(run.result, { outcome: 'selected', menu: '국수' });
 const dto = engine.project({}, run.state, { secret: 'not-public' }, context({ status: 'completed', actorMembershipId: 'late' }));
 assert.deepEqual(dto.result, run.result); assert.equal(dto.self.eligible, false);
});
test('진행자 취소만 incomplete·추가필드 거부·명령과 status 불일치 거부', () => {
 const run = active();
 assert.throws(() => engine.action({}, run.state, { type: 'cancel' }, context({ status: 'active', actorMembershipId: 'b' })), fail('FORBIDDEN'));
 assert.throws(() => engine.action({}, run.state, { type: 'cancel', force: true }, context({ status: 'active' })), fail('INVALID_INPUT'));
 assert.throws(() => engine.action({}, run.state, { type: 'pass' }, context({ status: 'completed' })), fail('STATE_CONFLICT'));
 const cancelled = engine.action({}, run.state, { type: 'cancel' }, context({ status: 'active' }));
 assert.equal(cancelled.status, 'incomplete'); assert.equal(cancelled.result, null);
});
test('새 진행자 위임은 후보/명단 보존·자기취소 권한은 현재 진행자 기준', () => {
 const run = active(); const submitted = engine.action({}, run.state, { type: 'submit', menu: '비밀' }, context({ status: 'active' }));
 const cancelled = engine.action({}, submitted.state, { type: 'cancel' }, context({ status: 'active', actorMembershipId: 'b', facilitatorMembershipId: 'b' }));
 assert.deepEqual(cancelled.state.participantIds, ['a', 'b']);
 assert.equal(JSON.stringify(engine.project({}, cancelled.state, null, context({ status: 'incomplete' }))).includes('비밀'), false);
});
test('비참가 진행자는 취소만 가능하며 제출권을 얻지 않는다', () => {
 const ctx = context({ actorMembershipId: 'fac', creatorMembershipId: 'fac', facilitatorMembershipId: 'fac' });
 const run = engine.start({}, engine.prepare({}, ctx).state, ctx);
 assert.throws(() => engine.action({}, run.state, { type: 'pass' }, { ...ctx, status: 'active' }), fail('FORBIDDEN'));
 assert.equal(engine.action({}, run.state, { type: 'cancel' }, { ...ctx, status: 'active' }).status, 'incomplete');
});
test('공통 draft 취소의 incomplete projection은 collecting state를 요구하거나 공개하지 않는다', () => {
 const draft = engine.prepare({}, context()).state;
 assert.deepEqual(engine.project({}, draft, null, context({ status: 'incomplete' })), {
  kind: 'menu', phase: 'incomplete', self: { eligible: false, submission: null }, result: null,
 });
});
