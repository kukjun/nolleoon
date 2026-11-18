import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import config from '../../playwright.config.mjs';
import {LEGACY_BROWSER_CHECKS} from '../../tools/harness/legacy-browser.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
function list(args){
 const result=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js',...args,'--list'],{cwd:root,encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
 const report=JSON.parse(result.stdout);assert.deepEqual(report.errors,[]);
 const specs=[];function visit(suite){specs.push(...(suite.specs??[]));for(const child of suite.suites??[])visit(child);}for(const suite of report.suites)visit(suite);
 return specs.flatMap(spec=>spec.tests.map(t=>{assert.equal(t.expectedStatus,'passed');return `${spec.id}:${t.projectId}`;}));
}
test('두 순차 browser gate는 기존75시험을 중복·누락 없이 각1회 포함한다',()=>{
 const args=['test','--reporter=json','--grep-invert','@e2e|@mobile'];
 const original=list(args);assert.equal(original.length,75);
 const assigned=LEGACY_BROWSER_CHECKS.flatMap(check=>list(check.args));
 assert.equal(assigned.length,original.length);assert.equal(new Set(assigned).size,assigned.length);
 assert.deepEqual(assigned.toSorted(),original.toSorted());
});
test('총예산720초를 명시하고 각360초/개별15초/재시도0/순차1worker를 유지한다',()=>{
 assert.equal(LEGACY_BROWSER_CHECKS.length,2);
 assert.equal(LEGACY_BROWSER_CHECKS.reduce((sum,c)=>sum+c.timeoutMs,0),720000);
 for(const [index,check] of LEGACY_BROWSER_CHECKS.entries()){
  assert.equal(check.kind,'playwright');assert.equal(check.timeoutMs,360000);assert.equal(check.dependsOn,'build');
  assert.deepEqual(check.files,['node_modules/@playwright/test/cli.js']);
  assert.deepEqual(check.args,['test','--reporter=json','--grep-invert','@e2e|@mobile',`--shard=${index+1}/2`]);
 }
 assert.equal(config.timeout,15000);assert.equal(config.retries,0);assert.equal(config.workers,1);assert.equal(config.fullyParallel,false);
 const source=readFileSync(new URL('../../tools/harness/check.mjs',import.meta.url),'utf8');assert.match(source,/\.\.\.LEGACY_BROWSER_CHECKS/);assert.match(source,/for\(const check of checks\)/);
});
