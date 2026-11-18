import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditAcceptanceEvidence, requiredGates } from '../../tools/deployment/acceptance-evidence.mjs';
const commit='a'.repeat(40), now=Date.parse('2026-11-17T12:00:00.000Z');
function complete(){return {schemaVersion:1,expectedCommit:commit,source:{commit,dirty:false},window:{notBefore:'2026-11-16T00:00:00.000Z',notAfter:'2026-11-17T11:00:00.000Z'},gates:requiredGates.map(id=>({id,commit,observedAt:'2026-11-17T10:00:00.000Z',status:'passed',evidenceRef:'synthetic evidence',counts:{total:1,passed:1,failed:0,skipped:0,todo:0,flaky:0,cancelled:0},context:id==='physical-ios'?{kind:'physical',platform:'ios',browser:'safari',browserVersion:'synthetic-version',osVersion:'synthetic-os'}:id==='physical-android'?{kind:'physical',platform:'android',browser:'chrome',browserVersion:'synthetic-version',osVersion:'synthetic-os'}:id==='external-deployment'?{kind:'external',origin:'https://synthetic.public.org',networkSource:'synthetic external network'}:{}})),unresolvedBlockers:[],userAcceptance:{commit,accepted:true,observedAt:'2026-11-17T10:30:00.000Z',evidenceRef:'synthetic acceptance'}};}
const audit=input=>auditAcceptanceEvidence(input,{now});
test('완비된 합성 증거는 사람 검토 준비이며 검증 완료가 아니다',()=>{const r=audit(complete());assert.equal(r.status,'ready-for-human-review');assert.equal(r.verified,false);});
test('실제 빈 템플릿과 미결 차단 사유는 blocked이다',()=>{assert.equal(audit(JSON.parse(readFileSync(new URL('../../deploy/templates/acceptance-evidence.example.json',import.meta.url)))).status,'blocked');for(const blocker of [33,36,63,65]){const x=complete();x.unresolvedBlockers=[blocker];assert.equal(audit(x).status,'blocked');}});
test('commit·dirty·시각 창·사용자 승인이 불일치하면 준비가 아니다',()=>{
 for(const mutate of [x=>x.source.dirty=true,x=>x.expectedCommit='not-a-commit',x=>x.userAcceptance=null,x=>delete x.userAcceptance,x=>x.window.notBefore='2026-11-18T00:00:00.000Z',x=>x.gates[0].observedAt='2026-11-18T00:00:00.000Z',x=>x.source.commit='b'.repeat(40),x=>x.gates[0].commit='b'.repeat(40),x=>x.window.notBefore=x.window.notAfter,x=>x.window.notAfter='2099-01-01T00:00:00.000Z',x=>x.window.notBefore='invalid',x=>x.gates[0].observedAt='2026-11-15T00:00:00.000Z',x=>x.userAcceptance.accepted=false,x=>x.userAcceptance.commit='b'.repeat(40),x=>x.userAcceptance.evidenceRef=null]){const x=complete();mutate(x);assert.notEqual(audit(x).status,'ready-for-human-review');}
});
test('누락·중복 gate, 0·skip·todo·flaky·취소·실패 count를 성공으로 인정하지 않는다',()=>{
 for(const mutate of [...requiredGates.map(id=>x=>{x.gates=x.gates.filter(g=>g.id!==id);}),x=>{x.gates=[];x.operatorClaims=['all gates passed'];},x=>x.gates[0].status='failed',x=>x.gates[0].status='unknown',x=>x.gates.push(x.gates[0]),...['passed','failed','skipped','todo','flaky','cancelled'].map(key=>x=>{x.gates.find(g=>g.id==='unit').counts[key]=key==='passed'?0:1;}),x=>delete x.gates.find(g=>g.id==='unit').counts]){const x=complete();mutate(x);assert.equal(audit(x).status,'incomplete');}
});
test('실기기 에뮬레이션·로컬 외부증거·부족한 맥락은 성공으로 인정하지 않는다',()=>{
 for(const mutate of [x=>x.gates.find(g=>g.id==='physical-ios').context.kind='emulated',x=>x.gates.find(g=>g.id==='physical-android').context.platform='ios',...['https://localhost','https://127.0.0.1','https://10.0.0.1','https://example.com'].map(origin=>x=>x.gates.find(g=>g.id==='external-deployment').context.origin=origin),x=>delete x.gates.find(g=>g.id==='external-deployment').context.networkSource]){const x=complete();mutate(x);assert.equal(audit(x).status,'incomplete');}
});

test('CLI 누락 파일과 원문 비노출, 네트워크 미사용을 확인한다',()=>{
 const root=mkdtempSync(join(tmpdir(),'trip-acceptance-'));
 const cli=new URL('../../tools/deployment/acceptance-evidence.mjs',import.meta.url).pathname;
 try{
  const file=join(root,'private-evidence.json');
  const missing=spawnSync(process.execPath,[cli,file],{encoding:'utf8'});assert.equal(missing.status,1);assert.equal(JSON.parse(missing.stdout).status,'blocked');assert.equal(missing.stderr,'');
  const x=complete();x.gates[0].evidenceRef='PRIVATE_EVIDENCE';x.unresolvedBlockers=[33];writeFileSync(file,JSON.stringify(x));
  const result=spawnSync(process.execPath,[cli,file],{encoding:'utf8'});
  assert.equal(result.status,1);assert.equal(JSON.parse(result.stdout).status,'blocked');
  for(const value of [root,commit,'PRIVATE_EVIDENCE','synthetic.public.org'])assert.equal(result.stdout.includes(value),false);
  assert.doesNotMatch(readFileSync(cli,'utf8'),/from ['"](?:node:)?(?:https?|dns|net)['"]|\bfetch\s*\(/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('24시간보다 오래된 증거도 명시적 동결 창 안이면 임의 만료시키지 않는다',()=>{
 const x=complete();x.window.notBefore='2026-11-01T00:00:00.000Z';x.window.notAfter='2026-11-02T00:00:00.000Z';
 for(const gate of x.gates)gate.observedAt='2026-11-01T12:00:00.000Z';
 x.userAcceptance.observedAt='2026-11-01T13:00:00.000Z';
 assert.equal(audit(x).status,'ready-for-human-review');
});

test('실기기 gate는 플랫폼별 브라우저와 비어 있지 않은 브라우저·OS 버전을 요구한다',()=>{
 for(const id of ['physical-ios','physical-android']){
  for(const mutate of [c=>delete c.browser,c=>{c.browser=id==='physical-ios'?'chrome':'safari';},c=>delete c.browserVersion,c=>{c.browserVersion='   ';},c=>delete c.osVersion,c=>{c.osVersion='';}]){
   const x=complete();mutate(x.gates.find(g=>g.id===id).context);
   assert.equal(audit(x).status,'incomplete');
  }
 }
});

test('MVP-only evidence cannot satisfy Party feature and journey acceptance',()=>{
 const x=complete();x.gates=x.gates.filter(g=>!['party-browser','party-e2e'].includes(g.id));const result=audit(x);
 assert.equal(result.status,'incomplete');assert.deepEqual(result.missing,['party-browser','party-e2e']);assert.equal(result.verified,false);
});
test('both Party gates require real nonzero clean counts and matching frozen source',()=>{
 for(const id of ['party-browser','party-e2e']){
  assert.ok(requiredGates.includes(id));
  for(const mutate of [g=>delete g.counts,g=>{g.counts.total=0;g.counts.passed=0;},...['failed','skipped','todo','flaky','cancelled'].map(key=>g=>{g.counts[key]=1;}),g=>{g.counts.total=2;},g=>{g.counts.passed=-1;},g=>{g.counts.total=1.5;},g=>{g.commit='b'.repeat(40);},g=>{g.status='not-run';},g=>{g.evidenceRef='';},g=>{g.observedAt='2026-11-15T00:00:00.000Z';}]){
   const x=complete();mutate(x.gates.find(g=>g.id===id));const result=audit(x);assert.equal(result.status,'incomplete');assert.ok(result.missing.includes(id));assert.equal(result.verified,false);
  }
 }
 const result=audit(complete());assert.equal(result.status,'ready-for-human-review');assert.equal(result.acceptedCount,20);assert.equal(result.verified,false);
});

test('기존 MVP/Party 증거만으로 여행방 UI·전체 여정 검사를 생략할 수 없다',()=>{
 const x=complete();x.gates=x.gates.filter(g=>!['travel-browser','travel-e2e'].includes(g.id));const result=audit(x);
 assert.equal(result.status,'incomplete');assert.deepEqual(result.missing,['travel-browser','travel-e2e']);assert.equal(result.verified,false);
});
test('여행방 두 gate는 알려진 필수 시험이며 동일 RC·시간창·nonzero 무실패 증거를 요구한다',()=>{
 for(const id of ['travel-browser','travel-e2e']){
  assert.ok(requiredGates.includes(id));
  for(const mutate of [g=>delete g.counts,g=>{g.counts.total=0;g.counts.passed=0;},...['failed','skipped','todo','flaky','cancelled'].map(key=>g=>{g.counts[key]=1;}),g=>{g.counts.total=2;},g=>{g.counts.passed=-1;},g=>{g.counts.total=1.5;},g=>{g.commit='b'.repeat(40);},g=>{g.status='failed';},g=>{g.status='not-run';},g=>{g.evidenceRef='';},g=>{g.observedAt='2026-11-15T00:00:00.000Z';},g=>{g.observedAt='2026-11-17T11:00:00.001Z';},g=>{g.observedAt='invalid';}]){
   const x=complete();mutate(x.gates.find(g=>g.id===id));const result=audit(x);
   assert.equal(result.status,'incomplete');assert.ok(result.missing.includes(id));assert.equal(result.verified,false);
  }
  const missing=complete();missing.gates=missing.gates.filter(g=>g.id!==id);assert.deepEqual(audit(missing).missing,[id]);
  const duplicate=complete();duplicate.gates.push({...duplicate.gates.find(g=>g.id===id)});assert.equal(audit(duplicate).status,'incomplete');
 }
 const result=audit(complete());assert.equal(result.status,'ready-for-human-review');assert.equal(result.acceptedCount,20);assert.deepEqual(result.missing,[]);assert.equal(result.issues.includes('unknown-gate'),false);assert.equal(result.verified,false);
});
