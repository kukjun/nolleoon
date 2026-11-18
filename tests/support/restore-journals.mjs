import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';import {dirname,join} from 'node:path';
import {DurableDeletionLedger,DurableRoomDeletionLedger,initializeDeletionLedger} from '../../apps/api/dist/infrastructure/deletion/durable-ledger.js';
import {restoreDatabase} from '../../apps/api/dist/infrastructure/sqlite/backup.js';
/** Synthetic fixtures explicitly attest no historical account/room deletions. Never production defaults. */
export function emptyRestoreJournals(directory){
 const accountPath=join(directory,'account-ledger'),accountCheckpoint=join(directory,'account-checkpoint'),roomPath=join(directory,'room-ledger'),roomCheckpoint=join(directory,'room-checkpoint');
 initializeDeletionLedger(accountPath,accountCheckpoint);initializeDeletionLedger(roomPath,roomCheckpoint);
 const account=new DurableDeletionLedger(accountPath,accountCheckpoint),rooms=new DurableRoomDeletionLedger(roomPath,roomCheckpoint);
 const config={account:{path:accountPath,checkpointPath:accountCheckpoint,expected:account.checkpointValue()},rooms:{path:roomPath,checkpointPath:roomCheckpoint,expected:rooms.checkpointValue()}};
 const control=join(directory,'restore-control.json');writeFileSync(control,JSON.stringify(config));
 return {options:{account:{journal:account,checkpoint:account.checkpointValue()},rooms:{journal:rooms,checkpoint:rooms.checkpointValue()}},control};
}
export async function restoreWithEmptyJournals(source,destination){const dir=mkdtempSync(join(dirname(destination),'.synthetic-empty-journals-'));try{return await restoreDatabase(source,destination,emptyRestoreJournals(dir).options);}finally{rmSync(dir,{recursive:true,force:true});}}
