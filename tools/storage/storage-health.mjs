import {lstat,stat,statfs,realpath,readFile,readdir} from 'node:fs/promises';
import {join,isAbsolute,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {hashFile} from './daily-backup.mjs';
const owner='trip-court-daily-backup-v1';
const budgetKeys=['databaseBytes','walBytes','backupBytes','minFreeBytes'];
async function exists(path){try{await lstat(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function regular(path){const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink())throw Error('NOT_REGULAR');return s;}
/** Read-only local monitoring signal; never certifies SQLite recovery or authoritative journal freshness. */
export async function storageHealth({source,directory,budgets,now=Date.now()}){
 if(!isAbsolute(source)||!isAbsolute(directory)||!Number.isSafeInteger(now)||now<0||!budgets||budgetKeys.some(k=>!Number.isSafeInteger(budgets[k])||budgets[k]<=0))throw Error('INVALID_INPUT');
 const problems=[];const add=code=>{if(!problems.includes(code))problems.push(code);};
 const result={status:'degraded',problems,backupAgeMs:null,databaseBytes:null,walBytes:null,backupBytes:null,freeBytes:null,hardLimitEnforced:false,restoreFreshnessVerified:false};
 try{
  const root=await realpath(directory),src=await realpath(source),info=await stat(src);
  if(!info.isFile()||src.startsWith(root+'/'))throw Error('SOURCE_INVALID');
  result.databaseBytes=info.size;
  result.walBytes=await exists(src+'-wal')?(await regular(src+'-wal')).size:0;
  if(await exists(join(root,'.daily-lock')))add('BACKUP_BUSY');
  try{
   const path=join(root,'.source-binding.json');await regular(path);const b=JSON.parse(await readFile(path,'utf8'));
   if(b.owner!==owner||b.sourcePath!==src||b.device!==info.dev||b.inode!==info.ino)throw Error('BINDING');
  }catch{add('SOURCE_BINDING_INVALID');}
  const entries=await readdir(root);if(entries.length>10000)throw Error('DIRECTORY_TOO_LARGE');
  let bytes=0;const snapshots=[];
  for(const name of entries){
   if(!/^trip-\d{4}-\d{2}-\d{2}\.sqlite(?:\.json)?$/.test(name))continue;
   try{bytes+=(await regular(join(root,name))).size;}catch{add('BACKUP_INVALID');continue;}
   if(!name.endsWith('.sqlite')){if(!await exists(join(root,name.slice(0,-5))))add('BACKUP_INVALID');continue;}
   try{
    const path=join(root,name+'.json');await regular(path);const m=JSON.parse(await readFile(path,'utf8'));
    const stamp=Date.parse(name.slice(5,15)+'T00:00:00Z');
    if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==name.slice(5,15)||m.owner!==owner||m.name!==name||m.day!==name.slice(5,15)||m.sha256!==await hashFile(join(root,name)))throw Error('MANIFEST');
    snapshots.push(m);
   }catch{add('BACKUP_INVALID');}
  }
  result.backupBytes=bytes;
  snapshots.sort((a,b)=>b.day.localeCompare(a.day));
  if(!snapshots.length)add('BACKUP_MISSING');
  else{
   const latest=snapshots[0];
   if(latest.createdAt===undefined)add('BACKUP_TIME_UNKNOWN');
   else if(!Number.isSafeInteger(latest.createdAt)||latest.createdAt<0||latest.createdAt>now||new Date(latest.createdAt).toISOString().slice(0,10)!==latest.day)add('BACKUP_TIME_INVALID');
   else{result.backupAgeMs=now-latest.createdAt;if(result.backupAgeMs>86400000)add('BACKUP_STALE');}
  }
  // Both source and backup volumes need headroom. This is observation, not a reservation.
  const volumes=await Promise.all([statfs(src),statfs(root)]);result.freeBytes=Math.min(...volumes.map(s=>s.bavail*s.bsize));
  if(result.databaseBytes>budgets.databaseBytes)add('DATABASE_BUDGET');
  if(result.walBytes>budgets.walBytes)add('WAL_BUDGET');
  if(result.backupBytes>budgets.backupBytes)add('BACKUP_BUDGET');
  if(result.freeBytes<budgets.minFreeBytes)add('FREE_SPACE_LOW');
  if(await exists(join(root,'.daily-lock')))add('BACKUP_BUSY');
 }catch{add('INSPECTION_FAILED');}
 result.status=problems.length?'degraded':'healthy';return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [source,directory,config,...extra]=process.argv.slice(2);if(!config||extra.length)throw Error('ARGS');
  const result=await storageHealth({source,directory,budgets:JSON.parse(await readFile(config,'utf8'))});console.log(JSON.stringify(result));if(result.status!=='healthy')process.exitCode=2;
 }catch{console.error('STORAGE_HEALTH_FAILED: 경로와 명시적 용량 예산을 확인하세요. 파일은 변경하지 않았습니다.');process.exitCode=1;}
}
