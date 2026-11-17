import {DomainFailure} from '../domain/failure.js';
import type {AvatarRecord,Repositories,UnitOfWork} from './ports/storage.js';
export class Avatars {
 constructor(private readonly uow:UnitOfWork){}
 private profile(r:Repositories,id:string):AvatarRecord{return r.avatars.find(id)??{sessionId:id,presetId:'preset-01',revision:0,imageBytes:null};}
 private view(profile:AvatarRecord,imagePath:string){return {kind:profile.presetId?'preset' as const:'image' as const,presetId:profile.presetId,revision:profile.revision,imageUrl:profile.presetId?null:`${imagePath}?v=${profile.revision}`};}
 get(actor:{id:string}){return this.uow.run(r=>this.view(this.profile(r,actor.id),'/api/avatar/image'));}
 private revision(value:unknown):number{if(!Number.isSafeInteger(value)||Number(value)<0)throw new DomainFailure('INVALID_INPUT');return value as number;}
 private save(actor:{id:string},expected:number,presetId:string|null,imageBytes:Uint8Array|null){return this.uow.run(r=>{
  const previous=this.profile(r,actor.id);if(previous.revision!==expected)throw new DomainFailure('STATE_CONFLICT');
  const record={sessionId:actor.id,presetId,imageBytes,revision:previous.revision+1};r.avatars.save(record);return this.view(record,'/api/avatar/image');
 });}
 preset(actor:{id:string},input:unknown){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new DomainFailure('INVALID_INPUT');
  const value=input as Record<string,unknown>;
  if(Object.keys(value).sort().join(',')!=='expectedRevision,presetId'||typeof value.presetId!=='string'||!/^preset-(0[1-9]|10)$/.test(value.presetId))throw new DomainFailure('INVALID_INPUT');
  return this.save(actor,this.revision(value.expectedRevision),value.presetId,null);
 }
 private room(r:Repositories,actor:{id:string},code:string){
  if(!/^[A-Za-z0-9_-]{43}$/.test(code))throw new DomainFailure('NOT_FOUND');
  const room=r.rooms.findByInvite(code);if(!room)throw new DomainFailure('NOT_FOUND');
  const members=r.members.active(room.id);
  if(!members.some(m=>m.sessionId===actor.id))throw new DomainFailure('FORBIDDEN');
  return members;
 }
 roomProfiles(actor:{id:string},code:string){return this.uow.run(r=>({members:this.room(r,actor,code).map(m=>({memberId:m.id,avatar:this.view(this.profile(r,m.sessionId),`/api/rooms/${code}/avatars/${m.id}/image`)}))}));}
}
