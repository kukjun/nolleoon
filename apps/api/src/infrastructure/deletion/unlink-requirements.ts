import {createHash} from 'node:crypto';import type Database from 'better-sqlite3';import type {KakaoUnlinkOutbox} from '../../application/ports/kakao-unlink-outbox.js';
/** No provider subject or hash enters SQLite/backup. Only current-authority path and opaque log head. */
export class UnlinkRequirements {
 constructor(private readonly db:Database.Database){}
 check(queue?:Pick<KakaoUnlinkOutbox,'available'|'bindingIdentity'|'witness'|'verifyPrefix'>,required=false){
  if(this.db.inTransaction)throw Error('UNLINK_REQUIREMENTS_NESTED');
  const old=this.db.prepare('SELECT binding_hash binding,known_sequence sequence,known_digest digest FROM unlink_queue_requirement WHERE id=1').get() as {binding:string;sequence:number;digest:string}|undefined;
  if(!queue){if(required||old)throw Error('UNLINK_QUEUE_REQUIRED');return;}
  queue.available();const binding=createHash('sha256').update(queue.bindingIdentity?.()??'explicit-application-injected-queue').digest('hex');
  if(old){if(old.binding!==binding)throw Error('UNLINK_QUEUE_BINDING');if(queue.verifyPrefix)queue.verifyPrefix(old);else if(old.sequence!==0)throw Error('UNLINK_QUEUE_WITNESS_REQUIRED');}
  const witness=queue.witness?.()??{sequence:0,digest:'synthetic-injected'};
  if(!Number.isSafeInteger(witness.sequence)||witness.sequence<0||typeof witness.digest!=='string'||!witness.digest)throw Error('UNLINK_QUEUE_WITNESS_INVALID');
  this.db.prepare('INSERT INTO unlink_queue_requirement VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET known_sequence=excluded.known_sequence,known_digest=excluded.known_digest').run(binding,witness.sequence,witness.digest);
 }
}
