import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCheck } from '../../tools/harness/runner.mjs';
function fixture(source, kind = 'script', timeoutMs = 3000) {
  const root = mkdtempSync(join(tmpdir(), 'trip-court-harness-'));
  writeFileSync(join(root, 'fixture.mjs'), source);
  try { return runCheck({ id: 'fixture', kind, files: ['fixture.mjs'], timeoutMs }, root); }
  finally { rmSync(root, { recursive: true, force: true }); }
}
test('successful command produces measurable evidence', () => {
  const r = fixture("console.log('evidence')");
  assert.equal(r.status, 'passed'); assert.match(r.stdout, /evidence/); assert.equal(r.exitCode, 0);
});
test('nonzero command cannot be reported as success', () => {
  assert.equal(fixture('process.exitCode = 3').status, 'failed');
});
test('timeout fails instead of waiting forever', () => {
  const r = fixture('setInterval(() => {}, 1000)', 'script', 100);
  assert.equal(r.status, 'failed'); assert.equal(r.reason, 'ETIMEDOUT');
});
test('missing input cannot silently pass', () => {
  assert.equal(runCheck({ id: 'missing', kind: 'script', files: ['no-such-file.mjs'], timeoutMs: 100 }, process.cwd()).status, 'blocked');
});
test('empty test file cannot become a green test run', () => {
  assert.equal(fixture('// no tests', 'node-tests').status, 'failed');
});
test('skipped tests cannot become acceptance evidence', () => {
  assert.equal(fixture("import test from 'node:test'; test.skip('skipped', () => {});", 'node-tests').status, 'incomplete');
});
test('a real passing test is accepted and counted', () => {
  const r = fixture("import test from 'node:test'; test('passes', () => {});", 'node-tests');
  assert.equal(r.status, 'passed'); assert.equal(r.testCount, 1);
});
test('injected assertion failure is detected', () => {
  assert.equal(fixture("import test from 'node:test'; import assert from 'node:assert/strict'; test('broken', () => assert.equal(1, 2));", 'node-tests').status, 'failed');
});
test('invalid configuration fails closed', () => {
  assert.equal(runCheck({ id: 'empty', kind: 'node-tests', files: [], timeoutMs: 100 }, process.cwd()).status, 'failed');
});
test('실행 불가능한 입력은 blocked로 구분한다', () => {
 const r=runCheck({id:'missing',kind:'script',files:['absent.mjs'],timeoutMs:100},process.cwd());
 assert.equal(r.status,'blocked');
});
test('TODO와 skip은 개수와 미완료 상태를 보존한다', () => {
 const r=fixture("import test from 'node:test'; test.todo('대기'); test.skip('생략',()=>{});",'node-tests');
 assert.equal(r.status,'incomplete'); assert.equal(r.counts.todo,1); assert.equal(r.counts.skipped,1);
});
test('Playwright JSON 정상·실패·빈값·skip·flaky를 정규화한다', () => {
 for (const [stats,status] of [
  [{expected:1,unexpected:0,skipped:0,flaky:0},'passed'],
  [{expected:0,unexpected:1,skipped:0,flaky:0},'failed'],
  [{expected:0,unexpected:0,skipped:0,flaky:0},'incomplete'],
  [{expected:0,unexpected:0,skipped:1,flaky:0},'incomplete'],
  [{expected:0,unexpected:0,skipped:0,flaky:1},'failed']]) {
  const r=fixture(`console.log(${JSON.stringify(JSON.stringify({stats,errors:[]}))})`,'playwright');
  assert.equal(r.status,status); assert.equal(r.testCount,Object.values(stats).reduce((a,b)=>a+b,0));
 }
});

test('혼합 pass/skip과 오염된 브라우저 JSON을 성공으로 세지 않는다', () => {
 const mixed=fixture("import test from 'node:test'; test('통과',()=>{}); test.skip('생략',()=>{});",'node-tests');
 assert.equal(mixed.status,'incomplete'); assert.equal(mixed.counts.passed,1); assert.equal(mixed.counts.skipped,1);
 assert.equal(fixture("console.log('not-json')",'playwright').status,'failed');
});
test('시간 초과 후 같은 프로세스 그룹의 손자도 정리한다', async () => {
 if(process.platform==='win32') throw new Error('이 프로세스 정리 시험은 macOS/Linux 대상입니다.');
 const root=mkdtempSync(join(tmpdir(),'trip-court-timeout-'));
 const output=join(root,'ticks.txt'); writeFileSync(output,'');
 const child="import { appendFileSync } from 'node:fs'; setInterval(()=>appendFileSync("+JSON.stringify(output)+",'x'),20);";
 writeFileSync(join(root,'fixture.mjs'),"import { spawn } from 'node:child_process'; spawn(process.execPath,['--input-type=module','-e',"+JSON.stringify(child)+"],{stdio:'ignore'}); setInterval(()=>{},1000);");
 try {
  const result=runCheck({id:'timeout-child',kind:'script',files:['fixture.mjs'],timeoutMs:500},root);
  assert.equal(result.reason,'ETIMEDOUT');
  const before=readFileSync(output,'utf8'); assert.ok(before.length>0);
  await new Promise(ok=>setTimeout(ok,150)); assert.equal(readFileSync(output,'utf8'),before);
 } finally {rmSync(root,{recursive:true,force:true});}
});
test('시험 탐색은 중첩 파일을 정렬하고 빈 디렉터리는 거절한다', async () => {
 const { discoverTests } = await import('../../tools/harness/discovery.mjs');
 const { mkdirSync } = await import('node:fs');
 const root=mkdtempSync(join(tmpdir(),'trip-court-discovery-'));
 try {
  mkdirSync(join(root,'unit')); assert.throws(()=>discoverTests(root,'unit'),/시험/);
  mkdirSync(join(root,'unit','nested')); mkdirSync(join(root,'legacy'));
  writeFileSync(join(root,'unit','z.test.mjs'),''); writeFileSync(join(root,'unit','nested','a.test.mjs'),'');
  writeFileSync(join(root,'unit','helper.mjs'),''); writeFileSync(join(root,'legacy','other.test.mjs'),'');
  assert.deepEqual(discoverTests(root,'unit'),['unit/nested/a.test.mjs','unit/z.test.mjs']);
 } finally {rmSync(root,{recursive:true,force:true});}
});
