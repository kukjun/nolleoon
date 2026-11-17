import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export const requiredGates = Object.freeze(['lint','layers','build','typecheck','unit','api','database','durability-backup-restore','browser-feature','gameplay-e2e','party-browser','party-e2e','mobile-emulation','independent-review','physical-ios','physical-android','external-deployment','remote-ci']);
const testGates = new Set(['unit','api','database','durability-backup-restore','browser-feature','gameplay-e2e','party-browser','party-e2e','mobile-emulation']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
function timestamp(value) {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return NaN;
 const parsed=Date.parse(value);
 return Number.isFinite(parsed) && new Date(parsed).toISOString()===value ? parsed : NaN;
}
function publicOrigin(value) {
 if(!text(value))return false;
 try {
  const url=new URL(value),host=url.hostname;
  return value===url.origin && url.protocol==='https:' && !url.username && !url.password && !url.port
   && host.includes('.') && !host.endsWith('.') && !/^[0-9.]+$/.test(host) && !host.includes(':')
   && host.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
   && !/(^|\.)(localhost|local|test|invalid|internal|home|lan|example)$/.test(host)
   && !/(^|\.)example\.(com|org|net)$/.test(host);
 } catch {return false;}
}
function validCounts(counts) {
 return object(counts) && ['total','passed','failed','skipped','todo','flaky','cancelled'].every(key=>Number.isSafeInteger(counts[key])&&counts[key]>=0)
  && counts.passed>0 && counts.total===counts.passed && ['failed','skipped','todo','flaky','cancelled'].every(key=>counts[key]===0);
}
/** Offline structure audit. Supplied evidence and identities are never independently verified. */
export function auditAcceptanceEvidence(input, {now=Date.now()}={}) {
 const issues=[];
 const report=(status,acceptedCount=0,missing=[...requiredGates])=>({status,verified:false,acceptedCount,missing,issues,limitations:'오프라인 형식 검사입니다. 증거 진위·실제 기기·외부 접속·CI·사용자 승인·배포 commit은 검증하지 않았습니다.'});
 if(!object(input)||input.schemaVersion!==1||!sha(input.expectedCommit)||!object(input.source)||!object(input.window)||!Array.isArray(input.gates)||!Array.isArray(input.unresolvedBlockers)) {issues.push('invalid-or-missing-document');return report('blocked');}
 const before=timestamp(input.window.notBefore),after=timestamp(input.window.notAfter);
 if(!Number.isFinite(now)||!Number.isFinite(before)||!Number.isFinite(after)||before>=after||after>now){issues.push('invalid-freeze-window');return report('blocked');}
 if(input.source.dirty!==false||input.source.commit!==input.expectedCommit){issues.push('dirty-or-mismatched-source');return report('blocked');}
 if(input.unresolvedBlockers.length){issues.push('unresolved-blockers');return report('blocked');}
 const inside=value=>{const time=timestamp(value);return Number.isFinite(time)&&time>=before&&time<=after;};
 const accepted=new Set(),seen=new Set();
 for(const gate of input.gates){
  if(!object(gate)||!requiredGates.includes(gate.id)){issues.push('unknown-gate');continue;}
  if(seen.has(gate.id)){issues.push('duplicate-gate');continue;}seen.add(gate.id);
  let valid=gate.commit===input.expectedCommit&&inside(gate.observedAt)&&gate.status==='passed'&&text(gate.evidenceRef);
  if(testGates.has(gate.id))valid=valid&&validCounts(gate.counts);
  if(gate.id==='physical-ios'||gate.id==='physical-android') {
   const context=gate.context;
   const browser=gate.id==='physical-ios'?'safari':'chrome';
   valid=valid&&object(context)&&context.kind==='physical'&&context.platform===gate.id.slice(9)
    &&context.browser===browser&&text(context.browserVersion)&&text(context.osVersion);
  }
  if(gate.id==='external-deployment')valid=valid&&object(gate.context)&&gate.context.kind==='external'&&publicOrigin(gate.context.origin)&&text(gate.context.networkSource);
  if(valid)accepted.add(gate.id);else issues.push('invalid-gate-evidence');
 }
 const acceptance=input.userAcceptance;
 if(!object(acceptance)||acceptance.accepted!==true||acceptance.commit!==input.expectedCommit||!inside(acceptance.observedAt)||!text(acceptance.evidenceRef))issues.push('missing-or-invalid-user-acceptance');
 const missing=requiredGates.filter(id=>!accepted.has(id));
 return report(issues.length||missing.length?'incomplete':'ready-for-human-review',accepted.size,missing);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let input=null;
 try{if(process.argv.length===3)input=JSON.parse(readFileSync(process.argv[2],'utf8'));}catch{/* Never print supplied paths, document values, or parser errors. */}
 const result=auditAcceptanceEvidence(input);
 console.log(JSON.stringify(result,null,2));
 process.exitCode=result.status==='ready-for-human-review'?0:1;
}
