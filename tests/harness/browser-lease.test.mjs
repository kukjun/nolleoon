import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runCheck} from '../../tools/harness/runner.mjs';
import {watchBrowserLease} from '../../tools/harness/browser-lease.mjs';
test('detached 브라우저 서버도 하네스 timeout lease 종료 뒤 정리한다',async(t)=>{
 const root=mkdtempSync(join(tmpdir(),'trip-browser-lease-'));const ticks=join(root,'ticks');const pidFile=join(root,'child-pid');writeFileSync(ticks,'');
 const helper=new URL('../../tools/harness/browser-lease.mjs',import.meta.url).href;
 const child=`import {appendFileSync,writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(pidFile)},String(process.pid));import {watchBrowserLease} from ${JSON.stringify(helper)};watchBrowserLease(process.env.TRIP_BROWSER_LEASE,()=>process.exit(0));setInterval(()=>appendFileSync(${JSON.stringify(ticks)},'x'),20);`;
 writeFileSync(join(root,'fixture.mjs'),`import {spawn} from 'node:child_process';spawn(process.execPath,['--input-type=module','-e',${JSON.stringify(child)}],{stdio:'ignore',detached:true});setInterval(()=>{},1000);`);
 // 별도 after hook은 본래 assertion과 cleanup 오류를 각각 보고한다.
 t.after(()=>{
  try {
   try {process.kill(Number(readFileSync(pidFile,'utf8')),'SIGTERM');}
   catch(error) {if(!['ENOENT','ESRCH'].includes(error.code))throw error;}
  } finally {rmSync(root,{recursive:true,force:true});}
 });
 const result=runCheck({id:'detached-browser',kind:'playwright',files:['fixture.mjs'],timeoutMs:500},root);
 assert.equal(result.reason,'ETIMEDOUT');
 await new Promise(r=>setTimeout(r,250));
 const before=readFileSync(ticks,'utf8');assert.ok(before.length);
 await new Promise(r=>setTimeout(r,150));
 assert.equal(readFileSync(ticks,'utf8'),before);
 assert.equal(typeof watchBrowserLease,'function');
});

test('lease 파일이 남아도 소유 하네스 프로세스가 종료되면 정리한다',async()=>{
 const {spawn}=await import('node:child_process');
 const root=mkdtempSync(join(tmpdir(),'trip-lease-owner-'));const path=join(root,'active');writeFileSync(path,'active');
 const owner=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});let stop;
 try {let expired=false;stop=watchBrowserLease(path,()=>{expired=true;},owner.pid);owner.kill('SIGKILL');await new Promise(resolve=>owner.once('exit',resolve));await new Promise(resolve=>setTimeout(resolve,150));assert.equal(expired,true);}
 finally{stop?.();owner.kill();rmSync(root,{recursive:true,force:true});}
});
