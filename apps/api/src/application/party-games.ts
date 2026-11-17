import {balancedTeams,allocateLots} from '../domain/party-allocation.js';
import {DomainFailure} from '../domain/failure.js';
import type {Clock,TokenCodec} from './browser-sessions.js';
import type {UnitOfWork,Repositories,RoomRecord,MemberRecord} from './ports/storage.js';
import type {RandomSource} from './ports/random.js';
import type {SelectionRecord,RunRecord} from './ports/party.js';
import {maintainBeforeRequest} from './membership-lifecycle.js';

export function exactBody(input:unknown,keys:string[]):Record<string,unknown>{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!==[...keys].sort().join(','))throw new DomainFailure('INVALID_INPUT');
 return input as Record<string,unknown>;
}
function version(value:unknown):number{if(!Number.isSafeInteger(value)||Number(value)<0)throw new DomainFailure('INVALID_INPUT');return value as number;}
function integer(value:unknown,min:number):number{if(!Number.isSafeInteger(value)||Number(value)<min||Number(value)>10000)throw new DomainFailure('INVALID_INPUT');return value as number;}
function penalty(value:unknown):string{if(typeof value!=='string'||[...value].length>500||/[\p{Cc}\p{Cf}]/u.test(value.replace(/[\n\r\t]/g,'')))throw new DomainFailure('INVALID_INPUT');return value.trim();}
function roomByCode(r:Repositories,code:string):RoomRecord{const room=r.rooms.findByInvite(code);if(!room)throw new DomainFailure('NOT_FOUND');return room;}
function currentMember(r:Repositories,room:RoomRecord,actor:{id:string}):MemberRecord{const member=r.members.active(room.id).find(m=>m.sessionId===actor.id);if(!member)throw new DomainFailure('FORBIDDEN');return member;}
function hostMember(r:Repositories,room:RoomRecord,actor:{id:string}):MemberRecord{if(room.status!=='open')throw new DomainFailure('ROOM_CLOSED');const member=currentMember(r,room,actor);if(member.id!==room.hostMemberId)throw new DomainFailure('FORBIDDEN');return member;}
function selection(r:Repositories,room:RoomRecord):SelectionRecord{const s=r.party.selection(room.id);if(!s)throw new DomainFailure('STATE_CONFLICT');return s;}
function prepared(r:Repositories,room:RoomRecord,s:SelectionRecord):void{const latest=r.party.latest(room.id);if(latest&&(latest.status==='active'||latest.id!==s.preparedAfterRunId))throw new DomainFailure('STATE_CONFLICT');}
function requestId(value:unknown):string{if(typeof value!=='string'||!/^[-a-zA-Z0-9_]{16,100}$/.test(value))throw new DomainFailure('INVALID_INPUT');return value;}
export class PartyGames {
 constructor(private readonly uow:UnitOfWork,private readonly clock:Clock,private readonly tokens:TokenCodec,private readonly random:RandomSource){}
 private run<T>(work:(r:Repositories,now:number)=>T):T{const now=this.clock.now();maintainBeforeRequest(this.uow,now,this.random);return this.uow.run(r=>work(r,now));}
 select(actor:{id:string},code:string,input:unknown){
  const body=exactBody(input,['expectedVersion','type','teamCount','winnerCount','penaltyText']);
  const expected=version(body.expectedVersion),teamCount=integer(body.teamCount,2),winnerCount=integer(body.winnerCount,1),penaltyText=penalty(body.penaltyText);
  if(body.type!=='team'&&body.type!=='draw'&&body.type!=='trial')throw new DomainFailure('INVALID_INPUT');const type=body.type;
  return this.run(r=>{const room=roomByCode(r,code);hostMember(r,room,actor);const s=selection(r,room);prepared(r,room,s);if(s.version!==expected)throw new DomainFailure('STATE_CONFLICT');
   if(type!==s.type)r.party.resetCourtPreparation(room.id);
   r.party.saveSelection({...s,type,version:s.version+1,teamCount,winnerCount,penaltyText:type==='draw'?penaltyText:''});r.rooms.bumpVersion(room.id);
   return this.snapshot(r,roomByCode(r,code),actor);
  });
 }
 start(actor:{id:string},code:string,input:unknown){
  const body=exactBody(input,['requestId','expectedSelectionVersion']);const id=requestId(body.requestId),expected=version(body.expectedSelectionVersion),intent=JSON.stringify([expected]);
  return this.run((r,now)=>{const room=roomByCode(r,code);const previous=r.party.receipt(room.id,id);
   if(previous){if(previous.actorSessionId!==actor.id)throw new DomainFailure('FORBIDDEN');if(previous.action!=='start'||previous.intent!==intent)throw new DomainFailure('STATE_CONFLICT');return {action:'start' as const,runId:previous.runId,requestId:id};}
   const host=hostMember(r,room,actor),s=selection(r,room);prepared(r,room,s);if(s.version!==expected||s.type==='trial')throw new DomainFailure('STATE_CONFLICT');
   const members=r.members.active(room.id).filter(m=>m.disconnectedAt==null&&(m.lastSeenAt??m.joinedAt)>now-15000);
   if(members.length<2||!members.some(m=>m.id===host.id)||(s.type==='team'?s.teamCount>members.length:s.winnerCount>members.length||!s.penaltyText.trim()))throw new DomainFailure('STATE_CONFLICT');
   const allocations=s.type==='team'?balancedTeams(members.map(m=>m.id),s.teamCount,this.random).map(a=>({...a,winning:null})):allocateLots(members.map(m=>m.id),s.winnerCount,this.random).map(a=>({...a,team:null}));
   const runId=this.tokens.id();
   r.party.insertRun({id:runId,roomId:room.id,type:s.type,status:s.type==='team'?'completed':'active',version:0,settingsJson:JSON.stringify({teamCount:s.teamCount,winnerCount:s.winnerCount,penaltyText:s.type==='draw'?s.penaltyText:''}),createdAt:now});
   for(const member of members)r.party.addParticipant({runId,roomId:room.id,memberId:member.id,nickname:member.nickname,eligible:true});
   for(const allocation of allocations)r.party.addAllocation({runId,memberId:allocation.memberId,team:allocation.team,winning:allocation.winning});
   r.party.addReceipt({roomId:room.id,requestId:id,actorSessionId:actor.id,action:'start',intent,runId});r.rooms.bumpVersion(room.id);
   return {action:'start' as const,runId,requestId:id};
  });
 }
 reveal(actor:{id:string},code:string,runId:string,input:unknown){
  const body=exactBody(input,['requestId']),id=requestId(body.requestId);
  return this.run((r,now)=>{const room=roomByCode(r,code),old=r.party.receipt(room.id,id);
   if(old){if(old.actorSessionId!==actor.id)throw new DomainFailure('FORBIDDEN');if(old.action!=='reveal'||old.runId!==runId)throw new DomainFailure('STATE_CONFLICT');return {action:'reveal' as const,runId,requestId:id};}
   if(room.status!=='open')throw new DomainFailure('ROOM_CLOSED');const member=currentMember(r,room,actor),run=r.party.run(runId);
   if(!run||run.roomId!==room.id)throw new DomainFailure('NOT_FOUND');if(run.type!=='draw')throw new DomainFailure('STATE_CONFLICT');
   const participant=r.party.participants(runId).find(p=>p.memberId===member.id&&p.eligible);if(!participant)throw new DomainFailure('FORBIDDEN');
   const revealed=r.party.reveals(runId);
   if(!revealed.includes(member.id)){
    if(run.status!=='active'||r.party.latest(room.id)?.id!==runId)throw new DomainFailure('STATE_CONFLICT');
    r.party.reveal(runId,member.id,now);
    const complete=revealed.length+1===r.party.participants(runId).filter(p=>p.eligible).length;
    r.party.updateRun(runId,complete?'completed':'active');r.rooms.bumpVersion(room.id);
   }
   r.party.addReceipt({roomId:room.id,requestId:id,actorSessionId:actor.id,action:'reveal',intent:runId,runId});
   return {action:'reveal' as const,runId,requestId:id};
  });
 }
 read(actor:{id:string},code:string){return this.run(r=>{const room=roomByCode(r,code);currentMember(r,room,actor);return this.snapshot(r,room,actor);});}
 private snapshot(r:Repositories,room:RoomRecord,actor:{id:string}){
  const self=currentMember(r,room,actor),s=selection(r,room),latest=r.party.latest(room.id);
  if(latest?.status==='active'&&latest.type!=='trial'&&!r.party.participants(latest.id).some(p=>p.memberId===self.id))r.party.addParticipant({runId:latest.id,roomId:room.id,memberId:self.id,nickname:self.nickname,eligible:false});
  const hasHistory=latest&&r.party.participants(latest.id).some(p=>r.members.find(p.memberId)?.sessionId===actor.id);
  const accessible=latest&&(latest.status==='active'||hasHistory);
  const run=accessible&&latest.id!==s.preparedAfterRunId?this.projectRun(r,latest,actor):null;
  return {roomId:room.id,inviteCode:room.inviteCode,version:room.version,selection:{type:s.type,version:s.version,teamCount:s.teamCount,winnerCount:s.winnerCount,penaltyText:latest&&latest.id!==s.preparedAfterRunId&&!hasHistory?'':s.penaltyText},run,self:{memberId:self.id,isHost:room.hostMemberId===self.id},blockedPolicy:run?.blockedPolicy??null};
 }
 private projectRun(r:Repositories,run:RunRecord,actor:{id:string},historical=false){
  // Interrupted trial disclosure stays exclusively in the legacy policy-aware adapter.
  if(run.type==='trial'&&run.status==='interrupted')return null;
  const all=r.party.participants(run.id),own=all.filter(p=>r.members.find(p.memberId)?.sessionId===actor.id);
  const current=r.members.active(run.roomId).find(m=>m.sessionId===actor.id);
  const subject=historical?own:own.filter(p=>p.memberId===current?.id);
  const eligible=subject.some(p=>p.eligible),reveals=r.party.reveals(run.id),settings=JSON.parse(run.settingsJson) as {teamCount?:number;winnerCount?:number;penaltyText?:string};
  const blocked=run.type==='draw'&&run.status!=='completed'&&(run.status==='interrupted'||all.some(p=>p.eligible&&r.members.find(p.memberId)?.leftAt!==null&&!reveals.includes(p.memberId)));
  const canSee=run.type==='trial'?subject.length>0:eligible;
  const result=canSee?(run.type==='trial'?{kind:'trial' as const,legacyGameId:run.id}:run.type==='team'?{kind:'team' as const,assignments:r.party.allocations(run.id).map(a=>({memberId:a.memberId,team:a.team!}))}:run.status==='interrupted'?null:{kind:'draw' as const,revealed:r.party.allocations(run.id).filter(a=>reveals.includes(a.memberId)).map(a=>({memberId:a.memberId,winner:a.winning!}))}):null;
  return {runId:run.id,type:run.type,status:run.status,version:run.version,participants:all.filter(p=>run.type==='trial'||p.eligible).map(p=>({memberId:p.memberId,nickname:p.nickname,eligible:p.eligible})),self:{eligible,revealed:subject.some(p=>reveals.includes(p.memberId))},settings:{teamCount:settings.teamCount??2,winnerCount:settings.winnerCount??1,penaltyText:canSee?settings.penaltyText??'':''},result,blockedPolicy:blocked?'unrevealed-member-left' as const:null};
 }
}
