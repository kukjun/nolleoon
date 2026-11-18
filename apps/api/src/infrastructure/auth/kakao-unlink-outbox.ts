import {createHash,randomUUID} from 'node:crypto';
import {openSync,closeSync,writeFileSync,readFileSync,fsyncSync,renameSync,unlinkSync,lstatSync,realpathSync} from 'node:fs';
import {dirname,isAbsolute,resolve} from 'node:path';
import {UNLINK_RETENTION_MS,type KakaoUnlinkOutbox,type UnlinkIntent,type UnlinkJob} from '../../application/ports/kakao-unlink-outbox.js';
type Job=UnlinkJob&{leaseUntil:number};
type Event={operationId:string;action:'prepared'|'completed'|'expired';at:number;expiresAt?:number};
type Tip={sequence:number;digest:string};
type Row=Tip&{previous:string;event:Event};
const initial:Tip={sequence:0,digest:'0'.repeat(64)};
const id=(v:unknown):v is string=>typeof v==='string'&&/^[-A-Za-z0-9_]{1,100}$/.test(v);
const time=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=0;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function validateIntent(v:UnlinkIntent){if(!v||!id(v.operationId)||typeof v.subject!=='string'||v.subject.length<1||v.subject.length>200||/[\p{Cc}\p{Cf}]/u.test(v.subject)||!time(v.createdAt)||!time(v.expiresAt)||v.expiresAt!==v.createdAt+UNLINK_RETENTION_MS)throw Error('QUEUE_INVALID');}
function paths(...values:string[]){if(values.some(p=>!isAbsolute(p))||new Set(values.map(p=>resolve(p))).size!==values.length)throw Error('QUEUE_PATH');}
function regular(path:string){const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink())throw Error('QUEUE_FILE');return s;}
function syncDirectory(path:string){const fd=openSync(dirname(path),'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
function write(path:string,value:string,flag='wx'){const fd=openSync(path,flag,0o600);try{writeFileSync(fd,value);fsyncSync(fd);}finally{closeSync(fd);}}
function atomic(path:string,value:unknown){const temp=path+'.pending-'+randomUUID();try{write(temp,JSON.stringify(value));renameSync(temp,path);syncDirectory(path);}catch(error){try{unlinkSync(temp);}catch(cleanup){if((cleanup as NodeJS.ErrnoException).code!=='ENOENT')throw new AggregateError([error,cleanup],'QUEUE_WRITE_FAILED',{cause:cleanup});}throw error;}}
/** Explicit fresh setup only. Never reset missing established authority files. */
export function initializeUnlinkOutbox(pending:string,journal:string,checkpoint:string){paths(pending,journal,checkpoint);write(pending,JSON.stringify({jobs:[]}));syncDirectory(pending);write(journal,'');syncDirectory(journal);write(checkpoint,JSON.stringify(initial));syncDirectory(checkpoint);}
/** Current subjects are mutable and never enter the append-only journal or checkpoint. */
export class DurableKakaoUnlinkOutbox implements KakaoUnlinkOutbox {
 constructor(private readonly pendingPath:string,private readonly journalPath:string,private readonly checkpointPath:string){paths(pendingPath,journalPath,checkpointPath);}
 private locked<T>(work:()=>T):T{const fd=openSync(this.pendingPath+'.lock','wx',0o600);try{return work();}finally{closeSync(fd);unlinkSync(this.pendingPath+'.lock');}}
 private load(){
  const infos=[this.pendingPath,this.journalPath,this.checkpointPath].map(regular);if(new Set(infos.map(s=>s.dev+':'+s.ino)).size!==3)throw Error('QUEUE_ALIAS');
  const text=readFileSync(this.journalPath,'utf8');if(text&&!text.endsWith('\n'))throw Error('QUEUE_TRUNCATED');let tip={...initial};const rows:Row[]=[];const prepared=new Map<string,Event>(),terminal=new Set<string>();
  for(const line of text.split('\n').filter(Boolean)){
   const row=JSON.parse(line) as Row,e=row.event;
   if(!e||!id(e.operationId)||!time(e.at)||!['prepared','completed','expired'].includes(e.action)||Object.keys(e).sort().join(',')!==(e.action==='prepared'?'action,at,expiresAt,operationId':'action,at,operationId'))throw Error('QUEUE_CHAIN');
   if(row.sequence!==tip.sequence+1||row.previous!==tip.digest||row.digest!==hash({previous:tip.digest,sequence:row.sequence,event:e}))throw Error('QUEUE_CHAIN');
   if(e.action==='prepared'){if(prepared.has(e.operationId)||!time(e.expiresAt)||e.expiresAt!==e.at+UNLINK_RETENTION_MS)throw Error('QUEUE_CHAIN');prepared.set(e.operationId,e);}
   else{const original=prepared.get(e.operationId);if(!original||terminal.has(e.operationId)||e.at<original.at)throw Error('QUEUE_CHAIN');terminal.add(e.operationId);}
   rows.push(row);tip={sequence:row.sequence,digest:row.digest};
  }
  const anchor=JSON.parse(readFileSync(this.checkpointPath,'utf8')) as Tip,known=anchor.sequence===0?initial:rows[anchor.sequence-1];
  if(!time(anchor.sequence)||!known||known.digest!==anchor.digest)throw Error('QUEUE_ROLLBACK');
  // Durable journal ahead of anchor is a completed append interrupted before anchor publication.
  if(anchor.sequence!==tip.sequence)atomic(this.checkpointPath,tip);
  const state=JSON.parse(readFileSync(this.pendingPath,'utf8')) as {jobs:Job[]};if(!state||Object.keys(state).join(',')!=='jobs'||!Array.isArray(state.jobs))throw Error('QUEUE_INVALID');
  const seen=new Set<string>();for(const job of state.jobs){validateIntent(job);if(seen.has(job.operationId)||!time(job.attempts)||!time(job.nextAttemptAt)||!time(job.leaseUntil)||Object.keys(job).sort().join(',')!=='attempts,createdAt,expiresAt,leaseUntil,nextAttemptAt,operationId,subject')throw Error('QUEUE_INVALID');seen.add(job.operationId);const p=prepared.get(job.operationId);if(p&&(p.at!==job.createdAt||p.expiresAt!==job.expiresAt))throw Error('QUEUE_CONFLICT');}
  return {rows,tip,prepared,terminal,jobs:state.jobs};
 }
 private append(state:ReturnType<DurableKakaoUnlinkOutbox['load']>,event:Event){const sequence=state.tip.sequence+1,row:Row={sequence,previous:state.tip.digest,event,digest:hash({previous:state.tip.digest,sequence,event})};write(this.journalPath,JSON.stringify(row)+'\n','a');atomic(this.checkpointPath,{sequence,digest:row.digest});state.rows.push(row);state.tip={sequence,digest:row.digest};if(event.action==='prepared')state.prepared.set(event.operationId,event);else state.terminal.add(event.operationId);}
 private save(jobs:Job[]){atomic(this.pendingPath,{jobs});}
 private checked(now?:number){
  if(now!==undefined&&!time(now))throw Error('QUEUE_TIME');const s=this.load();
  if(now!==undefined)for(const j of s.jobs)if(!s.prepared.has(j.operationId)&&now>=j.expiresAt)this.append(s,{operationId:j.operationId,action:'prepared',at:j.createdAt,expiresAt:j.expiresAt});
  if(now!==undefined)for(const p of s.prepared.values())if(!s.terminal.has(p.operationId)&&now>=p.expiresAt!)this.append(s,{operationId:p.operationId,action:'expired',at:now});
  const kept=s.jobs.filter(j=>!s.terminal.has(j.operationId));if(kept.length!==s.jobs.length){this.save(kept);s.jobs=kept;}
  for(const p of s.prepared.values())if(!s.terminal.has(p.operationId)&&!s.jobs.some(j=>j.operationId===p.operationId))throw Error('QUEUE_MISSING_INTENT');
  // Pending publication before prepare journal append may survive a crash. It is not sendable yet.
  return s;
 }
 prepare(intent:UnlinkIntent):UnlinkIntent{validateIntent(intent);return this.locked(()=>{const s=this.checked();if(s.terminal.has(intent.operationId))throw Error('QUEUE_TERMINAL');let old=s.jobs.find(j=>j.operationId===intent.operationId);if(old&&old.subject!==intent.subject)throw Error('QUEUE_CONFLICT');if(!old){old={...intent,attempts:0,nextAttemptAt:intent.createdAt,leaseUntil:0};s.jobs.push(old);this.save(s.jobs);}if(!s.prepared.has(intent.operationId))this.append(s,{operationId:old.operationId,action:'prepared',at:old.createdAt,expiresAt:old.expiresAt});return {operationId:old.operationId,subject:old.subject,createdAt:old.createdAt,expiresAt:old.expiresAt};});}
 pending(subject:string,now:number):boolean{return this.locked(()=>this.checked(now).jobs.some(j=>j.subject===subject));}
 jobs(now:number):UnlinkJob[]{return this.locked(()=>(()=>{const s=this.checked(now);return s.jobs.filter(j=>s.prepared.has(j.operationId)&&j.leaseUntil<=now&&j.nextAttemptAt<=now&&j.expiresAt-now>10000);})().map(({leaseUntil:_,...j})=>{void _;return j;}));}
 claim(operationId:string,now:number):UnlinkJob|undefined{return this.locked(()=>{const s=this.checked(now),j=s.jobs.find(j=>j.operationId===operationId);if(!j||!s.prepared.has(operationId)||j.leaseUntil>now||j.nextAttemptAt>now||j.expiresAt-now<=10000)return;j.attempts++;j.leaseUntil=now+30000;this.save(s.jobs);const {leaseUntil:_,...job}=j;void _;return job;});}
 complete(operationId:string,now:number):void{this.locked(()=>{const s=this.checked(now);if(s.terminal.has(operationId))return;if(!s.prepared.has(operationId))throw Error('QUEUE_UNKNOWN');this.append(s,{operationId,action:'completed',at:now});this.save(s.jobs.filter(j=>j.operationId!==operationId));});}
 fail(operationId:string,now:number):void{this.locked(()=>{const s=this.checked(now),j=s.jobs.find(j=>j.operationId===operationId);if(!j)return;j.leaseUntil=0;j.nextAttemptAt=Math.min(j.expiresAt,now+Math.min(3600000,30000*2**Math.min(j.attempts,7)));this.save(s.jobs);});}
 expire(now:number):void{this.locked(()=>{this.checked(now);});}
 available():void{this.locked(()=>{this.checked();});}
 async withVerifiedAuthority<R>(work:(authority:Pick<DurableKakaoUnlinkOutbox,'available'|'bindingIdentity'|'witness'|'verifyPrefix'>)=>Promise<R>,now=Date.now()):Promise<R>{
  const fd=openSync(this.pendingPath+'.lock','wx',0o600);
  try{const s=this.checked(now),binding=this.bindingIdentity();const authority={available:()=>{},bindingIdentity:()=>binding,witness:()=>({...s.tip}),verifyPrefix:(expected:Tip)=>{const known=expected.sequence===0?initial:s.rows[expected.sequence-1];if(!time(expected.sequence)||!known||known.digest!==expected.digest)throw Error('QUEUE_ROLLBACK');}};return await work(authority);}
  finally{closeSync(fd);unlinkSync(this.pendingPath+'.lock');}
 }
 health(now:number):{pending:number;expired:number;completed:number}{return this.locked(()=>{const s=this.checked(now);return {pending:s.jobs.length,expired:s.rows.filter(r=>r.event.action==='expired').length,completed:s.rows.filter(r=>r.event.action==='completed').length};});}
 bindingIdentity():string{return [this.pendingPath,this.journalPath,this.checkpointPath].map(p=>realpathSync(p)).join('\0');}
 witness():Tip{return this.locked(()=>this.checked().tip);}
 verifyPrefix(expected:Tip):void{this.locked(()=>{const s=this.checked(),known=expected.sequence===0?initial:s.rows[expected.sequence-1];if(!time(expected.sequence)||!known||known.digest!==expected.digest)throw Error('QUEUE_ROLLBACK');});}
}
