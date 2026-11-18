import { nodeTestArguments } from './discovery.mjs';
import {tmpdir} from 'node:os';
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, relative, isAbsolute, join } from 'node:path';

// 검토한 저장소 코드를 실행하는 측정 도구이며 샌드박스가 아니다.
export function runCheck(check, cwd) {
  const started = Date.now();
  const stop = (status, reason) => ({ id: check?.id ?? 'invalid', status, reason, testCount:null, durationMs:Date.now()-started });
  if (!check || !/^[a-z0-9-]+$/.test(check.id ?? '') || !['script','node-tests','playwright'].includes(check.kind)
    || !Number.isInteger(check.timeoutMs) || check.timeoutMs<1 || check.timeoutMs>360000
    || !Array.isArray(check.files) || !check.files.length
    || (check.args !== undefined && (!Array.isArray(check.args) || check.args.some(a=>typeof a!=='string')))) return stop('failed','invalid check configuration');
  if (!existsSync(cwd)) return stop('blocked','missing working directory');
  const root=realpathSync(cwd);
  for(const file of check.files) {
    if(typeof file!=='string' || isAbsolute(file)) return stop('failed','invalid input file');
    if(!existsSync(resolve(root,file))) return stop('blocked','missing input file');
    const rel=relative(root,realpathSync(resolve(root,file)));
    if(rel.startsWith('..') || isAbsolute(rel) || !/\.[cm]?js$/.test(file)) return stop('failed','input must be an in-repo JavaScript file');
  }
  if(check.kind!=='node-tests' && check.files.length!==1) return stop('failed','script requires one file');
  const args=check.kind==='node-tests' ? nodeTestArguments(check.testDirectory,check.files,'tap') : [...check.files,...(check.args??[])];
  const env={...process.env,NO_COLOR:'1'};
  delete env.NODE_TEST_CONTEXT;
  const leaseDirectory=check.kind==='playwright'?mkdtempSync(join(tmpdir(),'trip-browser-lease-')):null;
  if(leaseDirectory){env.TRIP_HARNESS_OWNER=String(process.pid);env.TRIP_BROWSER_LEASE=join(leaseDirectory,'active');writeFileSync(env.TRIP_BROWSER_LEASE,'active');}
  let result;
  try {result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:check.timeoutMs,killSignal:'SIGKILL',maxBuffer:8*1024*1024,env,detached:process.platform!=='win32'});}
  finally {if(leaseDirectory)rmSync(leaseDirectory,{recursive:true,force:true});}
  if (process.platform!=='win32' && result.pid) {
    try { process.kill(-result.pid, 'SIGKILL'); } catch (error) { if(error.code!=='ESRCH') throw error; }
  }
  const stdout=result.stdout??'',stderr=result.stderr??'';
  let status='passed', reason=null, counts=null, testCount=null;
  if(result.error || result.signal || result.status!==0) {
    status=result.error && ['ENOENT','EACCES'].includes(result.error.code)?'blocked':'failed';
    reason=result.error?.code ?? (result.signal?`signal ${result.signal}`:`exit ${result.status}`);
  }
  if(check.kind==='node-tests') {
    const count=name=>{const matches=[...stdout.matchAll(new RegExp(`^# ${name} (\\d+)\\s*$`,'gm'))];return matches.length?Number(matches.at(-1)[1]):null;};
    counts={total:count('tests'),passed:count('pass'),failed:count('fail'),skipped:count('skipped'),todo:count('todo'),cancelled:count('cancelled')};
    testCount=counts.total;
    const implicit=check.files.some(f=>stdout.includes('# Subtest: '+f+'\n')||stdout.includes('# Subtest: '+resolve(root,f)+'\n'));
    if(status==='passed' && (Object.values(counts).some(n=>n===null) || implicit)) {status='failed';reason='invalid TAP or implicit file-only test';}
    else if(status==='passed' && counts.failed) {status='failed';reason='test assertion failed';}
    else if(status==='passed' && (!testCount || counts.passed!==testCount)) {status='incomplete';reason='zero, skipped, TODO, or incomplete tests';}
  }
  if(check.kind==='playwright') {
    try {
      const report=JSON.parse(stdout); const stats=report.stats;
      if(!stats || ['expected','unexpected','skipped','flaky'].some(k=>!Number.isInteger(stats[k])||stats[k]<0) || !Array.isArray(report.errors)) throw new Error('invalid schema');
      counts={passed:stats.expected,failed:stats.unexpected,skipped:stats.skipped,flaky:stats.flaky};
      testCount=Object.values(counts).reduce((a,b)=>a+b,0);
      if(status==='passed' && (counts.failed || counts.flaky || report.errors.length)) {status='failed';reason='Playwright failures, flaky tests, or errors';}
      else if(status==='passed' && (!testCount || counts.skipped)) {status='incomplete';reason='zero or skipped Playwright tests';}
    } catch { if(status==='passed'){status='failed';reason='invalid Playwright JSON';} }
  }
  return {id:check.id,status,reason,exitCode:result.status,testCount,counts,durationMs:Date.now()-started,command:['node',...args],stdout,stderr};
}
