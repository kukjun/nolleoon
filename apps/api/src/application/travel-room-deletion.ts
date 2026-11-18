import type {RoomDeletionEntry,RoomDeletionLedger} from './ports/room-deletion.js';
import {DomainFailure} from '../domain/failure.js';
import type {UnitOfWork,Repositories} from './ports/storage.js';
import type {Clock} from './browser-sessions.js';
import {account,membership,requireAdmin,travelInput,requestId,checkVersion,travelSnapshot} from './travel-rooms.js';
export const ROOM_DELETION_GRACE_MS=604800000;
/** Replays verified events only. Does not recreate accounts, memberships or absent rooms. */
export function applyRoomDeletionEvent(r:Repositories,e:RoomDeletionEntry):void {
 if(r.travel.deletionEventApplied(e.operationId))return;
 const room=r.travel.rawRoom(e.roomId),pending=r.travel.deletion(e.roomId);
 if(room){
  if(e.action==='delete'){
   if(e.deletedAt===undefined||e.purgeAfter===undefined||!e.previousStatus||!e.administratorAccountId)throw new DomainFailure('INVALID_INPUT');
   if(pending)r.travel.restoreDeleted(e.roomId);
   r.travel.markDeleted({roomId:e.roomId,deletedAt:e.deletedAt,purgeAfter:e.purgeAfter,previousStatus:e.previousStatus,administratorAccountId:e.administratorAccountId,deletionVersion:e.deletionVersion});
   r.travel.revokeInvites(e.roomId,e.at);r.travel.saveRoom({...room,version:Math.max(room.version,e.deletionVersion)});
  }else if(e.action==='restore'){
   if(pending?.deletionVersion===e.deletionVersion){r.travel.restoreDeleted(e.roomId);r.travel.saveRoom({...room,status:pending.previousStatus,version:Math.max(room.version,e.deletionVersion+1)});}
  }else r.travel.purgeDeleted(e.roomId);
 }
 r.travel.recordDeletionEvent(e.operationId);
}
export class TravelRoomDeletion {
 constructor(private readonly uow:UnitOfWork,private readonly clock:Clock,private readonly ledger?:RoomDeletionLedger){}
 reconcile(){try{if(this.ledger)for(const event of this.ledger.entries())this.uow.run(r=>applyRoomDeletionEvent(r,event));}catch{throw new DomainFailure('TEMPORARILY_UNAVAILABLE');}}
 private journal(){if(!this.ledger)throw new DomainFailure('TEMPORARILY_UNAVAILABLE');return this.ledger;}
 request(actor:string,roomId:string,input:unknown){
  const v=travelInput(input,['requestId','expectedVersion','confirmation']);requestId(v.requestId);
  if(v.confirmation!=='DELETE_ROOM')throw new DomainFailure('INVALID_INPUT');
  this.reconcile();const ledger=this.journal(),now=this.clock.now(),intent=JSON.stringify(['delete-room',roomId,v]);
  return this.uow.run(r=>{
   account(r,actor);const old=r.travel.receipt(actor,v.requestId as string),pending=r.travel.deletion(roomId);
   if(old){if(old.intent!==intent||!pending||pending.administratorAccountId!==actor)throw new DomainFailure('STATE_CONFLICT');return{roomId,deletionVersion:pending.deletionVersion,deletedAt:pending.deletedAt,purgeAfter:pending.purgeAfter};}
   const durable=ledger.lookup(`${roomId}-${Number(v.expectedVersion)+1}-delete`);
   if(durable&&pending&&durable.administratorAccountId===actor&&pending.deletionVersion===durable.deletionVersion)return{roomId,deletionVersion:pending.deletionVersion,deletedAt:pending.deletedAt,purgeAfter:pending.purgeAfter};
   const {room,self}=membership(r,actor,roomId);requireAdmin(room,self);checkVersion(room,v.expectedVersion);
   if(r.travel.currentRun(roomId))throw new DomainFailure('STATE_CONFLICT');
   const result={roomId,deletionVersion:room.version+1,deletedAt:now,purgeAfter:now+ROOM_DELETION_GRACE_MS};
   const operationId=`${roomId}-${result.deletionVersion}-delete`;
   const event=ledger.lookup(operationId)??ledger.record({operationId,action:'delete',at:now,...result,previousStatus:room.status,administratorAccountId:actor});
   applyRoomDeletionEvent(r,event);
   r.travel.insertReceipt(actor,v.requestId as string,intent,JSON.stringify(result),now);return result;
  });
 }
 list(actor:string){this.reconcile();const now=this.clock.now();return this.uow.run(r=>{account(r,actor);return{items:r.travel.deletedRooms(actor).filter(d=>now<d.purgeAfter).map(({roomId,title,deletionVersion,deletedAt,purgeAfter,previousStatus})=>({roomId,title,deletionVersion,deletedAt,purgeAfter,previousStatus}))};});}
 restore(actor:string,roomId:string,input:unknown){
  const v=travelInput(input,['requestId','deletedAt','deletionVersion']);requestId(v.requestId);if(!Number.isSafeInteger(v.deletionVersion)||Number(v.deletionVersion)<1||!Number.isSafeInteger(v.deletedAt)||Number(v.deletedAt)<0)throw new DomainFailure('INVALID_INPUT');
  this.reconcile();const ledger=this.journal(),now=this.clock.now(),intent=JSON.stringify(['restore-room',roomId,v]);
  return this.uow.run(r=>{
   account(r,actor);const old=r.travel.receipt(actor,v.requestId as string);
   if(old){if(old.intent!==intent)throw new DomainFailure('STATE_CONFLICT');const {room,self}=membership(r,actor,roomId);requireAdmin(room,self);return travelSnapshot(r,actor,roomId,now);}
   const durable=ledger.lookup(`${roomId}-${v.deletionVersion}-restore`);
   if(durable){if(r.travel.deletion(roomId))throw new DomainFailure('STATE_CONFLICT');const {room,self}=membership(r,actor,roomId);requireAdmin(room,self);return travelSnapshot(r,actor,roomId,now);}
   const d=r.travel.deletion(roomId),room=r.travel.rawRoom(roomId),self=r.travel.membership(roomId,actor);
   if(!d||!room||now>=d.purgeAfter)throw new DomainFailure('NOT_FOUND');
   if(d.administratorAccountId!==actor||!self||self.leftAt!==null)throw new DomainFailure('FORBIDDEN');requireAdmin(room,self);
   if(d.deletedAt!==v.deletedAt||d.deletionVersion!==v.deletionVersion)throw new DomainFailure('STATE_CONFLICT');
   const operationId=`${roomId}-${d.deletionVersion}-restore`;
   const event=ledger.lookup(operationId)??ledger.record({operationId,roomId,action:'restore',at:now,deletionVersion:d.deletionVersion});applyRoomDeletionEvent(r,event);
   r.travel.insertReceipt(actor,v.requestId as string,intent,JSON.stringify({roomId}),now);return travelSnapshot(r,actor,roomId,now);
  });
 }
 sweep(){if(!this.ledger)return{processed:0};for(const event of this.ledger.entries())this.uow.run(r=>applyRoomDeletionEvent(r,event));const now=this.clock.now();const ids=this.uow.run(r=>r.travel.dueDeletions(now,100));for(const id of ids)this.purgeExpired(id);return{processed:ids.length};}
 // Internal maintenance only. Never accepts a client supplied clock or bypasses the grace period.
 purgeExpired(roomId:string){const now=this.clock.now();return this.uow.run(r=>{const d=r.travel.deletion(roomId);if(!d||now<d.purgeAfter)return{purged:false};const ledger=this.journal(),operationId=`${roomId}-${d.deletionVersion}-purge`;const event=ledger.lookup(operationId)??ledger.record({operationId,roomId,action:'purge',at:now,deletionVersion:d.deletionVersion});applyRoomDeletionEvent(r,event);return{purged:true};});}
}
