import type {UnitOfWork,Repositories} from './ports/storage.js';
import type {AvatarImageProcessor} from './avatars.js';
import {DomainFailure} from '../domain/failure.js';
import {SessionRequired,type Clock} from './browser-sessions.js';
export interface AccountAvatarActor {accountId:string;sessionHash:string}
import {accountAvatar,accountAvatarView} from './account-avatar-view.js';
export const ACCOUNT_AVATAR_QUOTA=16*1024*1024;
function identifier(value:string){if(!/^[-A-Za-z0-9_]{1,100}$/.test(value))throw new DomainFailure('NOT_FOUND');return value;}
function revision(value:unknown){if(!Number.isSafeInteger(value)||Number(value)<0)throw new DomainFailure('INVALID_INPUT');return value as number;}
export class AccountAvatars {
 constructor(private readonly uow:UnitOfWork,private readonly images:AvatarImageProcessor,private readonly clock:Clock){}
 private active(r:Repositories,actor:AccountAvatarActor){const a=r.accountAuth.findAccount(actor.accountId),session=r.accountAuth.findSession(actor.sessionHash);if(a?.status!=='active'||!session||session.accountId!==a.id||session.revokedAt!==null||session.expiresAt<=this.clock.now())throw new SessionRequired();return a;}
 get(actor:AccountAvatarActor){return this.uow.run(r=>accountAvatarView(accountAvatar(r.accountAuth,this.active(r,actor))));}
 private save(actor:AccountAvatarActor,expected:number,presetId:string|null,imageBytes:Uint8Array|null){return this.uow.run(r=>{
  const account=this.active(r,actor),old=accountAvatar(r.accountAuth,account);if(old.revision!==expected)throw new DomainFailure('STATE_CONFLICT');
  const oldBytes=r.accountAuth.findAvatar(account.id,true)?.imageBytes?.byteLength??0;
  if(imageBytes&&r.accountAuth.totalAvatarBytes()-oldBytes+imageBytes.byteLength>ACCOUNT_AVATAR_QUOTA)throw new DomainFailure('TEMPORARILY_UNAVAILABLE');
  const record={accountId:account.id,presetId,revision:old.revision+1,imageBytes};
  // Bump the profile revision too, so delayed profile edits cannot silently undo a photo.
  if(!r.accountAuth.updateProfile(account.id,account.revision,account.displayName,presetId??account.presetId))throw new DomainFailure('STATE_CONFLICT');
  r.accountAuth.saveAvatar(record);return accountAvatarView(record);
 });}
 preset(actor:AccountAvatarActor,input:unknown){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new DomainFailure('INVALID_INPUT');const b=input as Record<string,unknown>;
  if(Object.keys(b).sort().join(',')!=='expectedRevision,presetId'||typeof b.presetId!=='string'||!/^preset-(0[1-9]|10)$/.test(b.presetId))throw new DomainFailure('INVALID_INPUT');return this.save(actor,revision(b.expectedRevision),b.presetId,null);
 }
 async upload(actor:AccountAvatarActor,expected:unknown,bytes:Uint8Array,mime:string){
  const rev=revision(expected);this.uow.run(r=>this.active(r,actor));
  if(bytes.byteLength<1||bytes.byteLength>1048576)throw new DomainFailure('PAYLOAD_TOO_LARGE');const thumbnail=await this.images.thumbnail(bytes,mime);if(thumbnail.byteLength<1||thumbnail.byteLength>65536)throw new DomainFailure('INVALID_INPUT');return this.save(actor,rev,null,thumbnail);
 }
 ownImage(actor:AccountAvatarActor){return this.uow.run(r=>{const image=accountAvatar(r.accountAuth,this.active(r,actor),true).imageBytes;if(!image)throw new DomainFailure('NOT_FOUND');return image;});}
 private members(r:Repositories,actor:AccountAvatarActor,roomId:string){
  this.active(r,actor);const room=r.travel.room(identifier(roomId));if(!room)throw new DomainFailure('NOT_FOUND');
  const members=r.travel.members(room.id);if(!members.some(m=>m.accountId===actor.accountId))throw new DomainFailure('FORBIDDEN');if(room.status!=='open')throw new DomainFailure('ROOM_CLOSED');return members.filter(m=>r.accountAuth.findAccount(m.accountId)?.status==='active');
 }
 roomProfiles(actor:AccountAvatarActor,roomId:string){return this.uow.run(r=>({members:this.members(r,actor,roomId).map(m=>({memberId:m.id,avatar:accountAvatarView(accountAvatar(r.accountAuth,r.accountAuth.findAccount(m.accountId)!),`/api/travel-rooms/${roomId}/avatars/${m.id}/image`)}))}));}
 roomImage(actor:AccountAvatarActor,roomId:string,memberId:string){return this.uow.run(r=>{const member=this.members(r,actor,roomId).find(m=>m.id===identifier(memberId));if(!member)throw new DomainFailure('NOT_FOUND');const image=accountAvatar(r.accountAuth,r.accountAuth.findAccount(member.accountId)!,true).imageBytes;if(!image)throw new DomainFailure('NOT_FOUND');return image;});}
}
