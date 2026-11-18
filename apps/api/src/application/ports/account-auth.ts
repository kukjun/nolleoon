import type {NativeAccountSessions} from './native-account-sessions.js';
export interface AccountAvatarRecord {accountId:string;presetId:string|null;revision:number;imageBytes:Uint8Array|null}
// Account identity is deliberately separate from legacy browser sessions.
export interface AccountRecord {id:string;createdAt:number;status:'active'|'disabled';displayName:string;presetId:string;revision:number}
export interface AccountSessionRecord {tokenHash:string;accountId:string;browserHash:string;createdAt:number;expiresAt:number;revokedAt:number|null}
export interface OAuthAttempt {stateHash:string;browserHash:string;codeHash:string|null;returnPath:string;createdAt:number;expiresAt:number;status:'pending'|'exchanging'|'consumed';previousSessionHash:string|null}
export interface AccountAuthRepository {
 findAvatar(accountId:string,includeImage?:boolean):AccountAvatarRecord|undefined;
 saveAvatar(record:AccountAvatarRecord):void;
 totalAvatarBytes():number;
 findAccount(id:string):AccountRecord|undefined;
 insertAccount(record:AccountRecord):void;
 updateProfile(id:string,expectedRevision:number,displayName:string,presetId:string):boolean;
 findIdentity(provider:'kakao',subject:string):{accountId:string}|undefined;
 insertIdentity(provider:'kakao',subject:string,accountId:string):void;
 findSession(hash:string):AccountSessionRecord|undefined;
 insertSession(record:AccountSessionRecord):void;
 revokeSession(hash:string,now:number):void;
 revokeBrowserSessions(browserHash:string,now:number):void;
 insertAttempt(record:OAuthAttempt):void;
 findAttempt(stateHash:string):OAuthAttempt|undefined;
 invalidateAttempts(browserHash:string):void;
 claimAttempt(stateHash:string,codeHash:string):boolean;
 consumeAttempt(stateHash:string):boolean;
}
export interface AccountAuthUnitOfWork {run<T>(work:(repositories:{accountAuth:AccountAuthRepository;nativeSessions?:NativeAccountSessions})=>T):T}
export interface KakaoIdentityProvider {authorizationUrl(state:string):string;exchange(code:string):Promise<{subject:string}>}
