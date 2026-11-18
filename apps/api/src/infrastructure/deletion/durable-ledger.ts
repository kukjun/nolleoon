import {createHash,randomUUID} from 'node:crypto';
import {lstatSync,readFileSync,openSync,closeSync,writeFileSync,fsyncSync,renameSync,unlinkSync} from 'node:fs';
import {dirname,isAbsolute,resolve} from 'node:path';
export interface DeletionEntry{operationId:string;accountId:string;runIds:string[];legacyRunIds:string[];createdAt:number}
type Anchor={sequence:number;digest:string};
type Row=Anchor&{previous:string;entry:DeletionEntry};
const initial:Anchor={sequence:0,digest:'0'.repeat(64)};
const digest=(previous:string,sequence:number,entry:DeletionEntry)=>createHash('sha256').update(JSON.stringify({previous,sequence,entry})).digest('hex');
function entry(value:unknown):DeletionEntry{
 if(!value||typeof value!=='object')throw Error('LEDGER_INVALID');const v=value as Record<string,unknown>;
 const id=(x:unknown):x is string=>typeof x==='string'&&/^[-A-Za-z0-9_]{1,100}$/.test(x);
 if(Object.keys(v).sort().join(',')!=='accountId,createdAt,legacyRunIds,operationId,runIds'||!id(v.operationId)||!id(v.accountId)||!Array.isArray(v.runIds)||!v.runIds.every(id)||new Set(v.runIds).size!==v.runIds.length||!Array.isArray(v.legacyRunIds)||!v.legacyRunIds.every(id)||new Set(v.legacyRunIds).size!==v.legacyRunIds.length||!Number.isSafeInteger(v.createdAt)||(v.createdAt as number)<0)throw Error('LEDGER_INVALID');
 return {operationId:v.operationId,accountId:v.accountId,runIds:[...v.runIds],legacyRunIds:[...v.legacyRunIds],createdAt:v.createdAt as number};
}
function regular(path:string){const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink())throw Error('LEDGER_INVALID');}
function syncWrite(path:string,value:string,flags='wx'){const fd=openSync(path,flags,0o600);try{writeFileSync(fd,value);fsyncSync(fd);}finally{closeSync(fd);}}
function syncDirectory(path:string){const fd=openSync(dirname(path),'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
/** Explicit initialization only. Missing files on an established ledger MUST NOT auto-reset. */
export function initializeDeletionLedger(path:string,checkpoint:string){
 paths(path,checkpoint);syncWrite(path,'');syncDirectory(path);syncWrite(checkpoint,JSON.stringify(initial));syncDirectory(checkpoint);
}
function paths(path:string,checkpoint:string){if(!isAbsolute(path)||!isAbsolute(checkpoint)||resolve(path)===resolve(checkpoint))throw Error('LEDGER_PATH');}
export class DurableDeletionLedger{
 constructor(private readonly path:string,private readonly checkpoint:string){paths(path,checkpoint);}
 private load(recover:boolean):{rows:Row[];tip:Anchor}{
  regular(this.path);regular(this.checkpoint);
  const text=readFileSync(this.path,'utf8');if(text&&!text.endsWith('\n'))throw Error('LEDGER_TRUNCATED');
  const rows:Row[]=[];let tip={...initial};const operations=new Set<string>();
  for(const line of text.split('\n').filter(Boolean)){
   const raw=JSON.parse(line) as Row;const normalized=entry(raw.entry);
   if(raw.sequence!==tip.sequence+1||raw.previous!==tip.digest||raw.digest!==digest(tip.digest,raw.sequence,normalized)||operations.has(normalized.operationId))throw Error('LEDGER_CHAIN');
   operations.add(normalized.operationId);rows.push({...raw,entry:normalized});tip={sequence:raw.sequence,digest:raw.digest};
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
 record(value:DeletionEntry):void{
  const item=entry(value);
  this.locked(()=>{const {rows,tip}=this.load(true),old=rows.find(r=>r.entry.operationId===item.operationId);
   if(old){if(JSON.stringify(old.entry)!==JSON.stringify(item))throw Error('LEDGER_CONFLICT');return;}
   const row:Row={sequence:tip.sequence+1,previous:tip.digest,entry:item,digest:digest(tip.digest,tip.sequence+1,item)};
   syncWrite(this.path,JSON.stringify(row)+'\n','a');this.saveAnchor({sequence:row.sequence,digest:row.digest});
  });
 }
 /** Lock held across restore snapshot + deletion replay + publication: no intervening local deletion. */
 async withVerifiedEntries<T>(expected:Anchor,work:(entries:DeletionEntry[])=>Promise<T>):Promise<T>{
  const lock=this.path+'.lock',fd=openSync(lock,'wx',0o600);
  try{const {rows,tip}=this.load(false);if(expected.sequence!==tip.sequence||expected.digest!==tip.digest)throw Error('LEDGER_STALE');return await work(rows.map(r=>r.entry));}
  finally{closeSync(fd);unlinkSync(lock);}
 }
 checkpointValue():Anchor{return this.locked(()=>this.load(false).tip);}
}
