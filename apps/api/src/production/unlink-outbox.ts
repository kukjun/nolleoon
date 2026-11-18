import {existsSync,lstatSync,realpathSync} from 'node:fs';
import {basename,dirname,isAbsolute,join,relative,sep} from 'node:path';
import {DurableKakaoUnlinkOutbox} from '../infrastructure/auth/kakao-unlink-outbox.js';
const within=(root:string,path:string)=>{const r=relative(root,path);return r===''||r!=='..'&&!r.startsWith('..'+sep)&&!isAbsolute(r);};
/** Current authority must be provisioned explicitly outside DB backups/static roots. Never creates files. */
export function unlinkOutbox(env:NodeJS.ProcessEnv,dbPath:string,providerConfigured:boolean,now=Date.now()){
 const values=[env.KAKAO_UNLINK_PENDING_PATH,env.KAKAO_UNLINK_JOURNAL_PATH,env.KAKAO_UNLINK_CHECKPOINT_PATH];
 if(!values.some(Boolean)){if(providerConfigured)throw Error('UNLINK_QUEUE_REQUIRED');return {};}
 if(!values.every(v=>v&&isAbsolute(v)))throw Error('UNLINK_QUEUE_CONFIGURATION');
 const paths=values as string[],database=existsSync(dbPath)?realpathSync(dbPath):join(realpathSync(dirname(dbPath)),basename(dbPath));
 const protectedPaths=[database,...['-wal','-shm','-journal'].map(s=>database+s),env.DELETION_LEDGER_PATH,env.DELETION_LEDGER_CHECKPOINT,env.ROOM_DELETION_LEDGER_PATH,env.ROOM_DELETION_LEDGER_CHECKPOINT].filter((p):p is string=>Boolean(p));
 const protectedInodes=new Set(protectedPaths.filter(existsSync).map(p=>{const s=lstatSync(p);return `${s.dev}:${s.ino}`;}));
 const roots=[env.WEB_ROOT,env.DAILY_BACKUP_DIRECTORY].filter((p):p is string=>Boolean(p)).map(p=>realpathSync(p));
 const seen=new Set<string>();for(const p of paths){const s=lstatSync(p);const inode=`${s.dev}:${s.ino}`,real=realpathSync(p);if(!s.isFile()||s.isSymbolicLink()||seen.has(inode)||protectedInodes.has(inode)||protectedPaths.includes(real)||roots.some(root=>within(root,real)))throw Error('UNLINK_QUEUE_PATH');seen.add(inode);}
 const kakaoUnlinkOutbox=new DurableKakaoUnlinkOutbox(...paths as [string,string,string]);kakaoUnlinkOutbox.expire(now);kakaoUnlinkOutbox.available();
 return {kakaoUnlinkOutbox,unlinkRequired:true as const};
}
