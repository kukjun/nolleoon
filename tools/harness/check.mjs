import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runCheck } from './runner.mjs';
import { discoverTests } from './discovery.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const startedAt=new Date().toISOString();
const git=args=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});return r.status===0?r.stdout.trim():null;};
const source={commit:git(['rev-parse','HEAD']),worktree:git(['status','--porcelain'])};
const checks=[
 {id:'repo-contract',kind:'script',files:['tools/harness/repo-contract.mjs'],timeoutMs:10000},
 {id:'harness-self-test',kind:'node-tests',testDirectory:'tests/harness',timeoutMs:30000},
 {id:'workspace-contract',kind:'node-tests',testDirectory:'tests/workspace',timeoutMs:10000},
 {id:'docs-contract',kind:'node-tests',testDirectory:'tests/docs',timeoutMs:10000},
 {id:'lint',kind:'script',files:['tools/harness/tasks.mjs'],args:['lint'],timeoutMs:60000},
 {id:'layers',kind:'script',files:['tools/workspace/layers.mjs'],timeoutMs:10000},
 {id:'build',kind:'script',files:['tools/harness/tasks.mjs'],args:['build'],timeoutMs:120000},
 {id:'types',kind:'script',files:['tools/harness/tasks.mjs'],args:['typecheck'],timeoutMs:60000,dependsOn:'build'},
 {id:'unit',kind:'node-tests',testDirectory:'tests/unit',timeoutMs:10000,dependsOn:'build'},
 {id:'api-integration',kind:'node-tests',testDirectory:'tests/integration',timeoutMs:15000,dependsOn:'build'},
 {id:'db-integration',kind:'node-tests',testDirectory:'tests/database',timeoutMs:15000,dependsOn:'build'},
 {id:'browser-launch',kind:'playwright',files:['node_modules/@playwright/test/cli.js'],args:['test','--reporter=json','--grep-invert','@e2e|@mobile'],timeoutMs:300000,dependsOn:'build'},
 {id:'gameplay-e2e',kind:'playwright',files:['node_modules/@playwright/test/cli.js'],args:['test','--reporter=json','--grep','@e2e'],timeoutMs:150000,dependsOn:'build'},
 {id:'mobile-emulation',kind:'playwright',files:['node_modules/@playwright/test/cli.js'],args:['test','--reporter=json','--grep','@mobile'],timeoutMs:90000,dependsOn:'build'}
];
const results=[];
for(const check of checks) {
 const dependency=check.dependsOn && results.find(r=>r.id===check.dependsOn);
 if(dependency && dependency.status!=='passed') { results.push({id:check.id,status:'blocked',reason:`선행 ${check.dependsOn} 실패`,testCount:null}); continue; }
 try {
  const configured=check.testDirectory?{...check,files:discoverTests(root,check.testDirectory)}:check;
  results.push(runCheck(configured,root));
 } catch(error) { results.push({id:check.id,status:'blocked',reason:error.message,testCount:null}); }
}
const planned=[
 {id:'mobile-device',status:'blocked',reason:'물리 iPhone은 offline/unavailable, Android 기기 접근 미확보. 에뮬레이션으로 대체 불가'},
 {id:'external-deployment',status:'blocked',reason:'실제 배포 승인·적용 #65 대기. 로컬 검사로 외부 5인 인수 대체 불가'}
];
const report={schemaVersion:2,startedAt,finishedAt:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,...source,
 scope:'MVP-30 부분 외부 인수 준비 (실기기·운영 적용 blocked)',productValidation:'partial',status:results.every(r=>r.status==='passed')?'passed':'failed',results,planned};
const dir=resolve(root,'artifacts/harness',startedAt.replace(/[:.]/g,'-')+'-'+process.pid);
mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
for(const r of results)console.log(`${r.status.toUpperCase()} ${r.id}${r.testCount!==null?` (${r.testCount} tests)`:''}${r.reason?': '+r.reason:''}`);
for(const r of planned)console.log(`${r.status.toUpperCase()} ${r.id}: ${r.reason}`);
console.log('제품 전체 인수: 미완료');console.log(`Evidence: ${dir}/report.json`);
process.exitCode=report.status==='passed'?0:1;
