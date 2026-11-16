import {maintainBeforeRequest} from './membership-lifecycle.js';
import type {UnitOfWork,Repositories,RoomRecord} from './ports/storage.js';
import type {Clock,TokenCodec} from './browser-sessions.js';
import {DomainFailure} from '../domain/failure.js';
import {hasCurrentAcceptance} from './penalty-consent.js';
export function startConditions(r:Repositories,room:RoomRecord,now:number){
 const members=r.members.active(room.id);const connected=members.filter(m=>m.disconnectedAt==null&&(m.lastSeenAt??m.joinedAt)>now-15000);const defendants=connected.filter(m=>m.role==='defendant');const draft=r.drafts.find(room.id);const missing:string[]=[];
 if(r.games.hasActive(room.id))missing.push('이미 진행 중인 게임이 있어요.');
 else if(r.games.latest(room.id))missing.push('다음 게임 준비는 아직 지원하지 않아요.');
 if(connected.length<3)missing.push('연결된 참가자가 피고를 포함해 3명 이상 필요해요.');
 if(defendants.length!==1)missing.push('연결된 피고 1명이 필요해요.');
 if(!draft?.caseText.trim())missing.push('저장된 사건을 작성해 주세요.');if(!draft?.penaltyText.trim())missing.push('저장된 벌칙을 작성해 주세요.');
 if(!hasCurrentAcceptance({memberId:defendants[0]?.id??null,roleRevision:room.roleRevision??0,penaltyRevision:room.penaltyRevision??0,penaltyText:draft?.penaltyText??''},r.consents.find(room.id)))missing.push('현재 피고의 벌칙 동의가 필요해요.');
 return {missing,connected,draft};
}
export class StartTrial {
 constructor(private readonly uow:UnitOfWork,private readonly clock:Clock,private readonly tokens:TokenCodec){}
 execute(actor:{id:string},code:string,input:unknown):string{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new DomainFailure('INVALID_INPUT');const value=input as Record<string,unknown>;
  if(Object.keys(value).sort().join(',')!=='expectedDecisionVersion,expectedDraftVersion,expectedRoleRevision,requestId'||typeof value.requestId!=='string'||!/^[-a-zA-Z0-9_]{16,100}$/.test(value.requestId))throw new DomainFailure('INVALID_INPUT');
  for(const key of ['expectedDecisionVersion','expectedDraftVersion','expectedRoleRevision'])if(!Number.isSafeInteger(value[key])||Number(value[key])<0)throw new DomainFailure('INVALID_INPUT');
  const intent=JSON.stringify([value.expectedDraftVersion,value.expectedRoleRevision,value.expectedDecisionVersion]);const requestId=value.requestId;
  const now=this.clock.now();
  maintainBeforeRequest(this.uow,now);
  return this.uow.run(r=>{
   const room=r.rooms.findByInvite(code);if(!room)throw new DomainFailure('NOT_FOUND');
   const receipt=r.starts.find(room.id,requestId);if(receipt){if(receipt.actorSessionId!==actor.id)throw new DomainFailure('FORBIDDEN');if(receipt.intent!==intent)throw new DomainFailure('STATE_CONFLICT');return receipt.gameId;}
   if(room.status!=='open')throw new DomainFailure('NOT_FOUND');const self=r.members.active(room.id).find(m=>m.sessionId===actor.id);if(!self||self.id!==room.hostMemberId)throw new DomainFailure('FORBIDDEN');
   for(const id of r.members.detectDisconnected(now,15000)){r.rooms.bumpVersion(id);if(id===room.id)room.version++;}
   const conditions=startConditions(r,room,now);if(conditions.missing.length||conditions.draft?.version!==value.expectedDraftVersion||(room.roleRevision??0)!==value.expectedRoleRevision||(r.consents.find(room.id)?.version??0)!==value.expectedDecisionVersion)throw new DomainFailure('STATE_CONFLICT');
   const draft=conditions.draft!;const gameId=this.tokens.id();r.games.insert({id:gameId,roomId:room.id,status:'defense',caseText:draft.caseText,penaltyText:draft.penaltyText,durationSeconds:draft.durationSeconds,version:0,createdAt:now});
   for(const member of conditions.connected)r.participants.insert({gameId,roomId:room.id,memberId:member.id,role:member.role==='defendant'?'defendant':'participant',eligible:member.role!=='defendant'});
   r.starts.insert({roomId:room.id,requestId,actorSessionId:actor.id,intent,gameId});r.rooms.bumpVersion(room.id);return gameId;
  });
 }
}
