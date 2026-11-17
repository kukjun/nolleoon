import test from 'node:test';
import assert from 'node:assert/strict';
import {casePreview} from '../../apps/web/src/case-preview.ts';
test('사건 미리보기는 90번째 코드 포인트의 이모지를 자르지 않는다',()=>{
 const boundary='a'.repeat(89)+'😀';
 assert.equal(casePreview(boundary),boundary);
 assert.equal(casePreview(boundary+'뒤'),boundary+'…');
 assert.equal(casePreview('😀'.repeat(91)),'😀'.repeat(90)+'…');
 assert.equal(casePreview('짧은 사건'),'짧은 사건');
 assert.equal(casePreview(boundary+'뒤').isWellFormed(),true);
});
