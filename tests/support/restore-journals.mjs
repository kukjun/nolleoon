import {mkdirSync,existsSync,writeFileSync} from 'node:fs';import {dirname,join} from 'node:path';
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
export function fixtureRestoreEnvironment(destination){const dir=join(dirname(destination),'.synthetic-empty-journals');return {DELETION_LEDGER_PATH:join(dir,'account-ledger'),DELETION_LEDGER_CHECKPOINT:join(dir,'account-checkpoint'),ROOM_DELETION_LEDGER_PATH:join(dir,'room-ledger'),ROOM_DELETION_LEDGER_CHECKPOINT:join(dir,'room-checkpoint')};}
export async function restoreWithEmptyJournals(source,destination){
 // The enclosing test owns and removes dirname(destination), including these journals.
 const dir=join(dirname(destination),'.synthetic-empty-journals');let options;
 if(!existsSync(dir)){mkdirSync(dir);options=emptyRestoreJournals(dir).options;}
 else{const account=new DurableDeletionLedger(join(dir,'account-ledger'),join(dir,'account-checkpoint')),rooms=new DurableRoomDeletionLedger(join(dir,'room-ledger'),join(dir,'room-checkpoint'));options={account:{journal:account,checkpoint:account.checkpointValue()},rooms:{journal:rooms,checkpoint:rooms.checkpointValue()}};}
 return restoreDatabase(source,destination,options);
}
