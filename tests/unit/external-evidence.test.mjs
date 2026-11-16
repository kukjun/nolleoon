import { spawnSync } from 'node:child_process';
import { mkdtempSync,writeFileSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { auditExternalEvidence } from '../../tools/deployment/external-evidence.mjs';
const kinds=['tls','health','static','cookie','invite','five-player-vote','sync','reconnect','history','existing-service'];
function complete(){return {schemaVersion:1,targetOrigin:'https://tripcourt.synthetic.org',release:{expectedCommit:'a'.repeat(40),observedCommit:'a'.repeat(40),sourceEvidence:'synthetic build record'},observations:kinds.map(kind=>({kind,observedAt:'2026-11-17T00:00:00Z',network:{kind:'external',source:'synthetic external network'},evidence:'synthetic observation',result:'passed'})),operatorClaims:[]};}
test('완비된 오프라인 증거도 독립검토 준비일 뿐 외부 통과가 아니다',()=>{const r=auditExternalEvidence(complete());assert.equal(r.status,'ready-for-independent-review');assert.equal(r.verified,false);assert.equal(r.acceptedCount,10);});
test('로컬·사설·예시·경로·인증 origin은 거부한다',()=>{for(const origin of [' https://public.org','https://public.org/','https://%70ublic.org','http://public.org','https://localhost','https://127.0.0.1','https://10.1.2.3','https://[::1]','https://192.168.1.1','https://100.64.0.1','https://example.com','https://sub.example.org','https://app.test','https://app.local','https://user:secret@public.org','https://public.org/path','https://public.org?x=1']){const input=complete();input.targetOrigin=origin;assert.equal(auditExternalEvidence(input).status,'blocked',origin);}});
test('주장만·잘못된 commit·외부망 누락·5인 시험 누락은 검토 준비가 아니다',()=>{
 for(const mutate of [x=>{x.observations=[];x.operatorClaims=['all passed'];},x=>{x.release.observedCommit='b'.repeat(40);},x=>{x.observations[0].network=null;},x=>{x.observations=x.observations.filter(o=>o.kind!=='five-player-vote');},x=>{x.observations[0].result='failed';},x=>{x.observations[0].observedAt='not-date';}]){const input=complete();mutate(input);assert.equal(auditExternalEvidence(input).status,'incomplete');}
});
test('누락·잘못된 구조는 blocked이고 오류에 제공된 비밀값을 출력하지 않는다',()=>{for(const input of [null,{},[],{schemaVersion:2,secret:'SECRET'}]){const r=auditExternalEvidence(input);assert.equal(r.status,'blocked');assert.equal(JSON.stringify(r).includes('SECRET'),false);}});

test('CLI는 누락 파일에서 blocked이며 완비된 합성 자료도 값 없이 검토 준비만 출력한다',()=>{
 const root=mkdtempSync(join(tmpdir(),'trip-external-evidence-'));
 const cli=new URL('../../tools/deployment/external-evidence.mjs',import.meta.url).pathname;
 try{
  const missing=spawnSync(process.execPath,[cli,join(root,'PRIVATE-missing.json')],{encoding:'utf8'});
  assert.equal(missing.status,1);assert.equal(JSON.parse(missing.stdout).status,'blocked');assert.equal(missing.stdout.includes(root),false);assert.equal(missing.stderr,'');
  const file=join(root,'PRIVATE-evidence.json');writeFileSync(file,JSON.stringify(complete()));
  const result=spawnSync(process.execPath,[cli,file],{encoding:'utf8'});
  assert.equal(result.status,0);assert.equal(JSON.parse(result.stdout).status,'ready-for-independent-review');
  for(const value of [root,'tripcourt.synthetic.org','synthetic observation','a'.repeat(40)])assert.equal(result.stdout.includes(value),false);
  const source=readFileSync(cli,'utf8');assert.doesNotMatch(source,/from ['"](?:node:)?(?:https?|dns|net)['"]|\bfetch\s*\(/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('실제 빈 배포 증거 템플릿은 target 미확정으로 blocked이다',()=>{
 const template=JSON.parse(readFileSync(new URL('../../deploy/templates/external-evidence.example.json',import.meta.url),'utf8'));
 assert.equal(auditExternalEvidence(template).status,'blocked');
 const input=complete();input.observations=[];assert.equal(auditExternalEvidence(input).status,'incomplete');
});
