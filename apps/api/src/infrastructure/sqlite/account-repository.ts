import type {AccountAuthRepository,AccountRecord,AccountSessionRecord,OAuthAttempt} from '../../application/ports/account-auth.js';
export interface SqlAccess {execute(sql:string,params:object):void;find<T>(sql:string,...params:(string|number)[]):T|undefined;all<T>(sql:string,...params:(string|number)[]):T[]}
export function accountRepository({execute,find}:SqlAccess):AccountAuthRepository {
 const changed=()=>find<{n:number}>('SELECT changes() n')!.n===1;
 return {
 findAccount:id=>find<AccountRecord>('SELECT id,created_at createdAt,status,display_name displayName,preset_id presetId,revision FROM accounts WHERE id=?',id),
 insertAccount:r=>execute('INSERT INTO accounts VALUES (@id,@createdAt,@status,@displayName,@presetId,@revision)',r),
 updateProfile:(id,expectedRevision,displayName,presetId)=>{execute('UPDATE accounts SET display_name=@displayName,preset_id=@presetId,revision=revision+1 WHERE id=@id AND revision=@expectedRevision',{id,expectedRevision,displayName,presetId});return changed();},
 findIdentity:(provider,subject)=>find<{accountId:string}>('SELECT account_id accountId FROM provider_identities WHERE provider=? AND subject=?',provider,subject),
 insertIdentity:(provider,subject,accountId)=>execute('INSERT INTO provider_identities VALUES (@provider,@subject,@accountId)',{provider,subject,accountId}),
 findSession:hash=>find<AccountSessionRecord>('SELECT token_hash tokenHash,account_id accountId,browser_hash browserHash,created_at createdAt,expires_at expiresAt,revoked_at revokedAt FROM account_sessions WHERE token_hash=?',hash),
 insertSession:r=>execute('INSERT INTO account_sessions VALUES (@tokenHash,@accountId,@browserHash,@createdAt,@expiresAt,@revokedAt)',r),
 revokeSession:(hash,now)=>execute('UPDATE account_sessions SET revoked_at=@now WHERE token_hash=@hash AND revoked_at IS NULL',{hash,now}),
 revokeBrowserSessions:(browserHash,now)=>execute('UPDATE account_sessions SET revoked_at=@now WHERE browser_hash=@browserHash AND revoked_at IS NULL',{browserHash,now}),
 insertAttempt:r=>execute('INSERT INTO oauth_attempts VALUES (@stateHash,@browserHash,@codeHash,@returnPath,@createdAt,@expiresAt,@status,@previousSessionHash)',r),
 findAttempt:hash=>find<OAuthAttempt>('SELECT state_hash stateHash,browser_hash browserHash,code_hash codeHash,return_path returnPath,created_at createdAt,expires_at expiresAt,status,previous_session_hash previousSessionHash FROM oauth_attempts WHERE state_hash=?',hash),
 invalidateAttempts:browserHash=>execute("UPDATE oauth_attempts SET status='consumed' WHERE browser_hash=@browserHash AND status IN ('pending','exchanging')",{browserHash}),
 claimAttempt:(stateHash,codeHash)=>{execute("UPDATE oauth_attempts SET status='exchanging',code_hash=@codeHash WHERE state_hash=@stateHash AND status='pending'",{stateHash,codeHash});return changed();},
 consumeAttempt:stateHash=>{execute("UPDATE oauth_attempts SET status='consumed' WHERE state_hash=@stateHash AND status='exchanging'",{stateHash});return changed();}
 };
}
