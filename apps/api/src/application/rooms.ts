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
   return this.snapshot(r,room,actor.id);
  });
 }
 saveSettings(actor:{id:string},code:string,input:unknown){
  const draft=validateSettings(input);
  return this.uow.run(r=>{
   const room=this.openRoom(r,code);const self=r.members.active(room.id).find(m=>m.sessionId===actor.id);
   if(!self||room.hostMemberId!==self.id)throw new DomainFailure('FORBIDDEN');
   if(r.games.hasActive(room.id))throw new DomainFailure('STATE_CONFLICT');
   const current=r.drafts.find(room.id);if((current?.version??0)!==draft.expectedVersion)throw new DomainFailure('STATE_CONFLICT');
   r.drafts.save({roomId:room.id,caseText:draft.caseText,penaltyText:draft.penaltyText,durationSeconds:draft.durationMinutes*60,version:draft.expectedVersion+1});
   r.rooms.bumpVersion(room.id);room.version++;return this.snapshot(r,room,actor.id);
  });
 }
 sweep(){return this.uow.run(r=>{const rooms=r.members.detectDisconnected(this.clock.now(),PRESENCE_SILENCE_MS);for(const id of rooms)r.rooms.bumpVersion(id);return rooms.length;});}
 heartbeat(actor:{id:string},code:string){return this.uow.run(r=>{const room=this.openRoom(r,code);const member=r.members.active(room.id).find(m=>m.sessionId===actor.id);if(!member)throw new DomainFailure('FORBIDDEN');r.members.touch(member.id,this.clock.now());if(member.disconnectedAt!=null){r.rooms.bumpVersion(room.id);room.version++;}return this.snapshot(r,room,actor.id);});}
 read(actor:{id:string},code:string){return this.uow.run(r=>this.snapshot(r,this.openRoom(r,code),actor.id));}
 private openRoom(r:Repositories,code:string){
  if(!/^[A-Za-z0-9_-]{43}$/.test(code))throw new DomainFailure('NOT_FOUND');
  const room=r.rooms.findByInvite(code);if(!room||room.status!=='open')throw new DomainFailure('NOT_FOUND');return room;
 }
 private snapshot(r:Repositories,room:RoomRecord,sessionId:string){
  const members=r.members.active(room.id);const self=members.find(m=>m.sessionId===sessionId);
  if(!self)throw new DomainFailure('FORBIDDEN');
  const saved=r.drafts.find(room.id);const draft={version:saved?.version??0,caseText:saved?.caseText??'',penaltyText:saved?.penaltyText??'',durationMinutes:(saved?.durationSeconds??180)/60};
  return {roomId:room.id,draft,version:room.version,inviteCode:room.inviteCode,self:{memberId:self.id,isHost:self.id===room.hostMemberId},members:members.map(m=>({memberId:m.id,nickname:m.nickname,connected:m.disconnectedAt==null,isHost:m.id===room.hostMemberId}))};
 }
}
