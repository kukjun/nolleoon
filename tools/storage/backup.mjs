import {readFile} from 'node:fs/promises';
import {backupDatabase,restoreDatabase} from '../../apps/api/dist/infrastructure/sqlite/backup.js';
import {DurableDeletionLedger,DurableRoomDeletionLedger} from '../../apps/api/dist/infrastructure/deletion/durable-ledger.js';
const [command,source,destination,control,...extra]=process.argv.slice(2);
try{
 if(!['backup','restore'].includes(command)||!source||!destination||extra.length||(command==='backup'&&control)||(command==='restore'&&!control))throw Error('ARGS');
 if(command==='backup')await backupDatabase(source,destination);
 else{
  const c=JSON.parse(await readFile(control,'utf8'));
  await restoreDatabase(source,destination,{account:{journal:new DurableDeletionLedger(c.account.path,c.account.checkpointPath),checkpoint:c.account.expected},rooms:{journal:new DurableRoomDeletionLedger(c.rooms.path,c.rooms.checkpointPath),checkpoint:c.rooms.expected}});
 }
 console.log('검증된 새 DB 파일을 생성했습니다. 실행 중인 서버의 DB 경로는 변경하지 않았습니다.');
}catch{console.error('BACKUP_FAILED: 경로·DB·authoritative 삭제 ledger/checkpoint를 확인하세요. 원본과 기존 대상은 덮어쓰지 않습니다.');process.exitCode=1;}
