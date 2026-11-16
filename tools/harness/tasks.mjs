import { spawnSync } from 'node:child_process';
const task=process.argv[2];
if(!['lint','typecheck','build'].includes(task)) throw new Error('허용되지 않은 검증 작업입니다.');
const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run',task],{stdio:'inherit',shell:false});
if(result.error) { console.error(result.error.message); process.exitCode=1; }
else process.exitCode=result.status??1;
