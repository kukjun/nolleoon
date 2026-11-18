import {existsSync,lstatSync,realpathSync} from 'node:fs';
import {basename,dirname,isAbsolute,join,relative,sep} from 'node:path';
import {DurableDeletionLedger,DurableRoomDeletionLedger} from '../infrastructure/deletion/durable-ledger.js';
function within(root:string,path:string){const rel=relative(root,path);return rel===''||(!rel.startsWith(`..${sep}`)&&rel!=='..'&&!isAbsolute(rel));}
/** Explicit existing private files only. Never initialize, disclose or serve journal contents. */
export function privacyLedgers(env:NodeJS.ProcessEnv,dbPath:string){
 const account=[env.DELETION_LEDGER_PATH,env.DELETION_LEDGER_CHECKPOINT],room=[env.ROOM_DELETION_LEDGER_PATH,env.ROOM_DELETION_LEDGER_CHECKPOINT];
 if(account.some(Boolean)&&!account.every(Boolean)||room.some(Boolean)&&!room.every(Boolean))throw Error('Incomplete privacy ledger configuration');
 const paths=[...account,...room].filter((p):p is string=>p!==undefined&&p!=='');
 const database=existsSync(dbPath)?realpathSync(dbPath):join(realpathSync(dirname(dbPath)),basename(dbPath));
 const web=env.WEB_ROOT?realpathSync(env.WEB_ROOT):undefined,seen=new Set<string>(),inodes=new Set<string>();
 const databaseFiles=[database,database+'-wal',database+'-shm',database+'-journal'];
 const databaseInodes=new Set(databaseFiles.filter(existsSync).map(path=>{const s=lstatSync(path);return `${s.dev}:${s.ino}`;}));
 for(const path of paths){if(!isAbsolute(path))throw Error('Invalid privacy ledger path');const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Invalid privacy ledger file');const real=realpathSync(path),inode=`${stat.dev}:${stat.ino}`;
  if(seen.has(real)||inodes.has(inode)||databaseInodes.has(inode)||databaseFiles.includes(real)||web&&within(web,real))throw Error('Overlapping privacy storage');seen.add(real);inodes.add(inode);
 }
 return{deletionLedger:account[0]&&account[1]?new DurableDeletionLedger(account[0],account[1]):undefined,roomDeletionLedger:room[0]&&room[1]?new DurableRoomDeletionLedger(room[0],room[1]):undefined};
}
