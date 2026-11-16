import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('현재 개발 안내는 구현된 게임과 미완료 인수를 구분한다',()=>{
 assert.doesNotMatch(read('README.md'),/게임 기능과 DB는 아직 구현 중/);
 assert.doesNotMatch(read('docs/local-development.md'),/게임 기능은 없다|방\/게임 기능은 구현하지 않았다/);
 for(const p of ['README.md','docs/local-development.md'])assert.match(read(p),/acceptance\.md/);
});
