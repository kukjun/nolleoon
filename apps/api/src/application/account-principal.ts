import type {AccountAuthRepository,AccountRecord} from './ports/account-auth.js';
import type {NativeAccountSessions} from './ports/native-account-sessions.js';
import {SessionRequired} from './browser-sessions.js';
export interface AccountPrincipal {accountId:string;sessionHash:string;transport:'web'|'native'}
export function principalAccount(r:{accountAuth:AccountAuthRepository;nativeSessions?:NativeAccountSessions},actor:AccountPrincipal,now:number):AccountRecord {
 if(!actor||!['web','native'].includes(actor.transport))throw new SessionRequired();
 const account=r.accountAuth.findAccount(actor.accountId),session=actor.transport==='native'?r.nativeSessions?.find(actor.sessionHash):r.accountAuth.findSession(actor.sessionHash);
 if(account?.status!=='active'||!session||session.accountId!==account.id||session.revokedAt!==null||session.expiresAt<=now)throw new SessionRequired();return account;
}
