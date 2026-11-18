import {lstat,readFile,writeFile,unlink,open,readdir} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {pathToFileURL} from 'node:url';
const owner='trip-court-daily-backup-v1';
export async function hashFile(path){const hash=createHash('sha256');for await(const chunk of createReadStream(path,{highWaterMark:64*1024}))hash.update(chunk);return hash.digest('hex');}
const day=now=>new Date(now).toISOString().slice(0,10);
/** Explicit operator invocation only. No scheduler installation, no production defaults. */
export async function dailyBackup({source,directory,now=Date.now(),prune=false,backup}){
 if(!isAbsolute(source)||!isAbsolute(directory)||!Number.isSafeInteger(now)||now<0)throw Error('INVALID_INPUT');
 const root=resolve(directory);if(!(await lstat(root)).isDirectory()||(await lstat(root)).isSymbolicLink())throw Error('INVALID_DIRECTORY');
 const lock=await open(join(root,'.daily-lock'),'wx',0o600);
 try{
  const today=day(now),name=`trip-${today}.sqlite`,target=join(root,name),manifest=target+'.json';
  let existing=false;
  try{await lstat(target);existing=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  if(existing){await verified(root,name);}else{
   // The online backup function refuses existing destinations and verifies DB/schema.
   await backup(source,target);
   await writeFile(manifest,JSON.stringify({owner,name,day:today,sha256:await hashFile(target)}),{flag:'wx',mode:0o600});
  }
  const candidates=[];
  for(const entry of await readdir(root)){
   if(!/^trip-\d{4}-\d{2}-\d{2}\.sqlite$/.test(entry))continue;
   const date=entry.slice(5,15),stamp=Date.parse(date+'T00:00:00Z');
   if(!Number.isFinite(stamp)||day(stamp)!==date||date>=day(Date.parse(today+'T00:00:00Z')-6*86400000))continue;
   await verified(root,entry);candidates.push(entry);
  }
  candidates.sort();
  // Default is a retention PLAN. Operator must explicitly authorize pruning managed copies.
  if(prune)for(const entry of candidates){await verified(root,entry);await unlink(join(root,entry));await unlink(join(root,entry+'.json'));}
  return {created:!existing,day:today,retentionCandidates:candidates,pruned:prune?candidates.length:0};
 }finally{await lock.close();await unlink(join(root,'.daily-lock'));}
}
async function verified(root,name){
 const file=join(root,name),meta=file+'.json';
 for(const path of [file,meta]){const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink())throw Error('UNMANAGED_FILE');}
 const record=JSON.parse(await readFile(meta,'utf8'));
 if(record.owner!==owner||record.name!==name||record.day!==name.slice(5,15)||record.sha256!==await hashFile(file))throw Error('UNMANAGED_FILE');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [source,directory,flag,...extra]=process.argv.slice(2);
 try{
  if(extra.length||(flag!==undefined&&flag!=='--prune-managed'))throw Error('ARGS');
  const {backupDatabase}=await import('../../apps/api/dist/infrastructure/sqlite/backup.js');
  const result=await dailyBackup({source,directory,prune:flag==='--prune-managed',backup:backupDatabase});
  console.log(JSON.stringify(result));
 }catch{console.error('DAILY_BACKUP_FAILED: 입력·관리 파일·잠금·DB 검증을 확인하세요. 스케줄은 설치하지 않았습니다.');process.exitCode=1;}
}
