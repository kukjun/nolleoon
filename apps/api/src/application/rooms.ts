import {publishedRounds} from './published-rounds.js';
import {startConditions} from './start-trial.js';
import {consentStatus,validateConsent} from './penalty-consent.js';
import type { UnitOfWork, Repositories, RoomRecord } from './ports/storage.js';
import type { Clock, TokenCodec } from './browser-sessions.js';
import { DomainFailure } from '../domain/failure.js';
export function normalizeNickname(input: unknown): {nickname:string;nicknameKey:string} {
 if(typeof input!=='string'||/[\p{Cc}\p{Cf}]/u.test(input))throw new DomainFailure('INVALID_INPUT');
 const nickname=input.normalize('NFKC').trim().replace(/\s+/gu,' ');
 if([...nickname].length<1||[...nickname].length>20)throw new DomainFailure('INVALID_INPUT');
 return {nickname,nicknameKey:nickname.toLowerCase()};
}
export interface SettingsInput {expectedVersion:number;caseText:string;penaltyText:string;durationMinutes:number}
export function validateSettings(input:unknown):SettingsInput {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new DomainFailure('INVALID_INPUT');
 const value=input as Record<string,unknown>;
 if(Object.keys(value).sort().join(',')!=='caseText,durationMinutes,expectedVersion,penaltyText'||!Number.isSafeInteger(value.expectedVersion)||Number(value.expectedVersion)<0||!Number.isInteger(value.durationMinutes)||Number(value.durationMinutes)<1||Number(value.durationMinutes)>10)throw new DomainFailure('INVALID_INPUT');
 for(const [key,max] of [['caseText',2000],['penaltyText',500]] as const){if(typeof value[key]!=='string'||[...value[key]].length>max||/[\p{Cc}\p{Cf}]/u.test(value[key].replace(/[\n\r\t]/g,'')))throw new DomainFailure('INVALID_INPUT');}
 return {expectedVersion:value.expectedVersion as number,caseText:(value.caseText as string).trim(),penaltyText:(value.penaltyText as string).trim(),durationMinutes:value.durationMinutes as number};
}
export const PRESENCE_SILENCE_MS=15000;
export class Rooms {
 constructor(private readonly uow:UnitOfWork,private readonly clock:Clock,private readonly tokens:TokenCodec){}
 create(actor:{id:string},input:unknown){
  const name=normalizeNickname(input);
  return this.uow.run(r=>{
   const room={id:this.tokens.id(),inviteCode:this.tokens.token(),status:'open' as const,version:0,createdAt:this.clock.now()};
   const member={id:this.tokens.id(),roomId:room.id,sessionId:actor.id,...name,joinedAt:this.clock.now()};
   r.rooms.insert(room);r.members.insert(member);r.rooms.setHost(room.id,member.id);
   return this.snapshot(r,{...room,hostMemberId:member.id},actor.id);
  });
 }
 join(actor:{id:string},code:string,input:unknown){
  const name=normalizeNickname(input);
  return this.uow.run(r=>{
   const room=this.openRoom(r,code);const members=r.members.active(room.id);
   // 같은 브라우저의 재시도는 닉네임 변경이나 두 번째 참가가 아니다.
   if(!members.some(m=>m.sessionId===actor.id)){
    if(members.some(m=>m.nicknameKey===name.nicknameKey))throw new DomainFailure('STATE_CONFLICT');
    r.members.insert({id:this.tokens.id(),roomId:room.id,sessionId:actor.id,...name,joinedAt:this.clock.now()});
    r.rooms.bumpVersion(room.id);
    room.version++;
   }
   this.observe(r,room,actor.id);return this.snapshot(r,room,actor.id);
  });
 }
 changeRole(actor:{id:string},code:string,role:unknown){
  if(role!=='defendant'&&role!=='participant')throw new DomainFailure('INVALID_INPUT');
  return this.uow.run(r=>{const room=this.openRoom(r,code);const members=r.members.active(room.id);const self=members.find(m=>m.sessionId===actor.id);
   if(!self)throw new DomainFailure('FORBIDDEN');if(r.games.hasActive(room.id))throw new DomainFailure('STATE_CONFLICT');
   if(self.role!==role){if(role==='defendant'&&members.some(m=>m.role==='defendant'))throw new DomainFailure('STATE_CONFLICT');r.members.setRole(self.id,role);r.rooms.bumpRoleRevision(room.id);r.rooms.bumpVersion(room.id);room.roleRevision=(room.roleRevision??0)+1;room.version++;}
   return this.snapshot(r,room,actor.id);
  });
 }
 excludeMember(actor:{id:string},code:string,memberId:unknown){
  if(typeof memberId!=='string'||!memberId||memberId.length>100)throw new DomainFailure('INVALID_INPUT');
  return this.uow.run(r=>{const room=this.openRoom(r,code);const members=r.members.active(room.id);const self=members.find(m=>m.sessionId===actor.id);
   if(!self||self.id!==room.hostMemberId||self.id===memberId)throw new DomainFailure('FORBIDDEN');if(r.games.hasActive(room.id))throw new DomainFailure('STATE_CONFLICT');
   const target=members.find(m=>m.id===memberId);if(!target)throw new DomainFailure('NOT_FOUND');if(target.disconnectedAt==null)throw new DomainFailure('STATE_CONFLICT');
   r.members.exclude(target.id,this.clock.now());if(target.role==='defendant'){r.rooms.bumpRoleRevision(room.id);room.roleRevision=(room.roleRevision??0)+1;}r.rooms.bumpVersion(room.id);room.version++;return this.snapshot(r,room,actor.id);
  });
 }
 decideConsent(actor:{id:string},code:string,input:unknown){
  const value=validateConsent(input);return this.uow.run(r=>{const room=this.openRoom(r,code);const member=r.members.active(room.id).find(m=>m.sessionId===actor.id);
   if(!member||member.role!=='defendant')throw new DomainFailure('FORBIDDEN');const draft=r.drafts.find(room.id);const previous=r.consents.find(room.id);
   if(r.games.hasActive(room.id)||!draft?.penaltyText.trim()||value.roleRevision!==(room.roleRevision??0)||value.penaltyRevision!==(room.penaltyRevision??0)||value.expectedDecisionVersion!==(previous?.version??0))throw new DomainFailure('STATE_CONFLICT');
   r.consents.save({roomId:room.id,memberId:member.id,roleRevision:value.roleRevision,penaltyRevision:value.penaltyRevision,decision:value.decision,version:value.expectedDecisionVersion+1});r.rooms.bumpVersion(room.id);room.version++;return this.snapshot(r,room,actor.id);
  });
 }
 saveSettings(actor:{id:string},code:string,input:unknown){
  const draft=validateSettings(input);
  return this.uow.run(r=>{
   const room=this.openRoom(r,code);const self=r.members.active(room.id).find(m=>m.sessionId===actor.id);
   if(!self||room.hostMemberId!==self.id)throw new DomainFailure('FORBIDDEN');
   if(r.games.hasActive(room.id))throw new DomainFailure('STATE_CONFLICT');
   const current=r.drafts.find(room.id);if((current?.version??0)!==draft.expectedVersion)throw new DomainFailure('STATE_CONFLICT');
   if((current?.penaltyText??'')!==draft.penaltyText){r.rooms.bumpPenaltyRevision(room.id);room.penaltyRevision=(room.penaltyRevision??0)+1;}
   r.drafts.save({roomId:room.id,caseText:draft.caseText,penaltyText:draft.penaltyText,durationSeconds:draft.durationMinutes*60,version:draft.expectedVersion+1});
   r.rooms.bumpVersion(room.id);room.version++;return this.snapshot(r,room,actor.id);
  });
 }
 sweep(){return this.uow.run(r=>{const rooms=r.members.detectDisconnected(this.clock.now(),PRESENCE_SILENCE_MS);for(const id of rooms)r.rooms.bumpVersion(id);return rooms.length;});}
 heartbeat(actor:{id:string},code:string){return this.uow.run(r=>{const room=this.openRoom(r,code);const member=r.members.active(room.id).find(m=>m.sessionId===actor.id);if(!member)throw new DomainFailure('FORBIDDEN');r.members.touch(member.id,this.clock.now());if(member.disconnectedAt!=null){r.rooms.bumpVersion(room.id);room.version++;}this.observe(r,room,actor.id);return this.snapshot(r,room,actor.id);});}
 read(actor:{id:string},code:string,gameId?:string){return this.uow.run(r=>this.snapshot(r,this.openRoom(r,code),actor.id,gameId));}
 private openRoom(r:Repositories,code:string){
  if(!/^[A-Za-z0-9_-]{43}$/.test(code))throw new DomainFailure('NOT_FOUND');
  const room=r.rooms.findByInvite(code);if(!room||room.status!=='open')throw new DomainFailure('NOT_FOUND');return room;
 }
 private observe(r:Repositories,room:RoomRecord,sessionId:string){const game=r.games.active(room.id);if(!game)return;const member=r.members.active(room.id).find(m=>m.sessionId===sessionId);if(member&&!r.participants.list(game.id).some(p=>p.memberId===member.id)){r.participants.insert({gameId:game.id,roomId:room.id,memberId:member.id,role:'observer',eligible:false});r.rooms.bumpVersion(room.id);room.version++;}}
 private snapshot(r:Repositories,room:RoomRecord,sessionId:string,gameId?:string){
  const members=r.members.active(room.id);const self=members.find(m=>m.sessionId===sessionId);
  if(!self)throw new DomainFailure('FORBIDDEN');
  const saved=r.drafts.find(room.id);let draft={version:saved?.version??0,caseText:saved?.caseText??'',penaltyText:saved?.penaltyText??'',durationMinutes:(saved?.durationSeconds??180)/60};
  const defendant=members.find(m=>m.role==='defendant');const record=r.consents.find(room.id);let consent={penaltyRevision:room.penaltyRevision??0,roleRevision:room.roleRevision??0,decisionVersion:record?.version??0,status:consentStatus({memberId:defendant?.id??null,roleRevision:room.roleRevision??0,penaltyRevision:room.penaltyRevision??0,penaltyText:draft.penaltyText},record),defendantMemberId:defendant?.id??null,canDecide:self.id===defendant?.id&&Boolean(draft.penaltyText.trim())&&!r.games.hasActive(room.id)};
  const candidate=gameId?r.games.find(gameId):r.games.latest(room.id);const participants=candidate?.roomId===room.id?r.participants.list(candidate.id):[];const historicalIds=r.members.idsForSession(room.id,sessionId);const active=candidate&&!['result','interrupted'].includes(candidate.status);const participation=participants.find(p=>p.memberId===self.id)??(!active?participants.find(p=>historicalIds.includes(p.memberId)):undefined);
  const firstRound=candidate?(r.rounds.find(candidate.id,2)??r.rounds.find(candidate.id,1)):undefined;const defenseRound=candidate?.status==='final-defense'||firstRound?.number===2?2 as const:1 as const;const response=candidate?r.defenses.find(candidate.id,defenseRound):undefined;
  const ownVote=candidate&&participation&&firstRound?r.votes.find(candidate.id,firstRound.number,participation.memberId):undefined;
  const settlement=candidate&&firstRound?r.settlements.find(candidate.id,firstRound.number):undefined;
  const game=candidate&&candidate.status!=='interrupted'&&participation?{publishedRounds:publishedRounds(r,candidate.id),settlement:settlement?{roundNumber:settlement.roundNumber,outcome:settlement.outcome,guilty:settlement.guilty,notGuilty:settlement.notGuilty,abstain:settlement.abstain,total:settlement.total,closedAt:settlement.closedAt,closedBy:settlement.closedBy}:null,ownVote:ownVote?{roundNumber:ownVote.roundNumber,choice:ownVote.choice,reason:ownVote.reason}:null,gameId:candidate.id,version:candidate.version,serverNow:this.clock.now(),round:firstRound?{number:firstRound.number,startedAt:firstRound.startedAt,deadline:firstRound.deadline}:null,defense:{roundNumber:defenseRound,status:response?.action??'pending' as 'pending'|'submitted'|'skipped',text:response?.action==='submitted'?response.text:null},status:candidate.status,caseText:candidate.caseText,penaltyText:candidate.penaltyText,durationMinutes:candidate.durationSeconds/60,self:{role:participation.role,eligible:participation.eligible},participantCount:participants.length,voterCount:participants.filter(p=>p.eligible).length}:null;
  if(candidate&&(candidate.status==='interrupted'||(!active&&!participation))){draft={...draft,caseText:'',penaltyText:'',durationMinutes:3};consent={...consent,status:'pending',defendantMemberId:null,canDecide:false};}
  const conditions=startConditions(r,room,this.clock.now());const start={canStart:self.id===room.hostMemberId&&conditions.missing.length===0,missing:conditions.missing};
  return {roomId:room.id,game,start,consent,roleRevision:room.roleRevision??0,rosterEditable:!r.games.hasActive(room.id),draft,version:room.version,inviteCode:room.inviteCode,self:{memberId:self.id,isHost:self.id===room.hostMemberId},members:members.map(m=>({memberId:m.id,nickname:m.nickname,role:m.role??'participant',connected:m.disconnectedAt==null,isHost:m.id===room.hostMemberId}))};
 }
}
