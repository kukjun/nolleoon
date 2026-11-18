import type {UnitOfWork,Repositories} from './ports/storage.js';
import type {NativeAuthAuthority,NativePrincipal} from './ports/native-account-sessions.js';
import type {NativeKakaoTokenVerifier} from './ports/native-kakao-verifier.js';
import type {Clock,TokenCodec} from './browser-sessions.js';
import {SessionRequired} from './browser-sessions.js';
import {DomainFailure} from '../domain/failure.js';
import {accountAvatar,accountAvatarView} from './account-avatar-view.js';
export const NATIVE_SESSION_MS=30*24*60*60*1000;
const opaque=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
function view(r:Repositories,id:string){const a=r.accountAuth.findAccount(id)!;return{id:a.id,displayName:a.displayName,presetId:a.presetId,revision:a.revision,avatar:accountAvatarView(accountAvatar(r.accountAuth,a),'/api/native/account/avatar/image')};}
/** Native bearer sessions are never web cookies and are never refreshed implicitly. */
export class NativeAccountAuth {
 constructor(private readonly uow:UnitOfWork,private readonly clock:Clock,private readonly codec:TokenCodec,private readonly verifier:NativeKakaoTokenVerifier|undefined,private readonly authority:NativeAuthAuthority){}
 private guard(){try{this.authority.check();}catch{throw new DomainFailure('TEMPORARILY_UNAVAILABLE');}}
 private active(r:Repositories,token:unknown){
  if(!opaque(token))throw new SessionRequired();const session=r.nativeSessions.find(this.codec.hash(token)),now=this.clock.now();
  if(!session||session.revokedAt!==null||session.expiresAt<=now||r.accountAuth.findAccount(session.accountId)?.status!=='active')throw new SessionRequired();return session;
 }
 async login(providerAccessToken:unknown){
  this.guard();if(!this.verifier)throw new DomainFailure('TEMPORARILY_UNAVAILABLE');
  if(typeof providerAccessToken!=='string'||providerAccessToken.length<1||providerAccessToken.length>8192||/[\s\p{Cc}\p{Cf}]/u.test(providerAccessToken))throw new DomainFailure('INVALID_INPUT');
  let identity:{subject:string;expiresInSeconds:number};
  try{identity=await this.verifier.verify(providerAccessToken);}catch{throw new DomainFailure('TEMPORARILY_UNAVAILABLE');}
  if(!identity||typeof identity.subject!=='string'||! /^[1-9][0-9]*$/.test(identity.subject)||!Number.isSafeInteger(Number(identity.subject))||!Number.isSafeInteger(identity.expiresInSeconds)||identity.expiresInSeconds<=0)throw new DomainFailure('FORBIDDEN');
  this.guard();
  return this.uow.run(r=>{
   const now=this.clock.now();try{if(this.authority.pending(identity.subject,now))throw new Error();}catch{throw new DomainFailure('TEMPORARILY_UNAVAILABLE');}
   const linked=r.accountAuth.findIdentity('kakao',identity.subject);let account=linked?r.accountAuth.findAccount(linked.accountId):undefined;
   if(linked&&account?.status!=='active')throw new DomainFailure('FORBIDDEN');
   if(!account){account={id:this.codec.id(),createdAt:now,status:'active',displayName:'여행자',presetId:'preset-01',revision:0};r.accountAuth.insertAccount(account);r.accountAuth.insertIdentity('kakao',identity.subject,account.id);}
   const token=this.codec.token();if(!opaque(token))throw new Error('NATIVE_TOKEN_GENERATION_FAILED');const expiresAt=now+NATIVE_SESSION_MS;
   r.nativeSessions.insert({tokenHash:this.codec.hash(token),accountId:account.id,createdAt:now,expiresAt,revokedAt:null});
   return{token,expiresAt,account:view(r,account.id)};
  });
 }
 require(token:unknown):NativePrincipal{this.guard();return this.uow.run(r=>{const s=this.active(r,token);return{accountId:s.accountId,sessionHash:s.tokenHash,transport:'native'};});}
 session(token:unknown){this.guard();return this.uow.run(r=>{const s=this.active(r,token);return{authenticated:true as const,expiresAt:s.expiresAt,account:view(r,s.accountId)};});}
 logout(token:unknown){this.guard();if(!opaque(token))throw new SessionRequired();this.uow.run(r=>r.nativeSessions.revoke(this.codec.hash(token),this.clock.now()));return{authenticated:false as const};}
}
