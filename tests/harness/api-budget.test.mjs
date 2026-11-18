import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as discovery from '../../tools/harness/discovery.mjs';
import {runCheck} from '../../tools/harness/runner.mjs';

test('API alone has a fixed file worker and explicit measured suite budget',()=>{
 assert.equal(discovery.API_SUITE_TIMEOUT_MS,180000);
 const files=['tests/integration/a.test.mjs','tests/integration/nested/z.test.mjs'];
 assert.deepEqual(discovery.nodeTestArguments('tests/integration',files),['--test','--test-concurrency=1',...files]);
 for(const directory of ['tests/unit','tests/database','tests/harness','tests/workspace','tests/docs']) {
  assert.deepEqual(discovery.nodeTestArguments(directory,files),['--test',...files]);
 }
});

test('npm discovery and aggregate runner keep all nested API files with the same worker policy',()=>{
 const root=mkdtempSync(join(tmpdir(),'api-worker-budget-'));
 try {
  mkdirSync(join(root,'tests/integration/nested'),{recursive:true});
  for(const name of ['a.test.mjs','nested/z.test.mjs'])writeFileSync(join(root,'tests/integration',name),"import test from 'node:test';test('real assertion',()=>{});");
  writeFileSync(join(root,'tests/integration/helper.mjs'),'');
  const files=discovery.discoverTests(root,'tests/integration');
  assert.deepEqual(files,['tests/integration/a.test.mjs','tests/integration/nested/z.test.mjs']);
  const result=runCheck({id:'api-integration',kind:'node-tests',testDirectory:'tests/integration',files,timeoutMs:3000},root);
  assert.equal(result.status,'passed');assert.equal(result.testCount,2);
  assert.deepEqual(result.command,['node',...discovery.nodeTestArguments('tests/integration',files,'tap')]);
  assert.ok(result.command.includes('--test-concurrency=1'));
  assert.deepEqual(result.command.slice(-files.length),files);
  mkdirSync(join(root,'tools/harness'),{recursive:true});
  copyFileSync(new URL('../../tools/harness/discovery.mjs',import.meta.url),join(root,'tools/harness/discovery.mjs'));
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const cli=spawnSync(process.execPath,['tools/harness/discovery.mjs','tests/integration'],{cwd:root,env,encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);
  assert.match(cli.stdout,/(?:#|ℹ) tests 2/);
  assert.match(cli.stdout,/(?:#|ℹ) pass 2/);
  const aggregate=readFileSync(new URL('../../tools/harness/check.mjs',import.meta.url),'utf8');
  assert.match(aggregate,/id:'api-integration'.*timeoutMs:API_SUITE_TIMEOUT_MS/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('serial API still rejects skipped evidence and does not serialize other suites',()=>{
 const root=mkdtempSync(join(tmpdir(),'api-worker-skip-'));
 try {
  writeFileSync(join(root,'skip.test.mjs'),"import test from 'node:test';test.skip('not evidence',()=>{});");
  const check={id:'api-integration',kind:'node-tests',testDirectory:'tests/integration',files:['skip.test.mjs'],timeoutMs:3000};
  assert.equal(runCheck(check,root).status,'incomplete');
  const other=runCheck({...check,id:'unit',testDirectory:'tests/unit'},root);
  assert.equal(other.command.includes('--test-concurrency=1'),false);
 }finally{rmSync(root,{recursive:true,force:true});}
});
