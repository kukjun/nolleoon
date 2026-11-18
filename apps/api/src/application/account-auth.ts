import {accountAvatar,accountAvatarView} from './account-avatar-view.js';
import {SessionRequired,type Clock,type TokenCodec} from './browser-sessions.js';
import type {AccountAuthRepository,AccountAuthUnitOfWork,AccountRecord,KakaoIdentityProvider} from './ports/account-auth.js';
import {DomainFailure} from '../domain/failure.js';
export const ACCOUNT_SESSION_MS=30*24*60*60*1000;
export const ACCOUNT_FLOW_MS=5*60*1000;
const control=(s:string)=>/[\p{Cc}\p{Cf}]/u.test(s);
const opaque=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
export function accountReturnPath(value:unknown):string {
 if(typeof value!=='string'||!(value==='/travel'||/^\/travel\/invite\/[A-Za-z0-9_-]{20,128}$/.test(value)))throw new DomainFailure('INVALID_INPUT');
 return value;
}
function publicAccount(a:AccountRecord,r:AccountAuthRepository){return {avatar:accountAvatarView(accountAvatar(r,a)),id:a.id,displayName:a.displayName,presetId:a.presetId,revision:a.revision};}
export class AccountAuth {
 constructor(private readonly uow:AccountAuthUnitOfWork,private readonly clock:Clock,private readonly codec:TokenCodec,private readonly provider?:KakaoIdentityProvider){}
 private current(r:AccountAuthRepository,token:unknown,now:number){
  const session=opaque(token)?r.findSession(this.codec.hash(token)):undefined;
  const account=session?r.findAccount(session.accountId):undefined;
  if(!session||session.revokedAt!==null||session.expiresAt<=now||account?.status!=='active')throw new SessionRequired();
  return {session,account};
 }
 require(token?:string){return this.uow.run(({accountAuth:r})=>{const current=this.current(r,token,this.clock.now());return {accountId:current.account.id,sessionHash:current.session.tokenHash};});}
 session(token?:string){if(!token)return {authenticated:false as const};return this.uow.run(({accountAuth:r})=>({authenticated:true as const,account:publicAccount(this.current(r,token,this.clock.now()).account,r)}));}
 begin(returnTo:unknown,browserToken?:string,accountToken?:string){
  const returnPath=accountReturnPath(returnTo);if(!this.provider)throw new DomainFailure('TEMPORARILY_UNAVAILABLE');
  const browser=opaque(browserToken)?browserToken:this.codec.token(),state=this.codec.token(),now=this.clock.now();
  const previousSessionHash=opaque(accountToken)?this.codec.hash(accountToken):null;
  this.uow.run(({accountAuth:r})=>{
   r.invalidateAttempts(this.codec.hash(browser));
   r.insertAttempt({stateHash:this.codec.hash(state),browserHash:this.codec.hash(browser),codeHash:null,returnPath,createdAt:now,expiresAt:now+ACCOUNT_FLOW_MS,status:'pending',previousSessionHash});
  });
  return {state,browserToken:browser,authorizationUrl:this.provider.authorizationUrl(state)};
 }
 callbackReturnPath(state:unknown,browserToken:unknown){
  if(!opaque(state)||!opaque(browserToken))return '/travel';
  return this.uow.run(({accountAuth:r})=>{const a=r.findAttempt(this.codec.hash(state));return a&&a.browserHash===this.codec.hash(browserToken)&&a.expiresAt>this.clock.now()?accountReturnPath(a.returnPath):'/travel';});
 }
 async callback(state:unknown,browserToken:unknown,code:unknown,cancelled=false){
  if(!opaque(state)||!opaque(browserToken)||!this.provider)throw new DomainFailure('FORBIDDEN');
  const stateHash=this.codec.hash(state),browserHash=this.codec.hash(browserToken);
  const attempt=this.uow.run(({accountAuth:r})=>{
   const a=r.findAttempt(stateHash);
   if(!a||a.browserHash!==browserHash||a.status!=='pending'||a.expiresAt<=this.clock.now())throw new DomainFailure('FORBIDDEN');
   if(cancelled){r.invalidateAttempts(browserHash);return {...a,cancelled:true as const};}
   if(typeof code!=='string'||code.length<1||code.length>2048||(/\s/.test(code)||control(code)))throw new DomainFailure('INVALID_INPUT');
   if(!r.claimAttempt(stateHash,this.codec.hash(code)))throw new DomainFailure('FORBIDDEN');
   return {...a,cancelled:false as const};
  });
  if(attempt.cancelled)return {returnPath:attempt.returnPath,cancelled:true as const};
  let identity:{subject:string};
  try{identity=await this.provider.exchange(code as string);}catch{this.uow.run(({accountAuth:r})=>r.consumeAttempt(stateHash));throw new DomainFailure('TEMPORARILY_UNAVAILABLE');}
  if(!identity||typeof identity.subject!=='string'||!/^\d{1,30}$/.test(identity.subject)){this.uow.run(({accountAuth:r})=>r.consumeAttempt(stateHash));throw new DomainFailure('FORBIDDEN');}
  return this.uow.run(({accountAuth:r})=>{
   const latest=r.findAttempt(stateHash),now=this.clock.now();
   if(!latest||latest.status!=='exchanging'||latest.expiresAt<=now||!r.consumeAttempt(stateHash))throw new DomainFailure('FORBIDDEN');
   const linked=r.findIdentity('kakao',identity.subject);
   const previous=attempt.previousSessionHash?r.findSession(attempt.previousSessionHash):undefined;
   if(previous&&previous.revokedAt===null&&previous.expiresAt>now&&linked?.accountId!==previous.accountId)throw new DomainFailure('STATE_CONFLICT');
   let account=linked?r.findAccount(linked.accountId):undefined;
   if(linked&&account?.status!=='active')throw new DomainFailure('FORBIDDEN');
   if(!account){account={id:this.codec.id(),createdAt:now,status:'active',displayName:'여행자',presetId:'preset-01',revision:0};r.insertAccount(account);r.insertIdentity('kakao',identity.subject,account.id);}
   if(attempt.previousSessionHash)r.revokeSession(attempt.previousSessionHash,now);
   r.revokeBrowserSessions(browserHash,now);
   const token=this.codec.token();r.insertSession({browserHash,tokenHash:this.codec.hash(token),accountId:account.id,createdAt:now,expiresAt:now+ACCOUNT_SESSION_MS,revokedAt:null});
   return {cancelled:false as const,returnPath:attempt.returnPath,token,account:publicAccount(account,r)};
  });
 }
 logout(token?:string,browserToken?:string){this.uow.run(({accountAuth:r})=>{if(opaque(token))r.revokeSession(this.codec.hash(token),this.clock.now());if(opaque(browserToken)){r.invalidateAttempts(this.codec.hash(browserToken));r.revokeBrowserSessions(this.codec.hash(browserToken),this.clock.now());}});return {authenticated:false as const};}
 profile(token:string|undefined,input:unknown){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new DomainFailure('INVALID_INPUT');
  const b=input as Record<string,unknown>;
  if(Object.keys(b).sort().join(',')!=='displayName,expectedRevision,presetId'||typeof b.displayName!=='string'||!Number.isSafeInteger(b.expectedRevision)||(b.expectedRevision as number)<0||typeof b.presetId!=='string'||!/^preset-(0[1-9]|10)$/.test(b.presetId))throw new DomainFailure('INVALID_INPUT');
  const name=b.displayName.normalize('NFKC').trim();if(!name||[...name].length>20||control(name))throw new DomainFailure('INVALID_INPUT');
  return this.uow.run(({accountAuth:r})=>{const a=this.current(r,token,this.clock.now()).account;if(!r.updateProfile(a.id,b.expectedRevision as number,name,b.presetId as string))throw new DomainFailure('STATE_CONFLICT');if(b.presetId!==a.presetId){const avatar=accountAvatar(r,a);r.saveAvatar({accountId:a.id,presetId:b.presetId as string,revision:avatar.revision+1,imageBytes:null});}return {authenticated:true as const,account:publicAccount(r.findAccount(a.id)!,r)};});
 }
}
