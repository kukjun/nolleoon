import {cpSync,mkdtempSync,mkdirSync,readFileSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../../',import.meta.url));
const mutations=[
 {id:'defendant-allowed',file:'application/submit-vote.js',
  from:"if (!member || !participant || participant.role !== 'participant' || !participant.eligible)",
  to:'if (!member || !participant)'},
 {id:'vote-unique-removed',file:'infrastructure/sqlite/migrations.js',
  from:'PRIMARY KEY(game_id,round_number,member_id), UNIQUE(game_id,round_number,request_id),',
  to:'UNIQUE(game_id,round_number,request_id),'},
 {id:'private-reason-serialized',file:'application/rooms.js',
  from:'r.votes.find(candidate.id, firstRound.number, participation.memberId)',
  to:'r.votes.list(candidate.id, firstRound.number)[0]'},
 {id:'history-auth-omitted',file:'application/personal-history.js',
  from:"if (!r.participants.hasSession(id, sessionId))\n        throw new DomainFailure('FORBIDDEN');",
  to:'// MUTANT: actual game membership authorization omitted.'}
];

export function runSecurityMutations(){
 const temporary=mkdtempSync(join(tmpdir(),'trip-security-mutations-'));
 const results=[];
 try{
  for(const mutation of mutations){
   const record={id:mutation.id,cleanPassed:false,mutantKilled:false};
   for(const mode of ['clean','mutant']){
    const copy=resolve(temporary,`${mutation.id}-${mode}`);mkdirSync(copy);
    cpSync(resolve(root,'apps/api/dist'),resolve(copy,'dist'),{recursive:true});
    writeFileSync(resolve(copy,'package.json'),'{"type":"module"}\n');
    symlinkSync(resolve(root,'node_modules'),resolve(copy,'node_modules'),'dir');
    if(mode==='mutant'){
     const path=resolve(copy,'dist',mutation.file),source=readFileSync(path,'utf8');
     if(source.split(mutation.from).length!==2)throw new Error(`${mutation.id}: 결함 주입 위치가 정확히 하나가 아닙니다. 빌드와 기준을 확인하세요.`);
     writeFileSync(path,source.replace(mutation.from,mutation.to));
    }
    const child=spawnSync(process.execPath,[resolve(root,'tools/security/mutation-probe.mjs'),copy,mutation.id],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024,env:{...process.env,NODE_TEST_CONTEXT:undefined}});
    if(child.error||child.signal)throw new Error(`${mutation.id}/${mode}: 실행 중단 또는 시간 초과`);
    if(mode==='clean'){
     if(child.status!==0)throw new Error(`${mutation.id}: 기준 코드 검사 실패\n${child.stderr}`);
     record.cleanPassed=true;
    }else{
     // 임의 import/DB 오류를 결함 검출로 오인하지 않고 의도한 assertion 실패만 인정한다.
     if(child.status===0||!child.stderr.includes('AssertionError')||!child.stderr.includes(`MUTATION_INVARIANT:${mutation.id}`))throw new Error(`${mutation.id}: 결함이 생존했거나 의도하지 않은 실패\n${child.stderr}`);
     record.mutantKilled=true;
    }
   }
   results.push(record);
  }
  return {status:'passed',cleanControls:results.length,killedMutants:results.length,results};
 }finally{rmSync(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(runSecurityMutations(),null,2));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
