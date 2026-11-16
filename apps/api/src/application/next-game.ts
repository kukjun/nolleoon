import type {UnitOfWork} from './ports/storage.js';
import type {Clock} from './browser-sessions.js';
import type {RandomSource} from './ports/random.js';
import {maintainBeforeRequest} from './membership-lifecycle.js';
import {DomainFailure} from '../domain/failure.js';

export class NextGame {
 constructor(private readonly uow:UnitOfWork,private readonly clock:Clock,private readonly random:RandomSource){}
 execute(actor:{id:string},code:string,value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new DomainFailure('INVALID_INPUT');
  const input=value as Record<string,unknown>;
  if(Object.keys(input).sort().join(',')!=='expectedPreparationVersion,fromGameId,requestId'
   ||typeof input.requestId!=='string'||!/^[-a-zA-Z0-9_]{16,100}$/.test(input.requestId)
   ||typeof input.fromGameId!=='string'||!input.fromGameId||input.fromGameId.length>100
   ||!Number.isSafeInteger(input.expectedPreparationVersion)||Number(input.expectedPreparationVersion)<0)throw new DomainFailure('INVALID_INPUT');
  const requestId=input.requestId,fromGameId=input.fromGameId,expectedPreparationVersion=input.expectedPreparationVersion as number;
  const now=this.clock.now();maintainBeforeRequest(this.uow,now,this.random);
  return this.uow.run(r=>{
   const room=r.rooms.findByInvite(code);if(!room)throw new DomainFailure('NOT_FOUND');
   const previous=r.nextPreparations.find(room.id,requestId);
   if(previous){
    if(previous.actorSessionId!==actor.id)throw new DomainFailure('FORBIDDEN');
    if(previous.fromGameId!==fromGameId||previous.expectedPreparationVersion!==expectedPreparationVersion)throw new DomainFailure('STATE_CONFLICT');
    return {fromGameId,preparationVersion:previous.preparationVersion};
   }
   if(room.status==='closed')throw new DomainFailure('ROOM_CLOSED');
   const self=r.members.active(room.id).find(m=>m.sessionId===actor.id);
   if(!self||self.id!==room.hostMemberId)throw new DomainFailure('FORBIDDEN');
   const latest=r.games.latest(room.id);
   if(!latest||latest.id!==fromGameId||!['result','interrupted'].includes(latest.status)
    ||r.games.hasActive(room.id)||room.preparedAfterGameId===fromGameId
    ||(room.preparationVersion??0)!==expectedPreparationVersion)throw new DomainFailure('STATE_CONFLICT');
   for(const member of r.members.active(room.id))r.members.setRole(member.id,'participant');
   r.rooms.bumpRoleRevision(room.id);r.rooms.bumpPenaltyRevision(room.id);
   const draft=r.drafts.find(room.id);
   r.drafts.save({roomId:room.id,caseText:'',penaltyText:'',durationSeconds:180,version:(draft?.version??0)+1});
   r.rooms.prepareNext(room.id,fromGameId);r.rooms.bumpVersion(room.id);
   const preparationVersion=expectedPreparationVersion+1;
   r.nextPreparations.insert({roomId:room.id,requestId,actorSessionId:actor.id,fromGameId,expectedPreparationVersion,preparationVersion});
   return {fromGameId,preparationVersion};
  });
 }
}
