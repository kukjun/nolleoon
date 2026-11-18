export interface NativeAccountSession {tokenHash:string;accountId:string;createdAt:number;expiresAt:number;revokedAt:number|null}
export interface NativeAccountSessions {
 find(hash:string):NativeAccountSession|undefined;
 insert(session:NativeAccountSession):void;
 revoke(hash:string,now:number):void;
}
/** Must verify current authoritative deletion/queue state and replay pending deletions. */
export interface NativeAuthAuthority {check():void;pending(subject:string,now:number):boolean}
export interface NativePrincipal {accountId:string;sessionHash:string;transport:'native'}
