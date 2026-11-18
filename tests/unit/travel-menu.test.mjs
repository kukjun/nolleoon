import test from 'node:test';
import assert from 'node:assert/strict';
import { beginMenu, submitMenu, cancelMenu, projectMenu, normalizeMenu } from '../../apps/api/dist/domain/menu.js';
const zero = { nextInt: () => 0 };
const start = (ids = ['a', 'b']) => beginMenu(ids);
const submit = (state, actor, menu, random = zero) => submitMenu(state, actor, menu === null ? { type: 'pass' } : { type: 'submit', menu }, random);
const failure = code => error => error.code === code;

test('최소 두명 고유 참가자 동결, 복사본 보존', () => {
 for (const ids of [[], ['a'], ['a', 'a']]) assert.throws(() => start(ids), failure('INVALID_INPUT'));
 const ids = ['a', 'b']; const state = start(ids); ids.push('c'); assert.deepEqual(state.participantIds, ['a', 'b']);
});
test('NFC·공백·Latin case 정규화와 Unicode 길이 경계, 텍스트 그대로 보존', () => {
 assert.equal(normalizeMenu('  PIZZA\t  한\u1100\u1161  '), 'pizza 한가');
 assert.equal(normalizeMenu('😀'.repeat(80)), '😀'.repeat(80));
 assert.equal(normalizeMenu('<img src=x>'), '<img src=x>');
 for (const value of ['', '  ', '😀'.repeat(81), 'a\0b', 'a\u202eb', 3, null]) assert.throws(() => normalizeMenu(value), failure('INVALID_INPUT'));
});
test('제출 전 비공개·자기 제출만, 패스는 입력과 별개·다른 참가자 사칭 거부', () => {
 const original = start(); const state = submit(original, 'a', '비밀메뉴');
 assert.equal(original.responses.length, 0);
 assert.deepEqual(projectMenu(state, 'a').self.submission, { kind: 'candidate', menu: '비밀메뉴' });
 for (const actor of ['b', 'outsider']) assert.equal(JSON.stringify(projectMenu(state, actor)).includes('비밀메뉴'), false);
 assert.throws(() => submit(state, 'outsider', '메뉴'), failure('FORBIDDEN'));
 assert.throws(() => submitMenu(state, 'b', { type: 'pass', menu: 'secret' }, zero), failure('INVALID_INPUT'));
});
test('동일 canonical 제출은 멱등·수정/패스변경 거부·전원 응답 전에 결정 없음', () => {
 const state = submit(start(), 'a', 'Pizza');
 assert.equal(submit(state, 'a', '  PIZZA '), state);
 assert.throws(() => submit(state, 'a', '국수'), failure('STATE_CONFLICT'));
 assert.throws(() => submit(state, 'a', null), failure('STATE_CONFLICT'));
 assert.equal(state.phase, 'collecting'); assert.equal(state.result, null);
});
test('최다 빈도만 결정·단독후보 및 전원패스에는 난수 호출 없음', () => {
 const unused = { nextInt: () => { throw new Error('random must not run'); } };
 let state = start(['a', 'b', 'c']); state = submit(state, 'a', '국수'); state = submit(state, 'b', '피자'); state = submit(state, 'c', '국수', unused);
 assert.deepEqual(state.result, { outcome: 'selected', menu: '국수' });
 const single = submit(submit(start(), 'a', null), 'b', '국수', unused); assert.deepEqual(single.result, state.result);
 const none = submit(submit(start(), 'a', null), 'b', null, unused); assert.deepEqual(none.result, { outcome: 'no-choice' });
});
test('동률 후보에만 균등 provider 1회·저장/재시작 후 재추첨 금지', () => {
 let calls = 0; const random = { nextInt: max => { assert.equal(max, 2); calls++; return 1; } };
 const complete = submit(submit(start(), 'a', 'pizza'), 'b', 'noodle', random);
 assert.equal(calls, 1); assert.deepEqual(complete.result, { outcome: 'selected', menu: 'pizza' });
 const restored = JSON.parse(JSON.stringify(complete)); assert.equal(submit(restored, 'b', 'noodle', random), restored); assert.equal(calls, 1);
 assert.throws(() => submit(restored, 'b', null), failure('STATE_CONFLICT'));
});
test('잘못된 난수 실패는 원래 상태 변경/마지막 제출 누적 없음', () => {
 const state = submit(start(), 'a', 'pizza'); const before = JSON.stringify(state);
 for (const invalid of [-1, 2, NaN, 0.1]) assert.throws(() => submit(state, 'b', 'noodle', { nextInt: () => invalid }));
 assert.equal(JSON.stringify(state), before);
});
test('진행자 명시 취소는 미완료·후보 비공개, 완료 뒤 취소 금지', () => {
 const active = submit(start(), 'a', '비밀메뉴');
 assert.throws(() => cancelMenu(active, 'b', 'a'), failure('FORBIDDEN'));
 assert.throws(() => cancelMenu(active, 'a', null), failure('FORBIDDEN'));
 const cancelled = cancelMenu(active, 'a', 'a'); assert.equal(cancelled.phase, 'incomplete');
 assert.equal(JSON.stringify(projectMenu(cancelled, 'a')).includes('비밀메뉴'), false);
 assert.equal(cancelMenu(cancelled, 'a', 'a'), cancelled);
 assert.throws(() => submit(cancelled, 'b', '메뉴'), failure('STATE_CONFLICT'));
 const complete = submit(active, 'b', '비밀메뉴'); assert.throws(() => cancelMenu(complete, 'a', 'a'), failure('STATE_CONFLICT'));
});
test('완료 결과 projection은 최종메뉴만·후보목록/작성자/빈도 없음', () => {
 let state = start(['a', 'b', 'c']); state = submit(state, 'a', 'winner'); state = submit(state, 'b', 'loser-secret'); state = submit(state, 'c', 'winner');
 const dto = projectMenu(state, 'outsider');
 assert.deepEqual(dto, { kind: 'menu', phase: 'completed', self: { eligible: false, submission: null }, result: { outcome: 'selected', menu: 'winner' } });
 assert.equal(JSON.stringify(dto).includes('loser-secret'), false);
});
