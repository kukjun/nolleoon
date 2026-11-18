import {createHash,randomUUID} from 'node:crypto';
import {lstatSync,readFileSync,openSync,closeSync,writeFileSync,fsyncSync,renameSync,unlinkSync} from 'node:fs';
import {dirname,isAbsolute,resolve} from 'node:path';
export interface DeletionEntry{operationId:string;accountId:string;runIds:string[];legacyRunIds:string[];legacyProofs:{runId:string;sessionId:string}[];createdAt:number}
type Anchor={sequence:number;digest:string};
type Row<T>=Anchor&{previous:string;entry:T};
const initial:Anchor={sequence:0,digest:'0'.repeat(64)};
const digest=(previous:string,sequence:number,entry:unknown)=>createHash('sha256').update(JSON.stringify({previous,sequence,entry})).digest('hex');
function entry(value:unknown):DeletionEntry{
 if(!value||typeof value!=='object')throw Error('LEDGER_INVALID');const v=value as Record<string,unknown>;
 const id=(x:unknown):x is string=>typeof x==='string'&&/^[-A-Za-z0-9_]{1,100}$/.test(x);
 if(Object.keys(v).sort().join(',')!=='accountId,createdAt,legacyProofs,legacyRunIds,operationId,runIds'||!id(v.operationId)||!id(v.accountId)||!Array.isArray(v.runIds)||!v.runIds.every(id)||new Set(v.runIds).size!==v.runIds.length||!Array.isArray(v.legacyRunIds)||!v.legacyRunIds.every(id)||new Set(v.legacyRunIds).size!==v.legacyRunIds.length||!Number.isSafeInteger(v.createdAt)||(v.createdAt as number)<0)throw Error('LEDGER_INVALID');
 if(!Array.isArray(v.legacyProofs)||!v.legacyProofs.every(p=>p&&typeof p==='object'&&Object.keys(p).sort().join(',')==='runId,sessionId'&&id(p.runId)&&id(p.sessionId)&&(v.legacyRunIds as string[]).includes(p.runId))||new Set(v.legacyProofs.map(p=>p.runId+'|'+p.sessionId)).size!==v.legacyProofs.length)throw Error('LEDGER_INVALID');
 return {operationId:v.operationId,accountId:v.accountId,runIds:[...v.runIds],legacyRunIds:[...v.legacyRunIds],legacyProofs:v.legacyProofs.map(p=>({runId:p.runId,sessionId:p.sessionId})),createdAt:v.createdAt as number};
}
function regular(path:string){const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink())throw Error('LEDGER_INVALID');}
function syncWrite(path:string,value:string,flags='wx'){const fd=openSync(path,flags,0o600);try{writeFileSync(fd,value);fsyncSync(fd);}finally{closeSync(fd);}}
function syncDirectory(path:string){const fd=openSync(dirname(path),'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
/** Explicit initialization only. Missing files on an established ledger MUST NOT auto-reset. */
export function initializeDeletionLedger(path:string,checkpoint:string){
 paths(path,checkpoint);syncWrite(path,'');syncDirectory(path);syncWrite(checkpoint,JSON.stringify(initial));syncDirectory(checkpoint);
}
function paths(path:string,checkpoint:string){if(!isAbsolute(path)||!isAbsolute(checkpoint)||resolve(path)===resolve(checkpoint))throw Error('LEDGER_PATH');}
class DurableJournal<T>{
 constructor(private readonly path:string,private readonly checkpoint:string,private readonly normalize:(value:unknown)=>T){paths(path,checkpoint);}
 private load(recover:boolean):{rows:Row<T>[];tip:Anchor}{
  regular(this.path);regular(this.checkpoint);
  const text=readFileSync(this.path,'utf8');if(text&&!text.endsWith('\n'))throw Error('LEDGER_TRUNCATED');
  const rows:Row<T>[]=[];let tip={...initial};const operations=new Set<string>();
  for(const line of text.split('\n').filter(Boolean)){
   const raw=JSON.parse(line) as Row<T>;const normalized=this.normalize(raw.entry);
   if(raw.sequence!==tip.sequence+1||raw.previous!==tip.digest||raw.digest!==digest(tip.digest,raw.sequence,normalized)||operations.has((normalized as {operationId:string}).operationId))throw Error('LEDGER_CHAIN');
   operations.add((normalized as {operationId:string}).operationId);rows.push({...raw,entry:normalized});tip={sequence:raw.sequence,digest:raw.digest};
  }
  const anchor=JSON.parse(readFileSync(this.checkpoint,'utf8')) as Anchor;
  const known=anchor.sequence===0?initial:rows[anchor.sequence-1];
  if(!Number.isSafeInteger(anchor.sequence)||anchor.sequence<0||!known||known.digest!==anchor.digest)throw Error('LEDGER_ROLLBACK');
  if(anchor.sequence!==tip.sequence){if(!recover)throw Error('LEDGER_CHECKPOINT_PENDING');this.saveAnchor(tip);}
  return {rows,tip};
 }
 private saveAnchor(anchor:Anchor){const temp=this.checkpoint+'.pending-'+randomUUID();syncWrite(temp,JSON.stringify(anchor));renameSync(temp,this.checkpoint);syncDirectory(this.checkpoint);}
 private locked<T>(work:()=>T):T{const lock=this.path+'.lock';const fd=openSync(lock,'wx',0o600);try{return work();}finally{closeSync(fd);unlinkSync(lock);}}
 /** Called synchronously before SQL deletion. Durable extra entry after SQL rollback is intentional. */
 record(value:T):T{
  const item=this.normalize(value);
  return this.locked(()=>{const {rows,tip}=this.load(true),old=rows.find(r=>(r.entry as {operationId:string}).operationId===(item as {operationId:string}).operationId);
   if(old){const omitTime=(x:T)=>{const copy={...(x as Record<string,unknown>)};delete copy.createdAt;return copy;};if(JSON.stringify(omitTime(old.entry))!==JSON.stringify(omitTime(item)))throw Error('LEDGER_CONFLICT');return old.entry;}
   const row:Row<T>={sequence:tip.sequence+1,previous:tip.digest,entry:item,digest:digest(tip.digest,tip.sequence+1,item)};
   syncWrite(this.path,JSON.stringify(row)+'\n','a');this.saveAnchor({sequence:row.sequence,digest:row.digest});return item;
  });
 }
 /** Lock held across restore snapshot + deletion replay + publication: no intervening local deletion. */
 async withVerifiedEntries<R>(expected:Anchor,work:(entries:T[])=>Promise<R>):Promise<R>{
  const lock=this.path+'.lock',fd=openSync(lock,'wx',0o600);
  try{const {rows,tip}=this.load(false);if(expected.sequence!==tip.sequence||expected.digest!==tip.digest)throw Error('LEDGER_STALE');return await work(rows.map(r=>r.entry));}
  finally{closeSync(fd);unlinkSync(lock);}
 }
 entries():T[]{return this.locked(()=>this.load(false).rows.map(row=>row.entry));}
 lookup(operationId:string):T|undefined{return this.entries().find(item=>(item as {operationId:string}).operationId===operationId);}
 checkpointValue():Anchor{return this.locked(()=>this.load(false).tip);}
}

export class DurableDeletionLedger extends DurableJournal<DeletionEntry>{constructor(path:string,checkpoint:string){super(path,checkpoint,entry);}}
export interface RoomDeletionEntry{operationId:string;roomId:string;action:'delete'|'restore'|'purge';at:number;deletionVersion:number;deletedAt?:number;purgeAfter?:number;previousStatus?:'open'|'closed';administratorAccountId?:string}
function roomEntry(value:unknown):RoomDeletionEntry{
 if(!value||typeof value!=='object')throw Error('LEDGER_INVALID');const v=value as RoomDeletionEntry;
 const id=(x:unknown)=>typeof x==='string'&&/^[-A-Za-z0-9_]{1,100}$/.test(x);
 const time=(x:unknown)=>Number.isSafeInteger(x)&&(x as number)>=0;
 const keys=v.action==='delete'?'action,administratorAccountId,at,deletedAt,deletionVersion,operationId,previousStatus,purgeAfter,roomId':'action,at,deletionVersion,operationId,roomId';
 if(Object.keys(v).sort().join(',')!==keys||!id(v.operationId)||!id(v.roomId)||!['delete','restore','purge'].includes(v.action)||!time(v.at)||!time(v.deletionVersion)||v.deletionVersion<1)throw Error('LEDGER_INVALID');
 if(v.action==='delete'&&(!time(v.deletedAt)||!time(v.purgeAfter)||v.purgeAfter!==v.deletedAt!+7*86400000||!id(v.administratorAccountId)||!['open','closed'].includes(v.previousStatus!)))throw Error('LEDGER_INVALID');
 return {...v};
}
export class DurableRoomDeletionLedger extends DurableJournal<RoomDeletionEntry>{constructor(path:string,checkpoint:string){super(path,checkpoint,roomEntry);}}
