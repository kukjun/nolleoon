import type {KakaoUnlink} from './ports/kakao-unlink.js';
import type {KakaoUnlinkOutbox} from './ports/kakao-unlink-outbox.js';
import {UNLINK_RETENTION_MS} from './ports/kakao-unlink-outbox.js';
import type {DeletionLedger} from './ports/account-deletion.js';
import type {Clock} from './browser-sessions.js';
/** No provider request while holding SQLite transaction; pending subject prevents rejoin. */
export class KakaoUnlinkWorker {
 private running=false;
 constructor(private readonly queue:KakaoUnlinkOutbox,private readonly ledger:DeletionLedger,private readonly clock:Clock,private readonly provider?:KakaoUnlink){}
 async sweep(){if(this.running)return;this.running=true;try{
  this.queue.available();this.queue.expire(this.clock.now());if(!this.provider)return;
  for(const candidate of this.queue.jobs(this.clock.now()).slice(0,20)){
   const now=this.clock.now();if(candidate.expiresAt-now<=10000)continue;
   const entry=this.ledger.entries().find(e=>e.operationId===candidate.operationId);if(!entry)continue;
   if(entry.createdAt!==candidate.createdAt||candidate.expiresAt!==entry.createdAt+UNLINK_RETENTION_MS)throw Error('UNLINK_INTENT_MISMATCH');
   const job=this.queue.claim(candidate.operationId,now);if(!job)continue;
   try{await this.provider.unlink(job.subject);}catch{this.queue.fail(job.operationId,this.clock.now());continue;}
   this.queue.complete(job.operationId,this.clock.now());
  }
 }finally{this.running=false;}}
}
